#!/usr/bin/env bun

/**
 * CLI interface for image-sanitiser
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import * as fsExtra from 'fs-extra';
import type { Logger } from 'pino';
import { ImageFormatDetector } from './core/detect-format.js';
import { ImageSanitiser } from './core/sanitise-images.js';
import { DatabaseManager } from './db/database.js';
import { loadConfig } from './lib/config.js';
import { createLogger } from './lib/logger.js';
import type { ImageSanitiserConfig } from './lib/schema.js';

interface ProgramWithDatabaseManager extends Command {
	databaseManager?: {
		saveDescription: (filePath: string, description: string) => Promise<void>;
		updateFilePath: (oldPath: string, newPath: string) => Promise<void>;
		close: () => void;
	};
	setDatabaseManager(dbManager: {
		saveDescription: (filePath: string, description: string) => Promise<void>;
		updateFilePath: (oldPath: string, newPath: string) => Promise<void>;
		close: () => void;
	}): void;
	config: ImageSanitiserConfig;
}

/**
 * Create and configure the CLI program
 */
function createProgram(): ProgramWithDatabaseManager {
	// Load config once at startup
	const config = loadConfig();

	/**
	 * Initialize the Pino logger with config and CLI options
	 */
	function initLogger(verbose: boolean): Logger {
		return createLogger({
			level: config.logging.level,
			verbose: verbose || config.logging.verbose,
			file: config.logging.file,
			maxFileSizeMb: config.logging.maxFileSizeMb,
			maxFiles: config.logging.maxFiles,
		});
	}

	const program = new Command() as ProgramWithDatabaseManager;

	program.setDatabaseManager = function (dbManager) {
		this.databaseManager = dbManager;
	};

	// Attach config to program for access in commands
	program.config = config;

	// Initialize database manager for tracking file path changes
	const databaseManager = new DatabaseManager(config);
	program.setDatabaseManager(databaseManager);

	program
		.name('image-sanitiser')
		.description('Detect correct image file types and fix extensions using content analysis')
		.version('2.1.0');

	program
		.command('sanitise <path>')
		.description('Sanitise image files by fixing incorrect extensions')
		.option('-r, --recursive', 'Process subdirectories recursively')
		.option('--dry-run', 'Show what would be renamed without actually renaming files')
		.option('--no-progress', 'Disable progress bar')
		.option('-v, --verbose', 'Enable verbose output (debug logging to console)')
		.action(async (pathArg, options) => {
			const logger = initLogger(options.verbose);
			logger.debug({ pathArg, options }, 'Starting sanitise command');

			try {
				const targetPath = path.resolve(pathArg);

				if (!(await fsExtra.pathExists(targetPath))) {
					logger.error({ targetPath }, 'Path does not exist');
					process.exit(1);
				}

				logger.info({ targetPath }, 'Processing target path');

				const sanitiser = new ImageSanitiser(logger, config, undefined, program.databaseManager);

				// Process single file or directory
				const stats = await fs.promises.stat(targetPath);

				if (stats.isFile()) {
					logger.info({ file: path.basename(targetPath) }, 'Analyzing file');

					const success = await sanitiser.sanitizeSingleFile(targetPath, options.dryRun);
					await sanitiser.cleanup();
					process.exit(success ? 0 : 1);
				}

				if (stats.isDirectory()) {
					logger.info({ directory: targetPath }, 'Processing directory');

					const results = await sanitiser.sanitizeDirectory(targetPath, {
						recursive: options.recursive,
						dryRun: options.dryRun,
						showProgress: !options.noProgress,
					});

					const action = options.dryRun ? 'analysed' : 'processed';
					logger.info(
						{
							action,
							totalFiles: results.total_files,
							processed: results.processed,
							fixed: results.fixed,
							skipped: results.skipped,
							failed: results.failed,
							processingTimeSeconds: results.processing_time,
						},
						'Processing summary'
					);

					if (!options.dryRun) {
						logger.info({ fixed: results.fixed }, 'Files fixed');
					}

					if (results.failed > 0) {
						for (const error of results.errors) {
							logger.error({ error }, 'Processing error');
						}
						await sanitiser.cleanup();
						process.exit(1);
					}

					const successMsg = options.dryRun
						? 'Analysis complete!'
						: `Processing complete! ${results.fixed} files were fixed.`;
					logger.info(successMsg);
					await sanitiser.cleanup();
					process.exit(0);
				}

				logger.error({ targetPath }, 'Path is neither a file nor directory');
				process.exit(1);
			} catch (error) {
				logger.error(
					{ error: error instanceof Error ? error.message : String(error) },
					'Sanitise command failed'
				);
				process.exit(1);
			}
		});

	program
		.command('analyse <path>')
		.description('Analyse image files without making changes (same as sanitise --dry-run)')
		.option('-r, --recursive', 'Process subdirectories recursively')
		.option('--no-progress', 'Disable progress bar')
		.option('-v, --verbose', 'Enable verbose output (debug logging to console)')
		.action(async (pathArg, options) => {
			const logger = initLogger(options.verbose);
			logger.debug({ pathArg, options }, 'Starting analyse command');

			// Redirect to sanitise with dry-run - manually call the logic
			try {
				const targetPath = path.resolve(pathArg);

				if (!(await fsExtra.pathExists(targetPath))) {
					logger.error({ targetPath }, 'Path does not exist');
					process.exit(1);
				}

				logger.info({ targetPath }, 'Analysing target path');

				const sanitiser = new ImageSanitiser(logger, config, undefined, program.databaseManager);
				const stats = await fs.promises.stat(targetPath);

				if (stats.isFile()) {
					logger.info({ file: path.basename(targetPath) }, 'Analyzing file');
					const success = await sanitiser.sanitizeSingleFile(targetPath, true); // Force dry-run
					await sanitiser.cleanup();
					process.exit(success ? 0 : 1);
				}

				if (stats.isDirectory()) {
					logger.info({ directory: targetPath }, 'Analyzing directory');
					const results = await sanitiser.sanitizeDirectory(targetPath, {
						recursive: options.recursive,
						dryRun: true, // Force dry-run
						showProgress: !options.noProgress,
					});

					logger.info(
						{
							totalFiles: results.total_files,
							processed: results.processed,
							skipped: results.skipped,
							failed: results.failed,
							processingTimeSeconds: results.processing_time,
						},
						'Analysis summary'
					);

					if (results.failed > 0) {
						for (const error of results.errors) {
							logger.error({ error }, 'Analysis error');
						}
					}

					logger.info('Analysis complete');
					await sanitiser.cleanup();
					process.exit(0);
				}

				logger.error({ targetPath }, 'Path is neither a file nor directory');
				process.exit(1);
			} catch (error) {
				logger.error(
					{ error: error instanceof Error ? error.message : String(error) },
					'Analyse command failed'
				);
				process.exit(1);
			}
		});

	program
		.command('detect <file>')
		.description('Detect the format of a specific image file')
		.action(async filePath => {
			const logger = initLogger(false);
			try {
				const targetPath = path.resolve(filePath);

				if (!(await fsExtra.pathExists(targetPath))) {
					logger.error({ targetPath }, 'File does not exist');
					process.exit(1);
				}

				const stats = await fs.promises.stat(targetPath);
				if (!stats.isFile()) {
					logger.error({ targetPath }, 'Path is not a file');
					process.exit(1);
				}

				const detector = new ImageFormatDetector(config);
				const result = await detector.detectImageFormat(targetPath);
				await detector.cleanup();
				logger.info(
					{
						file: path.basename(targetPath),
						originalExtension: result.originalExtension,
						detectedExtension: result.detectedExtension,
						mimeType: result.detectedMimeType,
						method: result.method,
						confidence: result.confidence,
						needsRename: result.needsRename,
					},
					'Detection results'
				);

				process.exit(0);
			} catch (error) {
				logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Detection failed');
				process.exit(1);
			}
		});

	program
		.command('check-deps')
		.description('Check if required dependencies are available')
		.action(async () => {
			const logger = initLogger(false);
			try {
				// Test file-type library
				try {
					await import('file-type');
					logger.info('file-type library available');
				} catch (error) {
					logger.error(
						{ error: error instanceof Error ? error.message : String(error) },
						'file-type library missing or failed to load'
					);
				}

				// Test Sharp library
				try {
					const sharp = (await import('sharp')).default;
					// Create a simple test image buffer to verify Sharp works
					await sharp({
						create: { width: 1, height: 1, channels: 3, background: { r: 0, g: 0, b: 0 } },
					})
						.png()
						.toBuffer();
					logger.info('Sharp library available and working');
				} catch (error) {
					logger.error(
						{ error: error instanceof Error ? error.message : String(error) },
						'Sharp library not available or failed'
					);
				}

				logger.info('Dependency checks complete');
			} catch (error) {
				logger.error(
					{ error: error instanceof Error ? error.message : String(error) },
					'Dependency check failed'
				);
				process.exit(1);
			}
		});

	program.action(async () => {
		const logger = initLogger(false);
		logger.info('Image sanitiser help requested');
		program.help();
	});

	return program;
}

process.on('unhandledRejection', error => {
	const config = loadConfig();
	const logger = createLogger({
		level: config.logging.level,
		verbose: config.logging.verbose,
		file: config.logging.file,
		maxFileSizeMb: config.logging.maxFileSizeMb,
		maxFiles: config.logging.maxFiles,
	});
	logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Unhandled rejection');
	process.exit(1);
});

process.on('SIGINT', () => {
	const config = loadConfig();
	const logger = createLogger({
		level: config.logging.level,
		verbose: config.logging.verbose,
		file: config.logging.file,
		maxFileSizeMb: config.logging.maxFileSizeMb,
		maxFiles: config.logging.maxFiles,
	});
	logger.warn('Operation interrupted by user');
	process.exit(130);
});

/* c8 ignore start */
if (process.argv[1] === fileURLToPath(import.meta.url)) {
	createProgram().parse(process.argv);
}

/* c8 ignore stop */

export { createProgram };
