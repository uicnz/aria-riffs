#!/usr/bin/env bun

/**
 * CLI interface for image OCR riff
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import * as fsExtra from 'fs-extra';
import type { Logger } from 'pino';
import { ImageOcr } from './core/ocr.js';
import { configPath, loadConfig } from './lib/config.js';
import { createLogger } from './lib/logger.js';
import type { ImageOcrConfig, ImageOcrRiffConfig } from './lib/schema.js';

/**
 * Initialize and return a Pino logger based on config and verbose flag
 */
function initLogger(verbose: boolean, appConfig: ImageOcrConfig): Logger {
	const logger = createLogger({
		level: appConfig.logging.level,
		verbose: verbose || appConfig.logging.verbose,
		file: appConfig.logging.file,
		maxFileSizeMb: appConfig.logging.maxFileSizeMb,
		maxFiles: appConfig.logging.maxFiles,
	});
	logger.debug('Logger initialized');
	return logger;
}

/**
 * Create a config copy with CLI overrides applied
 */
function applyCliOverrides(
	baseConfig: ImageOcrRiffConfig,
	overrides: { language?: string; confidence?: number }
): ImageOcrRiffConfig {
	const config = structuredClone(baseConfig);

	if (overrides.language) {
		config.ocr.language = overrides.language;
	}
	if (overrides.confidence !== undefined) {
		config.ocr.confidenceThreshold = overrides.confidence;
	}

	return config;
}

/**
 * Create and configure the CLI program
 */
export function createProgram(): Command {
	const program = new Command();

	program.name('image-ocr').description('Extract text from images and PDFs using OCR').version('1.0.0');

	program
		.command('process <path>')
		.description('Extract text from images/PDFs and save as markdown')
		.option('-r, --recursive', 'Process subdirectories recursively')
		.option('--force', 'Overwrite existing output files')
		.option('--verbose', 'Enable verbose logging')
		.option('--language <lang>', 'OCR language code (default: eng)')
		.option('--confidence <threshold>', 'Minimum confidence threshold (0-1)')
		.action(async (pathArg, options) => {
			const appConfig = loadConfig();
			const riff = appConfig['image-ocr'];
			const logger = initLogger(options.verbose, appConfig);

			try {
				const targetPath = path.resolve(pathArg);

				logger.info({ targetPath }, 'Starting OCR processing');

				if (!(await fsExtra.pathExists(targetPath))) {
					logger.error({ targetPath }, 'Path does not exist');
					process.exit(1);
				}

				// Parse and validate CLI overrides
				let confidenceValue: number | undefined;
				if (options.confidence) {
					const threshold = parseFloat(options.confidence);
					if (Number.isNaN(threshold) || threshold < 0 || threshold > 1) {
						logger.error({ confidence: options.confidence }, 'Invalid confidence threshold');
						process.exit(1);
					}
					confidenceValue = threshold;
					logger.debug({ confidence: threshold }, 'Confidence threshold override applied');
				}

				if (options.language) {
					logger.debug({ language: options.language }, 'Language override applied');
				}

				// Create config with CLI overrides
				const overrides: { language?: string; confidence?: number } = {};
				if (options.language) {
					overrides.language = options.language;
				}
				if (confidenceValue !== undefined) {
					overrides.confidence = confidenceValue;
				}
				const runtimeConfig = applyCliOverrides(riff, overrides);

				const processor = new ImageOcr(logger, runtimeConfig);
				const stats = await fs.promises.stat(targetPath);

				if (stats.isFile()) {
					logger.info({ targetPath }, 'Processing single file');
					const result = await processor.processSingleFile(targetPath, options.force);

					if (result.success) {
						logger.info({ outputPath: result.outputPath }, 'Processing complete');
						process.exit(0);
					} else {
						logger.error({ error: result.error }, 'Processing failed');
						process.exit(1);
					}
				}

				if (stats.isDirectory()) {
					const results = await processor.processDirectory(targetPath, {
						recursive: options.recursive,
						showProgress: true,
						force: options.force,
					});

					logger.info(
						{
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

					logger.info('All files processed successfully');
					process.exit(0);
				}

				logger.error({ targetPath }, 'Path is neither a file nor directory');
				process.exit(1);
			} catch (error) {
				logger.error(
					{ error: error instanceof Error ? error.message : String(error) },
					'Process command failed'
				);
				process.exit(1);
			}
		});

	program
		.command('check-setup')
		.description('Check if OCR dependencies are available')
		.option('--verbose', 'Enable verbose logging')
		.action(async options => {
			const appConfig = loadConfig();
			const riff = appConfig['image-ocr'];
			const logger = initLogger(options.verbose, appConfig);

			try {
				logger.info('Starting setup check');

				// Test scribe.js import
				try {
					// @ts-expect-error - scribe.js-ocr doesn't have types
					await import('scribe.js-ocr');
					logger.info('OCR runtime package available');
				} catch {
					logger.error('OCR runtime package missing from Aria package store');
					process.exit(1);
				}

				// Check config file
				if (await fsExtra.pathExists(configPath)) {
					logger.info({ configPath }, 'Configuration file found');
				} else {
					logger.warn({ configPath }, 'Configuration file not found, using defaults');
				}

				// Test basic OCR functionality
				logger.info('Testing basic OCR functionality');

				// We can't easily test without a sample image, so just check if we can create the processor
				try {
					new ImageOcr(logger, riff);
					logger.info('OCR processor initialized successfully');
				} catch (error) {
					logger.error(
						{ error: error instanceof Error ? error.message : String(error) },
						'OCR processor failed to initialize'
					);
					process.exit(1);
				}

				logger.info('All setup checks passed');
				process.exit(0);
			} catch (error) {
				logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Setup check failed');
				process.exit(1);
			}
		});

	program
		.command('config')
		.description('Show current configuration')
		.action(() => {
			const appConfig = loadConfig();
			const riff = appConfig['image-ocr'];
			const logger = initLogger(false, appConfig);
			logger.info(
				{
					ocr: riff.ocr,
					output: riff.output,
					processing: riff.processing,
					files: {
						maxFileSizeMb: riff.files.maxFileSizeMb,
						supportedExtensions: riff.files.supportedExtensions,
						databaseDir: riff.paths.database.dir,
					},
					logging: appConfig.logging,
				},
				'Current configuration'
			);
		});

	return program;
}

process.on('unhandledRejection', error => {
	const appConfig = loadConfig();
	const logger = initLogger(false, appConfig);
	logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Unhandled rejection');
	process.exit(1);
});

process.on('SIGINT', () => {
	const appConfig = loadConfig();
	const logger = initLogger(false, appConfig);
	logger.warn('Operation interrupted by user');
	process.exit(130);
});

/* c8 ignore start */
if (process.argv[1] === fileURLToPath(import.meta.url)) {
	createProgram().parse(process.argv);
}
/* c8 ignore stop */
