#!/usr/bin/env bun

/**
 * SharePoint Manager - CLI with Config Support
 * Manages SharePoint file tracking and URL extraction from OneDrive-synced files
 */

import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import { SharepointManager } from './core/process-links.js';
import { setupPermissions } from './extractors/extract-applescript.js';
import { loadConfig } from './lib/config.js';
import { createLogger } from './lib/logger.js';
import type { SharepointManagerRiffConfig } from './lib/schema.js';

/**
 * Apply CLI option overrides to riff config
 */
function applyCliOverrides(
	riff: SharepointManagerRiffConfig,
	opts: Record<string, unknown>
): SharepointManagerRiffConfig {
	if (opts['syncFolder']) {
		riff.paths.input.onedrive = opts['syncFolder'] as string;
	}
	if (opts['outputCsv']) {
		riff.paths.output.index = opts['outputCsv'] as string;
	}
	if (opts['outputSqlite']) {
		riff.paths.database.file = opts['outputSqlite'] as string;
	}
	if (opts['sharepointBase']) {
		riff.links.sharePointBase = opts['sharepointBase'] as string;
	}
	if (opts['extractionDelay']) {
		riff.links.extractionDelay = opts['extractionDelay'] as number;
	}
	if (opts['outputFormat']) {
		riff.output.format = opts['outputFormat'] as 'csv' | 'sqlite' | 'both';
	}
	if (opts['batchSize']) {
		riff.processing.batchSize = opts['batchSize'] as number;
	}
	if (opts['saveInterval']) {
		riff.output.saveInterval = opts['saveInterval'] as number;
	}
	return riff;
}

/**
 * Create and configure the CLI program
 */
