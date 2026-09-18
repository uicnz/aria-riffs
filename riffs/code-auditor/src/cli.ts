#!/usr/bin/env bun

/**
 * Aria Code Auditor CLI - Advanced dependency audit and update riff
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import type { Logger } from 'pino';
import packageManifest from '../package.json' with { type: 'json' };
import { performAudit } from './core/audit-deps.js';
import { checkBunAvailable, getBunVersion } from './core/bun-cmd.js';
import { performUpdate, validateUpdateOptions } from './core/update-deps.js';
import { loadConfig } from './lib/config.js';
import { createLogger } from './lib/logger.js';
import type { AuditOptions, UpdateOptions } from './lib/types.js';
import {
	displayAuditSummary,
	displayUpdateSummary,
	writeAuditJson,
	writeDependenciesText,
	writeOutdatedText,
	writeUpdateJson,
} from './utils/reporter.js';

// Setup for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Default paths
const DEFAULT_OUTPUT_DIR = path.join(__dirname, '..', 'outputs');
const DEFAULT_BACKUP_DIR = path.join(DEFAULT_OUTPUT_DIR, 'backups');

/**
 * Initialize the Pino logger with config and CLI options
 */
function initLogger(verbose: boolean): Logger {
	const config = loadConfig();
	return createLogger({
		level: config.logging.level,
		verbose: verbose || config.logging.verbose,
		file: config.logging.file,
		maxFileSizeMb: config.logging.maxFileSizeMb,
		maxFiles: config.logging.maxFiles,
	});
}

/**
 * Handle audit command
 */
async function handleAuditCommand(options: AuditOptions, logger: Logger): Promise<void> {
	logger.info('ARIA CODE AUDITOR - DEPENDENCY AUDIT');

	// Validate environment
	logger.debug('Checking bun availability');
	const bunAvailable = await checkBunAvailable();
	if (!bunAvailable) {
		logger.error('bun is not available');
		throw new Error('bun is not available. Please ensure bun is installed and accessible.');
	}
	logger.debug('bun is available');

	// Perform audit
	logger.info('Starting audit');
	const results = await performAudit(options, logger);
	logger.info(
		{
			results: {
				total: results.dependencies.all.length,
				outdated: results.dependencies.outdated.length,
				unused: results.dependencies.unused.length,
			},
		},
		'Audit completed'
	);

	// Write outputs
	if (options.json) {
		await writeAuditJson(results, options.outputDir || DEFAULT_OUTPUT_DIR, logger);
	} else {
		// Write text outputs
		const dependenciesList = results.dependencies.all.map(dep => `${dep.name}@${dep.current}`).join('\n');

		await writeDependenciesText(dependenciesList, options.outputDir || DEFAULT_OUTPUT_DIR, logger);
		await writeOutdatedText(results.dependencies.outdated, options.outputDir || DEFAULT_OUTPUT_DIR, logger);
	}

	// Display summary
	displayAuditSummary(results, logger);

	// Set exit code
	process.exitCode = results.exitCode;
}

/**
 * Handle update command
 */
async function handleUpdateCommand(options: UpdateOptions, logger: Logger): Promise<void> {
	logger.info('ARIA AUDITER - DEPENDENCY UPDATE');

	// Validate options
	const validationErrors = validateUpdateOptions(options);
	if (validationErrors.length > 0) {
		logger.error({ errors: validationErrors }, 'Invalid options');
		for (const error of validationErrors) {
			logger.error({ error }, 'Validation error');
		}
		process.exit(1);
	}

	// Validate environment
	logger.debug('Checking bun availability');
	const bunAvailable = await checkBunAvailable();
	if (!bunAvailable) {
		logger.error('bun is not available');
		throw new Error('bun is not available. Please ensure bun is installed and accessible.');
	}

	// Show dry run notice
	if (options.dryRun) {
		logger.info('Running in dry run mode');
	}

	// Perform update
	logger.info('Starting update');
	const results = await performUpdate(options, logger);
	logger.info(
		{ successful: results.updates.successful.length, failed: results.updates.failed.length },
		'Update completed'
	);

	// Write JSON output if requested
	if (options.json) {
		await writeUpdateJson(results, options.backupDir || DEFAULT_BACKUP_DIR, logger);
	}

	// Display summary
	displayUpdateSummary(results, logger);

	// Set exit code
	process.exitCode = results.exitCode;
}

/**
 * Handle status command
 */
