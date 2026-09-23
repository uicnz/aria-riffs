#!/usr/bin/env bun

/**
 * Main CLI for Doc Decomposer Riff
 *
 * This riff decomposes RFP documents into individual request/response pairs,
 * organized by category and department with full metadata tracking.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import packageManifest from '../package.json' with { type: 'json' };
import { type ExtendedConfig, runDecompose } from './core/run-decompose.js';
import { CONFIG_PATHS, loadConfig } from './lib/config.js';
import { createLogger } from './lib/logger.js';

/**
 * Create and configure the CLI program
 */
function createProgram(): Command {
	const program = new Command();

	program.name('doc-decomposer').description(packageManifest.description).version(packageManifest.version);

	// Default decompose command (runs when called with positional args or flags)
	program
		.command('decompose', { isDefault: true })
		.description('Decompose an RFP document into structured files')
		.argument('[metadata]', 'Path to metadata classification file')
		.argument('[rfp]', 'Path to RFP markdown file')
		.argument('[output]', 'Output directory')
		.option('-m, --metadata <file>', 'Path to metadata classification file')
		.option('-r, --rfp <file>', 'Path to RFP markdown file')
		.option('-o, --output <dir>', 'Output directory', CONFIG_PATHS.OUTPUT_DIR)
		.option('-d, --descriptions <dir>', 'Directory containing description files', CONFIG_PATHS.DESCRIPTIONS_DIR)
		.option('-v, --verbose', 'Enable verbose logging output')
		.action(async (metadataArg, rfpArg, outputArg, opts) => {
			const appConfig = loadConfig();
			const logger = createLogger({
				level: appConfig.logging.level,
				verbose: opts.verbose ?? appConfig.logging.verbose,
				file: appConfig.logging.file,
				maxFileSizeMb: appConfig.logging.maxFileSizeMb,
				maxFiles: appConfig.logging.maxFiles,
			});

			// Handle positional arguments or flags
			const metadataFile = metadataArg || opts.metadata;
			const rfpFile = rfpArg || opts.rfp;
			const outputDir = outputArg || opts.output;

			// Validate required arguments
			if (!metadataFile || !rfpFile) {
				logger.error(
					'Missing required arguments. Usage: doc-decomposer <metadata> <rfp> [output] or -m <metadata> -r <rfp> [-o <output>]'
				);
				process.exit(1);
			}

			const config: ExtendedConfig = {
				metadataFile: path.resolve(metadataFile),
				rfpFile: path.resolve(rfpFile),
				outputDir: path.resolve(outputDir),
				descriptionsDir: path.resolve(opts.descriptions),
				verbose: opts.verbose ?? false,
			};

			try {
				await runDecompose(config);
			} catch (error) {
				logger.error({ error }, 'doc-decomposer failed');
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
