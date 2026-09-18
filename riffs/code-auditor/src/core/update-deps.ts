/**
 * Aria Code Auditor Update Engine - Core update functionality with rollback
 */

import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import type { Logger } from 'pino';
import type { DependencyInfo, OutdatedDependency, TestResult, UpdateOptions, UpdateResults } from '../lib/types.js';
import { findOutdatedDependencies } from './audit-deps.js';
import { createBackup, restoreFromBackup } from './backup-manager.js';
import { runBunInstall, runBunTest } from './bun-cmd.js';

// Setup for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Default backup directory inside the riff's outputs
const DEFAULT_BACKUP_DIR = path.join(__dirname, '..', 'outputs', 'backups');

/**
 * Perform safe dependency updates with rollback capability
 */
export async function performUpdate(options: UpdateOptions, logger: Logger): Promise<UpdateResults> {
	const results: UpdateResults = {
		timestamp: new Date().toISOString(),
		updates: {
			attempted: [],
			successful: [],
			failed: [],
			rolledBack: [],
		},
		backup: {
			created: false,
			files: [],
		},
		tests: {
			ranBefore: false,
			ranAfter: false,
		},
		status: {
			success: false,
			requiresRollback: false,
			completed: false,
		},
		exitCode: 0,
	};

	try {
		logger.info('Starting safe dependency update process');

		// Step 1: Get outdated dependencies
		logger.debug('Finding outdated dependencies');
		const outdatedDeps = await findOutdatedDependencies(logger);

		if (outdatedDeps.length === 0) {
			logger.info('All dependencies are already up to date');
			results.status.success = true;
			results.status.completed = true;
			return results;
		}

		logger.info({ count: outdatedDeps.length }, 'Found outdated dependencies');

		// Step 2: Filter dependencies based on options
		const depsToUpdate = await filterDependenciesForUpdate(outdatedDeps, options, logger);

		if (depsToUpdate.length === 0) {
			logger.warn('No dependencies selected for update');
			results.status.completed = true;
			return results;
		}

		results.updates.attempted = depsToUpdate;

		// Step 3: Handle dry run
		if (options.dryRun) {
			return await handleDryRun(depsToUpdate, results, logger);
		}

		// Step 4: Create backup
		logger.debug('Creating backup');
		const backupInfo = await createBackup(options.backupDir || DEFAULT_BACKUP_DIR, logger);
		results.backup = backupInfo;

		if (!backupInfo.created) {
			logger.error('Could not create backup - aborting update');
			results.exitCode = 1;
			return results;
		}

		// Step 5: Run tests before update (if not skipped)
		if (!options.skipTests) {
			logger.debug('Running tests before update');
			const testResultBefore = await runTests(options.testCommand, logger);
			results.tests.ranBefore = true;
			results.tests.passedBefore = testResultBefore.success;

			if (!testResultBefore.success) {
				logger.error('Tests are failing before update - aborting');
				results.exitCode = 2;
				return results;
			}
		}

		// Step 6: Perform updates
		logger.info({ count: depsToUpdate.length }, 'Performing updates');
		const updateSuccess = await performUpdates(depsToUpdate, results, logger);

		if (!updateSuccess) {
			logger.error('Some updates failed');
			results.status.requiresRollback = true;
		}

		// Step 7: Run tests after update (if not skipped)
		if (!options.skipTests && updateSuccess) {
			logger.debug('Running tests after update');
			const testResultAfter = await runTests(options.testCommand, logger);
			results.tests.ranAfter = true;
			results.tests.passedAfter = testResultAfter.success;

			if (!testResultAfter.success) {
				logger.error('Tests are failing after update - rolling back');
				results.status.requiresRollback = true;
			}
		}

		// Step 8: Handle rollback if needed
		if (results.status.requiresRollback && backupInfo.created) {
			logger.warn('Rolling back changes');
			await handleRollback(backupInfo.path, results, logger);
		} else {
			results.status.success = updateSuccess;
		}

		results.status.completed = true;
		results.exitCode = results.status.success ? 0 : 1;
		logger.info({ success: results.status.success }, 'Update process completed');

		return results;
	} catch (error) {
		logger.error(
			{ error: error instanceof Error ? error.message : 'Unknown error' },
			'Error during update process'
		);
		results.status.completed = true;
		results.exitCode = 3;
		return results;
	}
}

/**
 * Filter dependencies for update based on options
 */
async function filterDependenciesForUpdate(
	outdatedDeps: OutdatedDependency[],
	options: UpdateOptions,
	logger: Logger
): Promise<DependencyInfo[]> {
	let filtered = [...outdatedDeps];

	// Filter by development dependencies only
	if (options.devOnly) {
		filtered = filtered.filter(dep => dep.type === 'development');
		logger.debug({ count: filtered.length }, 'Filtered to dev dependencies only');
	}

	// Handle selective updates
	if (options.selective) {
		filtered = await promptForSelectiveDependencies(filtered, logger);
	}

	return filtered.map(dep => ({
		name: dep.name,
		current: dep.current,
		latest: dep.latest,
		type: dep.type,
	}));
}

