#!/usr/bin/env bun

import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import type { Logger } from 'pino';
import { ChatSessionCommand } from './core/chat-session.js';
import { ComposeImagesCommand } from './core/compose-images.js';
import { EditImageCommand } from './core/edit-image.js';
import { GenerateImageCommand } from './core/generate-image.js';
import { loadConfig } from './lib/config.js';
import { createLogger } from './lib/logger.js';
import type { ImageGeneratorConfig, ImageGeneratorRiffConfig } from './lib/schema.js';
import { resolveOutputPath } from './utils/utils.js';

/**
 * Create and configure the CLI program
 */
function createProgram(): Command {
	let logger: Logger;
	let config: ImageGeneratorConfig;
	let riff: ImageGeneratorRiffConfig;

	const program = new Command();

	program
		.name('image-generator')
		.description('Image Generator Riff - ARIA Platform')
		.version('1.0.0')
		.option('-c, --config <path>', 'Path to configuration file')
		.option('-v, --verbose', 'Enable verbose logging')
		.option('--log-level <level>', 'Set log level (TRACE, DEBUG, INFO, WARN, ERROR)')
		.hook('preAction', thisCommand => {
			// Load configuration
			const opts = thisCommand.opts();
			config = loadConfig(opts.config);
			riff = config['image-generator'];

			// Override logging config with CLI options
			if (opts.verbose) {
				config.logging.verbose = true;
			}
			if (opts.logLevel) {
				const level = opts.logLevel.toLowerCase();
				if (['trace', 'debug', 'info', 'warn', 'error', 'fatal'].includes(level)) {
					config.logging.level = level as 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
				}
			}

			// Initialize logger
			logger = createLogger({
				level: config.logging.level,
				verbose: config.logging.verbose,
				file: config.logging.file,
				maxFileSizeMb: config.logging.maxFileSizeMb,
				maxFiles: config.logging.maxFiles,
			});

			logger.debug({ config: riff }, 'Configuration loaded');
		});

	// Generate command
	program
		.command('generate')
		.description('Generate an image from a text prompt')
		.argument('<prompt>', 'Text prompt for image generation')
		.argument('[output]', 'Output file path (auto-generated if not provided)')
		.option('-m, --model <model>', 'Gemini model to use')
		.option('-a, --aspect <ratio>', 'Aspect ratio (1:1, 16:9, 9:16, 4:3, 3:4)')
		.option('-s, --size <size>', 'Image size (1K, 2K, 4K)')
		.option('-o, --output-dir <dir>', 'Output directory for auto-named files')
		.option('-n, --count <number>', 'Number of variations to generate', '1')
		.action(async (prompt, output, options) => {
			try {
				const cmd = new GenerateImageCommand(riff, logger);
				const count = Number.parseInt(options.count, 10);
				if (Number.isNaN(count) || count < 1) {
					throw new Error('Count must be a positive integer');
				}

				if (count === 1) {
					const resolvedPath = resolveOutputPath(
						output,
						options.outputDir,
						riff.output,
						riff.paths.output.dir,
						'generate'
					);
					await cmd.execute(prompt, resolvedPath, options);
				} else {
					// Batch mode: generate multiple variations
					for (let i = 1; i <= count; i++) {
						const resolvedPath = resolveOutputPath(
							output,
							options.outputDir,
							riff.output,
							riff.paths.output.dir,
							'generate',
							i
						);
						logger.info({ variation: i, totalVariations: count }, 'Generating variation');
						await cmd.execute(prompt, resolvedPath, options);
					}
				}
			} catch (error) {
				logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Command failed');
				process.exit(1);
			}
		});

	// Edit command
	program
		.command('edit')
		.description('Edit an existing image using AI')
		.argument('<input>', 'Input image path')
		.argument('<instruction>', 'Edit instruction')
		.argument('[output]', 'Output file path (auto-generated if not provided)')
		.option('-m, --model <model>', 'Gemini model to use')
		.option('-a, --aspect <ratio>', 'Aspect ratio')
		.option('-s, --size <size>', 'Image size')
		.option('-o, --output-dir <dir>', 'Output directory for auto-named files')
		.action(async (input, instruction, output, options) => {
			try {
				const cmd = new EditImageCommand(riff, logger);
				const resolvedPath = resolveOutputPath(
					output,
					options.outputDir,
					riff.output,
					riff.paths.output.dir,
					'edit'
				);
				await cmd.execute(input, instruction, resolvedPath, options);
			} catch (error) {
				logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Command failed');
				process.exit(1);
			}
		});

	// Compose command
	program
		.command('compose')
		.description('Compose multiple images into a new image')
		.argument('<instruction>', 'Composition instruction')
		.argument('<images...>', 'Input image paths (use -o for output location)')
		.option('-m, --model <model>', 'Gemini model to use')
		.option('-a, --aspect <ratio>', 'Aspect ratio')
		.option('-s, --size <size>', 'Image size')
		.option('-o, --output-dir <dir>', 'Output directory for auto-named files')
		.option('--output <path>', 'Explicit output file path')
		.action(async (instruction, images, options) => {
			try {
				const cmd = new ComposeImagesCommand(riff, logger);
				const resolvedPath = resolveOutputPath(
					options.output,
					options.outputDir,
					riff.output,
					riff.paths.output.dir,
					'compose'
				);
				await cmd.execute(instruction, resolvedPath, images, options);
			} catch (error) {
				logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Command failed');
				process.exit(1);
			}
		});

	// Chat command
	program
		.command('chat')
		.description('Start an interactive image generation chat session')
		.option('-m, --model <model>', 'Gemini model to use')
		.option('-o, --output-dir <dir>', 'Output directory for generated images')
		.action(async options => {
			try {
				const cmd = new ChatSessionCommand(riff, logger);
				await cmd.execute(options);
			} catch (error) {
				logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Command failed');
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