async function handleStatusCommand(logger: Logger): Promise<void> {
	logger.info('ARIA CODE AUDITOR - STATUS');

	logger.debug('Gathering environment information');

	// Environment information
	logger.info(
		{
			nodeVersion: process.version,
			platform: process.platform,
			architecture: process.arch,
			workingDirectory: process.cwd(),
		},
		'Environment'
	);

	// bun information
	const bunAvailable = await checkBunAvailable();
	const bunVersion = bunAvailable ? await getBunVersion() : 'not available';
	logger.debug({ bunAvailable, bunVersion }, 'bun status');
	logger.info({ bunVersion }, 'bun version');

	// Package.json check
	const packageJsonPath = path.join(process.cwd(), 'package.json');
	try {
		require(packageJsonPath);
		logger.info({ packageJsonPath }, 'package.json found');
	} catch {
		logger.warn({ packageJsonPath }, 'package.json not found');
	}

	// Output directories
	logger.info({ defaultOutputDir: DEFAULT_OUTPUT_DIR, defaultBackupDir: DEFAULT_BACKUP_DIR }, 'Output directories');

	// Riff information
	logger.info(
		{
			name: 'Aria Code Auditor',
			version: '1.0.0',
			description: 'Advanced dependency audit and update riff',
		},
		'Riff information'
	);

	if (bunAvailable) {
		logger.info('Environment is ready');
	} else {
		logger.error('Environment issues detected');
		process.exit(1);
	}
}

/**
 * Create and configure the CLI program
 */
function createProgram(): Command {
	const program = new Command();

	program.name('code-auditor').description(packageManifest.description).version(packageManifest.version);

	/**
	 * Audit command - analyze dependencies
	 */
	program
		.command('audit')
		.description('Audit dependencies for outdated packages and unused dependencies')
		.option('-j, --json', 'Output results in JSON format')
		.option('-v, --verbose', 'Enable verbose logging (debug to console)')
		.option('-o, --output-dir <dir>', 'Output directory for results', DEFAULT_OUTPUT_DIR)
		.action(async options => {
			const logger = initLogger(options.verbose);
			logger.debug({ options }, 'Starting audit command');

			try {
				await handleAuditCommand(options, logger);
			} catch (error) {
				logger.error({ error }, 'Audit failed');
				process.exit(1);
			}
		});

	/**
	 * Update command - safely update dependencies
	 */
	program
		.command('update')
		.description('Safely update dependencies with automatic rollback on test failure')
		.option('-d, --dry-run', 'Show what would be updated without making changes')
		.option('-s, --selective', 'Prompt for each outdated dependency')
		.option('--dev-only', 'Only update devDependencies')
		.option('--skip-tests', 'Skip test verification (not recommended)')
		.option('-b, --backup-dir <dir>', 'Custom backup directory', DEFAULT_BACKUP_DIR)
		.option('-t, --test-command <cmd>', 'Test command to run for verification', 'test')
		.option('-p, --package-manager <mgr>', 'Package manager to use', 'bun')
		.option('-j, --json', 'Output results in JSON format')
		.option('-v, --verbose', 'Enable verbose logging (debug to console)')
		.action(async options => {
			const logger = initLogger(options.verbose);
			logger.debug({ options }, 'Starting update command');

			try {
				await handleUpdateCommand(options, logger);
			} catch (error) {
				logger.error({ error }, 'Update failed');
				process.exit(1);
			}
		});

	/**
	 * Status command - check environment and dependencies
	 */
	program
		.command('status')
		.description('Show current status and environment information')
		.option('-v, --verbose', 'Enable verbose logging (debug to console)')
		.action(async options => {
			const logger = initLogger(options.verbose);
			logger.debug('Starting status command');

			try {
				await handleStatusCommand(logger);
			} catch (error) {
				logger.error({ error }, 'Status check failed');
				process.exit(1);
			}
		});

	return program;
}

/**
 * Global error handling
 */
process.on('unhandledRejection', (reason, _promise) => {
	const logger = initLogger(false);
	logger.fatal({ reason }, 'Unhandled promise rejection');
	process.exit(1);
});

process.on('uncaughtException', error => {
	const logger = initLogger(false);
	logger.fatal({ error }, 'Uncaught exception');
	process.exit(1);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
	const logger = initLogger(false);
	logger.warn('Received SIGINT - shutting down gracefully');
	process.exit(0);
});

process.on('SIGTERM', () => {
	const logger = initLogger(false);
	logger.warn('Received SIGTERM - shutting down gracefully');
	process.exit(0);
});

/* c8 ignore start */
if (process.argv[1] === fileURLToPath(import.meta.url)) {
	createProgram().parse();
}
/* c8 ignore stop */
