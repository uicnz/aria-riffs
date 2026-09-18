#!/usr/bin/env bun
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import type { Logger } from 'pino';
import { ImageTranscoder } from './core/image-transcoder.js';
import { loadConfig } from './lib/config.js';
import { createLogger, type LoggerOptions } from './lib/logger.js';
import type { ImageTranscoderRiffConfig } from './lib/schema.js';

interface ProgramWithTranscoder extends Command {
	transcoder?: ImageTranscoder;
	setTranscoder(transcoder: ImageTranscoder): void;
}

export function createProgram(): ProgramWithTranscoder {
	const program = new Command() as ProgramWithTranscoder;

	program.setTranscoder = function (transcoder: ImageTranscoder) {
		this.transcoder = transcoder;
	};

	program.name('image-transcoder');

	program
		.command('process')
		.argument('<file-path>', 'Path to image file')
		.option('-o, --output <directory>', 'Output directory for transcoded files')
		.option('-v, --verbose', 'Enable verbose (debug) logging')
		.action(async (filePath: string, options: { output?: string; verbose?: boolean }) => {
			const config = loadConfig();
			const riffConfig: ImageTranscoderRiffConfig = config['image-transcoder'];
			if (options.output) {
				riffConfig.paths.output.dir = options.output;
			}

			// Create logger with CLI verbose flag override
			const loggerOptions: LoggerOptions = {
				level: config.logging.level,
				verbose: options.verbose || config.logging.verbose,
				file: config.logging.file,
				maxFileSizeMb: config.logging.maxFileSizeMb,
				maxFiles: config.logging.maxFiles,
			};
			const logger: Logger = createLogger(loggerOptions);

			logger.debug({ config }, 'Configuration loaded');

			const transcoder = program.transcoder ?? new ImageTranscoder(config, logger);
			const result = await transcoder.process(filePath);

			logger.info(
				{
					totalFiles: result.totalFiles,
					processed: result.processed,
					failed: result.failed,
					skipped: result.skipped,
				},
				'Processing complete'
			);

			if (result.failed > 0) {
				for (const r of result.results.filter(r => !r.success)) {
					logger.error({ file: r.inputPath, error: r.error }, 'Failed to process file');
				}
				process.exit(1);
			}
		});

	return program;
}

// We have a test that exercises this code, but the code coverage riff doesn't detect it because it is run in a separate process.
/* c8 ignore start */
if (process.argv[1] === fileURLToPath(import.meta.url)) {
	createProgram().parse(process.argv);
}
/* c8 ignore stop */
