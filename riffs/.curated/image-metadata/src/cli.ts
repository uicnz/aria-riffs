#!/usr/bin/env bun

/**
 * CLI interface for image meta processor
 */

import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import type { Logger } from 'pino';
import packageManifest from '../package.json' with { type: 'json' };
import { ImageMetadata } from './core/create-metadata.js';
import { DescriptionGenerator } from './core/description-generator.js';
import { DatabaseManager } from './db/database.js';
import { loadConfig } from './lib/config.js';
import { createLogger, type LoggerOptions } from './lib/logger.js';
import { ProgressLogger } from './utils/progress-logger.js';

/**
 * Create and configure the CLI program
 */
function createProgram(): Command {
	// Load config once at startup
	const appConfig = loadConfig();

	// Create shorthand for riff-specific config (under the wrapper)
	const riff = appConfig['image-metadata'];

	/**
	 * Get the current provider name from configuration
	 */
	function getCurrentProvider(): string {
		return riff.llm.provider;
	}

	// Module-level logger instance
	let logger: Logger;

	/**
	 * Initialize the Pino logger with configuration
	 */
	function initializeLogger(verbose: boolean = false): Logger {
		const loggerOptions: LoggerOptions = {
			level: appConfig.logging.level,
			verbose: verbose || appConfig.logging.verbose,
			file: appConfig.logging.file,
			maxFileSizeMb: appConfig.logging.maxFileSizeMb,
			maxFiles: appConfig.logging.maxFiles,
		};
		return createLogger(loggerOptions);
	}

	const program = new Command();

	program
		.name('image-metadata')
		.description(packageManifest.description)
		.version(packageManifest.version)
		.option('-v, --verbose', 'Enable verbose (debug) logging')
		.hook('preAction', thisCommand => {
			const opts = thisCommand.opts();
			logger = initializeLogger(opts['verbose'] as boolean);
			logger.debug('Logger initialized');
		});

	program
		.command('process')
		.description('Process images and generate Agent managed metadata descriptions')
		.argument('[path]', 'Directory or single image file to process (default: ./images)')
		.option('-d, --directory <path>', 'Directory containing images to process')
		.option('-f, --force', 'Force regeneration of metadata even if already processed')
		.option('--no-sanitize', 'Skip filename sanitization step')
		.option('--no-progress', 'Disable progress bar')
		.action(async (inputPath, options) => {
			try {
				const targetPath = path.resolve(options.directory || inputPath || riff.paths.input.dir);

				// Check if target is a file or directory
				const stats = await import('node:fs/promises').then(fs => fs.stat(targetPath));
				const isFile = stats.isFile();
				const isDirectory = stats.isDirectory();

				if (!isFile && !isDirectory) {
					logger.error({ targetPath }, 'Path is neither a file nor directory');
					process.exit(1);
				}

				if (isFile) {
					logger.info({ targetPath, type: 'file' }, 'Starting processing');
				} else {
					logger.info({ targetPath, type: 'directory' }, 'Starting processing');
				}

				const llmClient = new DescriptionGenerator();
				const database = new DatabaseManager();
				const progressLogger = new ProgressLogger();
				const imageMetadata = new ImageMetadata(llmClient, database, progressLogger, logger);

				const provider = getCurrentProvider();
				logger.info({ provider }, 'Testing LLM connection');
				if (!(await llmClient.testConnection())) {
					logger.error(
						{ provider, model: llmClient.modelName, endpoint: llmClient.endpointUrl },
						'LLM connection failed'
					);
					logger.error('Please ensure the LLM service is properly configured');
					process.exit(1);
				}
				logger.info({ provider, model: llmClient.modelName }, 'LLM connection successful');

				let results: Awaited<
					ReturnType<typeof imageMetadata.processSingleFile | typeof imageMetadata.processDirectory>
				>;
				if (isFile) {
					// Process single file
					results = await imageMetadata.processSingleFile(targetPath, {
						force: options.force || false,
					});
				} else {
					// Process directory
					results = await imageMetadata.processDirectory(targetPath, {
						sanitizeNames: !options.noSanitize,
						showProgress: !options.noProgress,
						force: options.force || false,
					});
				}

				logger.info({ results }, 'Processing complete');
				logger.info(
					{
						totalFiles: results.total_files,
						processed: results.processed,
						failed: results.failed,
						renamed: results.renamed,
						processingTimeSeconds: results.processing_time,
					},
					'Processing summary'
				);

				if (results.failed > 0) {
					for (const error of results.errors) {
						logger.error({ error }, 'Processing error');
					}
					await database.close();
					process.exit(1);
				}

				logger.info('All images processed successfully');
				await database.close();
			} catch (error) {
				logger.error(
					{ error: error instanceof Error ? error.message : String(error) },
					'Process command failed'
				);
				process.exit(1);
			}
		});

	program
		.command('check-connection')
		.description('Test connection to configured LLM API')
		.action(async () => {
			const logger = initializeLogger();
			try {
				const llmClient = new DescriptionGenerator();
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
			const logger = initializeLogger();
			try {
				const llmClient = new DescriptionGenerator();
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

	program
		.command('db-stats')
		.description('Show database statistics')
		.action(async () => {
			const logger = initializeLogger();
			try {
				const database = new DatabaseManager();

				// Get stats directly from database manager
				const recordCount = await database.countRecords();
				const recentRecords = (await database.getAllDescriptions()).slice(0, 5);
				const stats = {
					path: database.databasePath,
					recordCount,
					recentRecords,
				};

				logger.info({ path: stats.path, recordCount: stats.recordCount }, 'Database statistics');

				if (stats.recentRecords.length > 0) {
					stats.recentRecords.forEach(record => {
						logger.info({ file: path.basename(record.file_path) }, 'Recent database entry');
					});
				}

				database.close();
			} catch (error) {
				logger.error(
					{ error: error instanceof Error ? error.message : String(error) },
					'Failed to get database statistics'
				);
				process.exit(1);
			}
		});

	program.action(async () => {
		const logger = initializeLogger();
		logger.info('Image meta processor help requested');
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
