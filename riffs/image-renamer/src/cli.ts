#!/usr/bin/env bun

/**
 * CLI interface for image renamer
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import * as fsExtra from 'fs-extra';
import type { Logger } from 'pino';
import packageManifest from '../package.json' with { type: 'json' };
import { FilenameGenerator } from './core/filename-generator.js';
import { ImageRenamer } from './core/rename-images.js';
import { ImageWatcher } from './core/watch-files.js';
import { DatabaseManager } from './db/database.js';
import { loadConfig } from './lib/config.js';
import { createLogger } from './lib/logger.js';

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
}

/**
 * Create and configure the CLI program
 */
function createProgram(): ProgramWithDatabaseManager {
	// Load config once at startup
	const appConfig = loadConfig();

	/**
	 * Initialize logger with configuration and verbose flag
	 */
	function initLogger(verbose: boolean): Logger {
		return createLogger({
			level: appConfig.logging.level,
			verbose: verbose || appConfig.logging.verbose,
			file: appConfig.logging.file,
			maxFileSizeMb: appConfig.logging.maxFileSizeMb,
			maxFiles: appConfig.logging.maxFiles,
		});
	}

	/**
	 * Get the current provider name from configuration
	 */
	function getCurrentProvider(): string {
		return appConfig['image-renamer'].llm.provider;
	}

	const program = new Command() as ProgramWithDatabaseManager;

	program.setDatabaseManager = function (dbManager) {
		this.databaseManager = dbManager;
	};

	program.name('image-renamer').description(packageManifest.description).version(packageManifest.version);

	program
		.command('rename <path>')
		.description('Rename images using AI-generated descriptions')
		.option('-r, --recursive', 'Process subdirectories recursively')
		.option('--prompt <text>', 'Custom prompt for AI description generation')
		.option('--dry-run', 'Show what would be renamed without actually renaming files')
		.option('--verbose', 'Enable verbose logging')
		.action(async (pathArg, options) => {
			try {
				const targetPath = path.resolve(pathArg);

				if (!(await fsExtra.pathExists(targetPath))) {
					const logger = initLogger(options.verbose || false);
					logger.error({ targetPath }, 'Path does not exist');
					process.exit(1);
				}

				const logger = initLogger(options.verbose || false);
				logger.info({ targetPath, options }, 'Starting rename command');

				const llmClient = new FilenameGenerator(appConfig);
				const dbManager = new DatabaseManager(appConfig);
				const renamer = new ImageRenamer(logger, llmClient, dbManager, appConfig);

				// Test connection first (unless dry run)
				if (!options.dryRun) {
					logger.info({ provider: getCurrentProvider() }, 'Testing provider connection');
					if (!(await renamer.testConnection())) {
						logger.error({ provider: getCurrentProvider() }, 'Cannot connect to provider API');
						logger.error('Use check-connection for details');
						process.exit(1);
					}
					logger.info({ provider: getCurrentProvider() }, 'Provider connection successful');
				}

				// Process single file or directory
				const stats = await fs.promises.stat(targetPath);

				if (stats.isFile()) {
					const success = await renamer.renameSingleImage(targetPath, options.dryRun, options.prompt);
					process.exit(success ? 0 : 1);
				}

				if (stats.isDirectory()) {
					const results = await renamer.renameDirectory(targetPath, {
						recursive: options.recursive,
						dryRun: options.dryRun,
						showProgress: true,
						customPrompt: options.prompt,
					});

					const action = options.dryRun ? 'analyzed' : 'renamed';
					logger.info(
						{
							action,
							totalFiles: results.total_files,
							processed: results.processed,
							failed: results.failed,
							skipped: results.skipped,
							processingTimeSeconds: results.processing_time,
						},
						'Processing summary'
					);

					if (results.failed > 0) {
						for (const error of results.errors) {
							logger.error({ error }, 'Processing error');
						}
						process.exit(1);
					}

					const successMsg = options.dryRun ? 'Analysis complete!' : 'All images processed successfully!';
					logger.info(successMsg);
					process.exit(0);
				}

				logger.error({ targetPath }, 'Path is neither a file nor directory');
				process.exit(1);
			} catch (error) {
				const logger = initLogger(options.verbose || false);
				logger.error(
					{ error: error instanceof Error ? error.message : String(error) },
					'Rename command failed'
				);
				process.exit(1);
			}
		});

	program
		.command('watch <path>')
		.description('Watch directory for new images and rename them automatically')
		.option('-r, --recursive', 'Watch subdirectories recursively')
		.option('--stop-on-error', 'Stop watching if processing fails')
		.option('--verbose', 'Enable verbose logging')
		.action(async (pathArg, options) => {
			try {
				const targetPath = path.resolve(pathArg);
				if (!(await fsExtra.pathExists(targetPath))) {
					const logger = initLogger(options.verbose || false);
					logger.error({ targetPath }, 'Path does not exist');
					process.exit(1);
				}

				const stats = await fs.promises.stat(targetPath);
				if (!stats.isDirectory()) {
					const logger = initLogger(options.verbose || false);
					logger.error({ targetPath }, 'Path is not a directory');
					process.exit(1);
				}

				const logger = initLogger(options.verbose || false);
				logger.info({ targetPath, options }, 'Starting watch command');

				const llmClient = new FilenameGenerator(appConfig);
				const dbManager = new DatabaseManager(appConfig);
				const watcher = new ImageWatcher(logger, appConfig, {
					llmClient,
					databaseManager: dbManager,
					recursive: options.recursive,
					quiet: false,
					stopOnError: options.stopOnError,
				});

				await watcher.startWatching(targetPath);
				process.exit(0);
			} catch (error) {
				const logger = initLogger(options.verbose || false);
				logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Watch command failed');
				process.exit(1);
			}
		});

	program
		.command('check-connection')
		.description('Test connection to configured LLM API')
		.action(async () => {
			const logger = initLogger(false);
			try {
				const llmClient = new FilenameGenerator(appConfig);
				const provider = getCurrentProvider();

				logger.info(
					{ provider, endpoint: llmClient.endpointUrl, model: llmClient.modelName },
					'Testing connection'
				);

				if (await llmClient.testConnection()) {
					logger.info({ provider }, 'Connection successful');
				} else {
					logger.error({ provider }, 'Failed to connect to provider API');
					if (provider === 'ollama') {
						logger.info('Ensure Ollama is installed and running');
						logger.info({ model: llmClient.modelName }, 'Check that the model is available');
					} else if (provider === 'anthropic') {
						logger.info('Ensure ANTHROPIC_API_KEY environment variable is set');
						logger.info('Check that your API key is valid');
						logger.info('Verify your internet connection');
					}
					process.exit(1);
				}
			} catch (error) {
				logger.error(
					{ error: error instanceof Error ? error.message : String(error) },
					'Connection test failed'
				);
				process.exit(1);
			}
		});

	program
		.command('list-models')
		.description('List available models from the current LLM provider')
		.action(async () => {
			const logger = initLogger(false);
			try {
				const llmClient = new FilenameGenerator(appConfig);
				const provider = getCurrentProvider();
				logger.info({ provider }, 'Listing available models');

				const models = await llmClient.listModels();

				if (models.length === 0) {
					logger.warn({ provider }, 'No models found');
					return;
				}

				models.forEach(model => {
					// Handle model name matching with/without :latest suffix
					const normalizedModelName = model.name.endsWith(':latest') ? model.name.slice(0, -7) : model.name;
					const normalizedCurrentModel = llmClient.modelName.endsWith(':latest')
						? llmClient.modelName.slice(0, -7)
						: llmClient.modelName;
					const isCurrent =
						model.name === llmClient.modelName || normalizedModelName === normalizedCurrentModel;
					logger.info({ model: model.name, isCurrent }, 'Available model');

					if (provider === 'ollama' && model.size) {
						const sizeGB = (model.size / 1024 ** 3).toFixed(2);
						logger.info({ model: model.name, sizeGb: sizeGB }, 'Model size');
					}
				});

				logger.info({ count: models.length }, 'Model listing complete');
			} catch (error) {
				logger.error(
					{ error: error instanceof Error ? error.message : String(error) },
					'Failed to list models'
				);
				process.exit(1);
			}
		});

	program.option('--quiet', 'Suppress progress bars and non-essential output').action(async () => {
		const logger = initLogger(false);
		logger.info('Image renamer help requested');
		program.help();
	});

	return program;
}

process.on('unhandledRejection', error => {
	const appConfig = loadConfig();
	const logger = createLogger({
		level: appConfig.logging.level,
		verbose: appConfig.logging.verbose,
		file: appConfig.logging.file,
		maxFileSizeMb: appConfig.logging.maxFileSizeMb,
		maxFiles: appConfig.logging.maxFiles,
	});
	logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Unhandled rejection');
	process.exit(1);
});

process.on('SIGINT', () => {
	const appConfig = loadConfig();
	const logger = createLogger({
		level: appConfig.logging.level,
		verbose: appConfig.logging.verbose,
		file: appConfig.logging.file,
		maxFileSizeMb: appConfig.logging.maxFileSizeMb,
		maxFiles: appConfig.logging.maxFiles,
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