/**
 * Prompt user to select which dependencies to update
 */
async function promptForSelectiveDependencies(
	deps: OutdatedDependency[],
	logger: Logger
): Promise<OutdatedDependency[]> {
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	const selected: OutdatedDependency[] = [];

	logger.info('Selective update mode - choose which dependencies to update');

	for (const dep of deps) {
		const question = `Update ${dep.name} from ${dep.current} to ${dep.latest}? (y/N): `;

		const answer = await new Promise<string>(resolve => {
			rl.question(question, resolve);
		});

		if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
			selected.push(dep);
			logger.debug({ dependency: dep.name }, 'Selected for update');
		} else {
			logger.debug({ dependency: dep.name }, 'Skipped');
		}
	}

	rl.close();

	logger.info({ count: selected.length }, 'Dependencies selected for update');
	return selected;
}

/**
 * Handle dry run mode
 */
async function handleDryRun(deps: DependencyInfo[], results: UpdateResults, logger: Logger): Promise<UpdateResults> {
	logger.info('DRY RUN MODE - The following updates would be performed');

	for (const dep of deps) {
		logger.info({ name: dep.name, from: dep.current, to: dep.latest }, 'Would update dependency');
	}

	logger.info('No actual changes made in dry run mode');
	results.status.success = true;
	results.status.completed = true;

	return results;
}

/**
 * Perform the actual dependency updates
 */
async function performUpdates(deps: DependencyInfo[], results: UpdateResults, logger: Logger): Promise<boolean> {
	let allSuccessful = true;

	logger.info({ count: deps.length }, 'Updating dependencies');

	for (const dep of deps) {
		try {
			logger.debug({ name: dep.name, from: dep.current, to: dep.latest }, 'Updating dependency');

			const updateResult = await runBunInstall([`${dep.name}@${dep.latest}`]);

			if (updateResult.success) {
				results.updates.successful.push(dep);
				logger.info({ name: dep.name }, 'Successfully updated dependency');
			} else {
				results.updates.failed.push(dep);
				logger.error({ name: dep.name, error: updateResult.stderr }, 'Failed to update dependency');
				allSuccessful = false;
			}
		} catch (error) {
			results.updates.failed.push(dep);
			logger.error(
				{ name: dep.name, error: error instanceof Error ? error.message : 'Unknown error' },
				'Error updating dependency'
			);
			allSuccessful = false;
		}
	}

	const successCount = results.updates.successful.length;
	const failCount = results.updates.failed.length;

	logger.info({ successful: successCount, failed: failCount }, 'Update results');

	return allSuccessful;
}

/**
 * Run tests and return results
 */
async function runTests(testCommand = 'test', logger: Logger): Promise<TestResult> {
	const startTime = Date.now();

	logger.info({ command: testCommand }, 'Running tests');

	try {
		const result = await runBunTest(testCommand);
		const duration = Date.now() - startTime;

		if (result.success) {
			logger.info({ duration }, 'Tests passed');
		} else {
			logger.error({ duration, stderr: result.stderr }, 'Tests failed');
		}

		return {
			command: `bun ${testCommand}`,
			success: result.success,
			output: result.stdout,
			exitCode: result.exitCode,
			duration,
		};
	} catch (error) {
		const duration = Date.now() - startTime;
		logger.error(
			{ duration, error: error instanceof Error ? error.message : 'Unknown error' },
			'Error running tests'
		);

		return {
			command: `bun ${testCommand}`,
			success: false,
			output: '',
			exitCode: 1,
			duration,
		};
	}
}

/**
 * Handle rollback process
 */
async function handleRollback(backupPath: string, results: UpdateResults, logger: Logger): Promise<void> {
	logger.warn({ backupPath }, 'Rolling back changes');

	try {
		const rollbackSuccess = await restoreFromBackup(backupPath, logger);

		if (rollbackSuccess) {
			// Move successful updates to rolled back
			results.updates.rolledBack = [...results.updates.successful];
			results.updates.successful = [];

			logger.info('Rollback completed successfully');
			results.status.success = true; // Rollback success means overall success
		} else {
			logger.error('Rollback failed - manual intervention required');
			results.status.success = false;
		}
	} catch (error) {
		logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Error during rollback');
		results.status.success = false;
	}
}

/**
 * Validate update configuration
 */
export function validateUpdateOptions(options: UpdateOptions): string[] {
	const errors: string[] = [];

	if (options.backupDir && !path.isAbsolute(options.backupDir)) {
		// Convert to absolute path
		options.backupDir = path.resolve(options.backupDir);
	}

	if (options.testCommand && !options.testCommand.trim()) {
		errors.push('Test command cannot be empty');
	}

	if (options.packageManager && options.packageManager !== 'bun') {
		errors.push('Package manager must be bun');
	}

	return errors;
}
