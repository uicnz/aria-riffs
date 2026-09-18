/**
 * Pino logger configuration for vector-indexer riff
 */

import path from 'node:path';
import type { Level, Logger, LoggerOptions as PinoLoggerOptions, StreamEntry } from 'pino';
import pino from 'pino';
import type { LoggingConfig } from '../lib/types.js';

/**
 * Logger configuration options
 */
export interface LoggerOptions {
	level: string;
	verbose: boolean;
	silent?: boolean;
	file?: string;
	maxFileSizeMb?: number;
	maxFiles?: number;
}

/**
 * Create a Pino logger instance.
 */
export function createLogger(options: LoggerOptions): Logger {
	const logFile = path.resolve(process.cwd(), options.file || '.aria/logs/vector-indexer.log');
	const logLevel = (options.verbose ? 'debug' : options.level.toLowerCase()) as Level;

	const loggerOptions: PinoLoggerOptions = {
		level: logLevel,
	};

	const streams: StreamEntry[] = [
		{
			level: 'info',
			stream: pino.destination({
				dest: logFile,
				mkdir: true,
				sync: true,
				minLength: 0,
			}),
		},
	];

	if (!options.silent) {
		streams.push({
			level: options.verbose ? 'debug' : 'info',
			stream: pino.destination({ dest: 1, sync: true, minLength: 0 }),
		});
	}

	return pino(loggerOptions, pino.multistream(streams));
}

/**
 * Create logger from config
 */
export function createLoggerFromConfig(config: LoggingConfig): Logger {
	return createLogger({
		level: config.level,
		verbose: config.verbose,
		file: config.file,
		maxFileSizeMb: config.maxFileSizeMb,
		maxFiles: config.maxFiles,
	});
}