function createProgram(): Command {
	const program = new Command();

	program
		.name('sharepoint-manager')
		.description('SharePoint Manager - Manage SharePoint file tracking and URL extraction')
		.version('2.0.0')
		.option('-c, --config <path>', 'Path to config file')
		.option('-v, --verbose', 'Enable verbose logging output')
		.option('--sync-folder <path>', 'OneDrive sync folder path')
		.option('--output-csv <path>', 'CSV output file path')
		.option('--output-sqlite <path>', 'SQLite database path')
		.option('--sharepoint-base <url>', 'Base SharePoint URL')
		.option('--output-format <format>', 'Output format: csv, sqlite, or both')
		.option('--batch-size <number>', 'Default batch size', parseInt)
		.option('--save-interval <number>', 'Save progress every N files', parseInt)
		.option('--extraction-delay <ms>', 'Clipboard extraction delay in milliseconds', parseInt);

	program
		.command('init')
		.description('Initialize storage with fast scan (no web view links)')
		.action(async () => {
			const opts = program.opts();
			const config = loadConfig(opts['config'] as string | undefined);
			const riff = applyCliOverrides(config['sharepoint-manager'], opts);
			const logger = createLogger({
				level: config.logging.level,
				verbose: !!opts['verbose'] || config.logging.verbose,
				file: config.logging.file,
				maxFileSizeMb: config.logging.maxFileSizeMb,
				maxFiles: config.logging.maxFiles,
			});

			try {
				const manager = new SharepointManager(riff, logger);

				logger.info({ syncFolder: riff.paths.input.onedrive }, 'Starting initialization');
				logger.info({}, 'SharePoint Manager');
				logger.info({}, '='.repeat(60));

				if (manager.storageExists()) {
					logger.warn({}, 'Warning: Storage already exists.');
					process.stdout.write('Overwrite? (y/n): ');
					const answer = await new Promise<string>(resolve => {
						process.stdin.once('data', data => resolve(data.toString().trim()));
					});
					if (answer.toLowerCase() !== 'y') {
						logger.info({}, 'Aborted.');
						process.exit(0);
					}
				}

				await manager.initialScan();
				logger.info({}, 'Initialization complete!');
				logger.info({}, 'Run "sharepoint-manager process" to start adding web view links.');
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				logger.error({ error: message }, 'Initialization failed');
				process.exit(1);
			}
		});

	program
		.command('setup')
		.description('Set up accessibility permissions')
		.action(async () => {
			const opts = program.opts();
			const config = loadConfig(opts['config'] as string | undefined);
			const logger = createLogger({
				level: config.logging.level,
				verbose: !!opts['verbose'] || config.logging.verbose,
				file: config.logging.file,
				maxFileSizeMb: config.logging.maxFileSizeMb,
				maxFiles: config.logging.maxFiles,
			});

			try {
				logger.info({}, 'Starting accessibility permissions setup');
				await setupPermissions(logger);
				logger.info({}, 'Permissions setup completed');
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				logger.error({ error: message }, 'Permissions setup failed');
				process.exit(1);
			}
		});

	program
		.command('status')
		.description('Show current status')
		.action(async () => {
			const opts = program.opts();
			const config = loadConfig(opts['config'] as string | undefined);
			const riff = applyCliOverrides(config['sharepoint-manager'], opts);
			const logger = createLogger({
				level: config.logging.level,
				verbose: !!opts['verbose'] || config.logging.verbose,
				file: config.logging.file,
				maxFileSizeMb: config.logging.maxFileSizeMb,
				maxFiles: config.logging.maxFiles,
			});

			try {
				const manager = new SharepointManager(riff, logger);

				logger.info({}, 'Retrieving status');
				logger.info({}, 'SharePoint Manager');
				logger.info({}, '='.repeat(60));
				await manager.showStatus();
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				logger.error({ error: message }, 'Status retrieval failed');
				process.exit(1);
			}
		});

	program
		.command('process')
		.option('-b, --batch <number>', 'Process N files in this session', parseInt)
		.option('-m, --method <method>', 'Extraction method: auto, database, applescript')
		.description('Process pending files')
		.action(async cmdOptions => {
			const opts = program.opts();
			const config = loadConfig(opts['config'] as string | undefined);
			const riff = applyCliOverrides(config['sharepoint-manager'], opts);
			const logger = createLogger({
				level: config.logging.level,
				verbose: !!opts['verbose'] || config.logging.verbose,
				file: config.logging.file,
				maxFileSizeMb: config.logging.maxFileSizeMb,
				maxFiles: config.logging.maxFiles,
			});

			try {
				const method = (cmdOptions.method as 'auto' | 'database' | 'applescript') || riff.database.method;
				const manager = new SharepointManager(riff, logger, method);

				logger.info({ method, batch: cmdOptions.batch }, 'Starting file processing');
				logger.info({}, 'SharePoint Manager');
				logger.info({}, '='.repeat(60));

				if (!manager.storageExists()) {
					logger.warn({}, 'No storage found. Run "sharepoint-manager init" command first.');
					process.exit(2);
				}

				await manager.loadRecords();
				await manager.updateWebViewLinks(cmdOptions.batch);
				logger.info({}, 'Storage updated successfully!');
				logger.info({}, 'Run "sharepoint-manager process" again to continue processing remaining files.');
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				logger.error({ error: message }, 'File processing failed');
				process.exit(1);
			}
		});

	program
		.command('retry-failed')
		.option('-b, --batch <number>', 'Process N files after retry', parseInt)
		.option('-m, --method <method>', 'Extraction method: auto, database, applescript')
		.description('Retry failed web view links')
		.action(async cmdOptions => {
			const opts = program.opts();
			const config = loadConfig(opts['config'] as string | undefined);
			const riff = applyCliOverrides(config['sharepoint-manager'], opts);
			const logger = createLogger({
				level: config.logging.level,
				verbose: !!opts['verbose'] || config.logging.verbose,
				file: config.logging.file,
				maxFileSizeMb: config.logging.maxFileSizeMb,
				maxFiles: config.logging.maxFiles,
			});

			try {
				const method = (cmdOptions.method as 'auto' | 'database' | 'applescript') || riff.database.method;
				const manager = new SharepointManager(riff, logger, method);

				logger.info({ method, batch: cmdOptions.batch }, 'Starting retry of failed files');
				logger.info({}, 'SharePoint Manager');
				logger.info({}, '='.repeat(60));

				if (!manager.storageExists()) {
					logger.warn({}, 'No storage found. Run "sharepoint-manager init" command first.');
					process.exit(2);
				}

				await manager.retryFailed();
				await manager.loadRecords();
				await manager.updateWebViewLinks(cmdOptions.batch);
				logger.info({}, 'Storage updated successfully!');
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				logger.error({ error: message }, 'Retry failed');
				process.exit(1);
			}
		});

	return program;
}

/* c8 ignore start */
if (process.argv[1] === fileURLToPath(import.meta.url)) {
	createProgram()
		.parseAsync(process.argv)
		.catch(error => {
			process.stderr.write(`FATAL ERROR: ${error instanceof Error ? error.message : String(error)}\n`);
			process.exit(1);
		});
}
/* c8 ignore stop */
