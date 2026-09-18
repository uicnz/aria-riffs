/**
 * Aria Code Auditor Reporter - Handle output generation and formatting
 */

import { existsSync, promises as fs } from 'node:fs';
import path from 'node:path';
import type { Logger } from 'pino';
import type { AuditResults, OutdatedDependency, UpdateResults } from '../lib/types.js';

/**
 * Ensure output directory exists
 */
export async function ensureOutputDir(outputDir: string, logger?: Logger): Promise<void> {
	try {
		if (!existsSync(outputDir)) {
			await fs.mkdir(outputDir, { recursive: true });
			logger?.debug({ outputDir }, 'Created output directory');
		}
	} catch (error) {
		logger?.warn({ outputDir, error }, 'Could not create output directory');
	}
}

/**
 * Write audit results to JSON file
 */
export async function writeAuditJson(results: AuditResults, outputDir: string, logger: Logger): Promise<void> {
	try {
		await ensureOutputDir(outputDir, logger);
		const outputPath = path.join(outputDir, 'audit-summary.json');
		await fs.writeFile(outputPath, JSON.stringify(results, null, 2));
		logger.info({ outputPath }, 'Wrote JSON summary');
	} catch (error) {
		logger.error({ error }, 'Error writing JSON summary');
	}
}

/**
 * Write update results to JSON file
 */
export async function writeUpdateJson(results: UpdateResults, outputDir: string, logger: Logger): Promise<void> {
	try {
		await ensureOutputDir(outputDir, logger);
		const outputPath = path.join(outputDir, 'update-summary.json');
		await fs.writeFile(outputPath, JSON.stringify(results, null, 2));
		logger.info({ outputPath }, 'Wrote update summary');
	} catch (error) {
		logger.error({ error }, 'Error writing update summary');
	}
}

/**
 * Write dependencies list to text file
 */
export async function writeDependenciesText(dependencies: string, outputDir: string, logger: Logger): Promise<void> {
	try {
		await ensureOutputDir(outputDir, logger);
		const outputPath = path.join(outputDir, 'deps.txt');
		await fs.writeFile(outputPath, dependencies);
		logger.info({ outputPath }, 'Wrote dependencies list');
	} catch (error) {
		logger.error({ error }, 'Error writing dependencies');
	}
}

/**
 * Write outdated dependencies to text file
 */
export async function writeOutdatedText(
	outdated: OutdatedDependency[],
	outputDir: string,
	logger: Logger
): Promise<void> {
	try {
		await ensureOutputDir(outputDir, logger);
		const outputPath = path.join(outputDir, 'outdated.txt');

		const content = outdated.length > 0 ? formatOutdatedDependencies(outdated) : 'All dependencies are up to date!';

		await fs.writeFile(outputPath, content);
		logger.info({ outputPath, count: outdated.length }, 'Wrote outdated dependencies');
	} catch (error) {
		logger.error({ error }, 'Error writing outdated dependencies');
	}
}

/**
 * Format outdated dependencies for text output
 */
function formatOutdatedDependencies(outdated: OutdatedDependency[]): string {
	const header = `${'Package'.padEnd(20) + 'Current'.padEnd(12) + 'Wanted'.padEnd(12) + 'Latest'.padEnd(12)}Type\n`;
	const separator = `${'-'.repeat(68)}\n`;

	const rows = outdated
		.map(
			dep =>
				dep.name.padEnd(20) + dep.current.padEnd(12) + dep.wanted.padEnd(12) + dep.latest.padEnd(12) + dep.type
		)
		.join('\n');

	return header + separator + rows;
}

/**
 * Display audit results summary through the canonical logger
 */
export function displayAuditSummary(results: AuditResults, logger: Logger): void {
	logger.info('ARIA CODE AUDITER - AUDIT SUMMARY');
	logger.info(
		{
			totalDependencies: results.dependencies.all.length,
			outdatedDependencies: results.dependencies.outdated.length,
			unusedDependencies: results.dependencies.unused.length,
		},
		'Audit dependency counts'
	);

	if (results.dependencies.outdated.length > 0) {
		results.dependencies.outdated.forEach(dep => {
			logger.warn(
				{ dependency: dep.name, current: dep.current, latest: dep.latest, wanted: dep.wanted, type: dep.type },
				'Outdated dependency'
			);
		});
	}

	if (results.dependencies.unused.length > 0) {
		results.dependencies.unused.forEach(dep => {
			logger.warn({ dependency: dep }, 'Potentially unused dependency');
		});
	}

	if (results.status.allUsed && results.status.allUpdated) {
		logger.info('All dependencies are used and up to date');
	} else {
		logger.warn('Dependency audit found issues');
	}
}

/**
 * Display update results summary through the canonical logger
 */
export function displayUpdateSummary(results: UpdateResults, logger: Logger): void {
	logger.info('ARIA CODE AUDITER - UPDATE SUMMARY');
	logger.info(
		{
			attemptedUpdates: results.updates.attempted.length,
			successfulUpdates: results.updates.successful.length,
			failedUpdates: results.updates.failed.length,
			rolledBackUpdates: results.updates.rolledBack.length,
		},
		'Update result counts'
	);

	if (results.updates.successful.length > 0) {
		results.updates.successful.forEach(dep => {
			logger.info(
				{ dependency: dep.name, current: dep.current, latest: dep.latest, type: dep.type },
				'Successful dependency update'
			);
		});
	}

	if (results.updates.failed.length > 0) {
		results.updates.failed.forEach(dep => {
			logger.error(
				{
					dependency: dep.name,
					current: dep.current,
					target: dep.latest || dep.wanted || 'latest',
					type: dep.type,
				},
				'Failed dependency update'
			);
		});
	}

	if (results.backup.created) {
		logger.info({ backupPath: results.backup.path }, 'Backup created');
	}

	if (results.status.success) {
		logger.info('Update process completed successfully');
	} else {
		logger.error('Update process completed with failures');
	}
}

/**
 * Display progress indicator
 */
export function displayProgress(message: string): void {
	process.stdout.write(`${message}\n`);
}

/**
 * Display success message
 */
export function displaySuccess(message: string): void {
	process.stdout.write(`${message}\n`);
}

/**
 * Display warning message
 */
export function displayWarning(message: string): void {
	process.stderr.write(`${message}\n`);
}

/**
 * Display error message
 */
export function displayError(message: string): void {
	process.stderr.write(`${message}\n`);
}
