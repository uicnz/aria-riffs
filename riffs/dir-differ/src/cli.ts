#!/usr/bin/env bun

/**
 * Aria Dir Differ CLI - Command-line interface for directory comparison
 */

import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import type { Logger } from 'pino';
import { compareDirectories } from './core/compare-dirs.js';
import { loadConfig } from './lib/config.js';
import { createLogger } from './lib/logger.js';
import type { DiffOptions } from './lib/types.js';

/**
 * Initialize the logger with configuration
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
 * Function to collect multiple exclude patterns
 */
function collectExcludes(value: string, previous: string[]): string[] {
	return previous.concat([value]);
}

/**
 * Create and configure the CLI program
 */
function createProgram(): Command {
	const program = new Command();

	program
		.name('dir-differ')
		.description('Aria Dir Differ - Compare two directories with colorful output')
		.version('1.0.0')
		.arguments('<dir1> <dir2>')
		.option('-e, --exclude <pattern>', 'Exclude files matching pattern', collectExcludes, [])
		.option('-c, --content', 'Show content differences for changed files')
		.option('-s, --summary-only', 'Show only the summary, not individual files')
		.option('--no-color', 'Disable colored output')
		.option('-v, --verbose', 'Enable verbose logging output')
		.action(async (dir1: string, dir2: string, options) => {
			const logger = initLogger(options.verbose || false);
			logger.debug({ dir1, dir2, options }, 'Starting directory comparison');

			try {
				const diffOptions: DiffOptions = {
					exclude: options.exclude || [],
					content: options.content || false,
					summaryOnly: options.summaryOnly || false,
					color: options.color !== false,
				};

				logger.info({ dir1, dir2, excludePatterns: diffOptions.exclude }, 'Comparing directories');
				const areIdentical = await compareDirectories({ dir1, dir2 }, diffOptions, logger);

				logger.info({ areIdentical }, 'Comparison completed');
				// Exit with appropriate code
				process.exit(areIdentical ? 0 : 1);
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Unknown error';
				logger.error({ error: errorMessage }, 'Comparison failed');
				process.exit(1);
			}
		});

	return program;
}

/* c8 ignore start */
if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const program = createProgram();

	// Validate arguments
	if (process.argv.length < 4) {
		process.stderr.write('Error: You must specify two directories to compare\n');
		program.help();
	}

	program.parse();
}
/* c8 ignore stop */
