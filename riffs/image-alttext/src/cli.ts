#!/usr/bin/env bun

/**
 * Aria Image Alttext CLI - Command-line interface for alt text processing
 */

import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import type { Logger } from 'pino';
import { processMarkdownFile } from './core/process-md.js';
import { type ImageAlttextConfig, loadConfig } from './lib/config.js';
import { createLogger } from './lib/logger.js';

/**
 * Create and configure the CLI program
 */
function createProgram(): Command {
	// Module-level config loaded once via preAction hook
	let config: ImageAlttextConfig;

	/**
	 * Initialize logger with config and CLI verbose flag override
	 */
	function initLogger(cliVerbose: boolean): Logger {
		return createLogger({
			level: config.logging.level,
			verbose: cliVerbose || config.logging.verbose,
			file: config.logging.file,
			maxFileSizeMb: config.logging.maxFileSizeMb,
			maxFiles: config.logging.maxFiles,
		});
	}

	const program = new Command();

	program
		.name('image-alttext')
		.description('Aria Image Alttext - Process markdown files to add alt text from figure captions')
		.version('1.0.0')
		.hook('preAction', () => {
			config = loadConfig();
		});

	program
		.command('process')
		.description('Process a markdown file to add alt text from figure captions')
		.argument('<file>', 'Path to markdown file to process')
		.option('-v, --verbose', 'Show detailed processing information')
		.option('-d, --dry-run', 'Show what would be changed without writing to file')
		.action(async (file: string, options) => {
			const riff = config['image-alttext'];
			const verbose = options.verbose || riff.verbose;
			const dryRun = options.dryRun || riff.dryRun;
			const logger = initLogger(verbose);

			try {
				logger.info({ file, dryRun }, 'Starting alt text processing');

				const result = await processMarkdownFile(
					file,
					{
						verbose,
						dryRun,
					},
					logger
				);

				if (result.success) {
					if (dryRun) {
						logger.info({ file, matchCount: result.matchCount }, 'Would update images with alt text');
					} else {
						logger.info({ file, matchCount: result.matchCount }, 'Updated images with alt text');
					}
					process.exit(0);
				} else {
					logger.error({ file }, 'Processing failed');
					process.exit(1);
				}
			} catch (error) {
				const message = error instanceof Error ? error.message : 'Unknown error';
				logger.error({ file, error: message }, 'Processing error');
				process.exit(1);
			}
		});

	program
		.command('analyze')
		.description('Analyze a markdown file for image patterns without making changes')
		.argument('<file>', 'Path to markdown file to analyze')
		.option('-v, --verbose', 'Show detailed logging output')
		.action(async (file: string, options) => {
			const verbose = options.verbose || config['image-alttext'].verbose;
			const logger = initLogger(verbose);

			try {
				logger.info({ file }, 'Starting file analysis');

				const result = await processMarkdownFile(
					file,
					{
						verbose: true,
						dryRun: true,
					},
					logger
				);

				logger.info({ file, matchCount: result.matchCount }, 'Analysis results');

				if (result.matchCount === 0) {
					logger.info(
						'No changes would be made. Possible causes: no images without alt text, no matching figure captions, or images already have alt text.'
					);
				}

				logger.info({ file, matchCount: result.matchCount }, 'Analysis completed');
				process.exit(0);
			} catch (error) {
				const message = error instanceof Error ? error.message : 'Unknown error';
				logger.error({ file, error: message }, 'Analysis error');
				process.exit(1);
			}
		});

	return program;
}

/* c8 ignore start */
if (process.argv[1] === fileURLToPath(import.meta.url)) {
	createProgram().parse();
}
/* c8 ignore stop */
