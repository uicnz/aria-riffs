import { describe, expect, it } from 'vitest';
import { createLogger, type LoggerOptions } from '../../src/lib/logger.js';

describe('logger', () => {
	describe('createLogger', () => {
		it('creates a logger instance', () => {
			const options: LoggerOptions = {
				level: 'info',
				verbose: false,
			};

			const logger = createLogger(options);
			expect(logger).toBeDefined();
			expect(typeof logger.info).toBe('function');
			expect(typeof logger.error).toBe('function');
			expect(typeof logger.warn).toBe('function');
			expect(typeof logger.debug).toBe('function');
		});

		it('respects log level setting', () => {
			const options: LoggerOptions = {
				level: 'error',
				verbose: false,
			};

			const logger = createLogger(options);
			expect(logger.level).toBe('error');
		});

		it('enables debug level when verbose is true', () => {
			const options: LoggerOptions = {
				level: 'info',
				verbose: true,
			};

			const logger = createLogger(options);
			expect(logger.level).toBe('debug');
		});

		it('uses info level when verbose is false', () => {
			const options: LoggerOptions = {
				level: 'info',
				verbose: false,
			};

			const logger = createLogger(options);
			expect(logger.level).toBe('info');
		});

		it('accepts file option', () => {
			const options: LoggerOptions = {
				level: 'info',
				verbose: false,
				file: '.aria/logs/test/commit-formatter-test.log',
			};

			const logger = createLogger(options);
			expect(logger).toBeDefined();
		});

		it('accepts maxFileSizeMb option', () => {
			const options: LoggerOptions = {
				level: 'info',
				verbose: false,
				maxFileSizeMb: 20,
			};

			const logger = createLogger(options);
			expect(logger).toBeDefined();
		});

		it('accepts maxFiles option', () => {
			const options: LoggerOptions = {
				level: 'info',
				verbose: false,
				maxFiles: 10,
			};

			const logger = createLogger(options);
			expect(logger).toBeDefined();
		});

		it('handles lowercase log levels', () => {
			const options: LoggerOptions = {
				level: 'info',
				verbose: false,
			};

			const logger = createLogger(options);
			expect(logger.level).toBe('info');
		});
	});
});
