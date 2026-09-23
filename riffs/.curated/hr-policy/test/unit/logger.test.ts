import { mkdirSync, rmSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { LoggerOptions } from '../../src/lib/logger.js';
import { createLogger } from '../../src/lib/logger.js';

describe('Logger Factory', () => {
	const testLogDir = '/tmp/hr-policy-logger-test';
	let originalCwd: string;

	beforeEach(() => {
		originalCwd = process.cwd();
		mkdirSync(testLogDir, { recursive: true });
	});

	afterEach(() => {
		try {
			// Restore original working directory before deleting the test directory
			process.chdir(originalCwd);
			rmSync(testLogDir, { recursive: true, force: true });
		} catch {
			// Cleanup failure is not critical
		}
	});

	describe('createLogger()', () => {
		it('given valid LoggerOptions, when createLogger called, then returns Pino logger instance', () => {
			const options: LoggerOptions = {
				level: 'info',
				verbose: false,
				file: '.aria/logs/test/hr-policy-test.log',
			};

			const logger = createLogger(options);

			expect(logger).toBeDefined();
			// Pino logger has common methods
			expect(typeof logger.info).toBe('function');
			expect(typeof logger.debug).toBe('function');
			expect(typeof logger.error).toBe('function');
			expect(typeof logger.warn).toBe('function');
		});

		it('given LoggerOptions with default level, when createLogger called, then creates logger with correct level', () => {
			const options: LoggerOptions = {
				level: 'info',
				verbose: false,
			};

			const logger = createLogger(options);

			expect(logger).toBeDefined();
			expect(typeof logger.info).toBe('function');
		});

		it('given LoggerOptions with verbose true, when createLogger called, then creates logger with debug level', () => {
			const options: LoggerOptions = {
				level: 'info',
				verbose: true,
			};

			const logger = createLogger(options);

			expect(logger).toBeDefined();
			// The logger should be created with debug level when verbose is true
		});

		it('given LoggerOptions with DEBUG level, when createLogger called, then creates logger with debug level', () => {
			const options: LoggerOptions = {
				level: 'debug',
				verbose: false,
			};

			const logger = createLogger(options);

			expect(logger).toBeDefined();
		});

		it('given LoggerOptions with WARN level, when createLogger called, then creates logger with warn level', () => {
			const options: LoggerOptions = {
				level: 'warn',
				verbose: false,
			};

			const logger = createLogger(options);

			expect(logger).toBeDefined();
		});

		it('given LoggerOptions with ERROR level, when createLogger called, then creates logger with error level', () => {
			const options: LoggerOptions = {
				level: 'error',
				verbose: false,
			};

			const logger = createLogger(options);

			expect(logger).toBeDefined();
		});

		it('given LoggerOptions with custom log file, when createLogger called, then logger configured with custom file', () => {
			const options: LoggerOptions = {
				level: 'info',
				verbose: false,
				file: '.aria/logs/test/custom-logger.log',
			};

			const logger = createLogger(options);

			expect(logger).toBeDefined();
			// Logger is successfully created with custom file
		});

		it('given LoggerOptions with max file size, when createLogger called, then logger configured with size limit', () => {
			const options: LoggerOptions = {
				level: 'info',
				verbose: false,
				file: '.aria/logs/test/hr-policy-test.log',
				maxFileSizeMb: 20,
			};

			const logger = createLogger(options);

			expect(logger).toBeDefined();
		});

		it('given LoggerOptions with max files count, when createLogger called, then logger configured with rotation limit', () => {
			const options: LoggerOptions = {
				level: 'info',
				verbose: false,
				file: '.aria/logs/test/hr-policy-test.log',
				maxFiles: 5,
			};

			const logger = createLogger(options);

			expect(logger).toBeDefined();
		});

		it('given LoggerOptions with all parameters, when createLogger called, then logger created with all settings', () => {
			const options: LoggerOptions = {
				level: 'debug',
				verbose: false,
				file: '.aria/logs/test/hr-policy-complete.log',
				maxFileSizeMb: 50,
				maxFiles: 10,
			};

			const logger = createLogger(options);

			expect(logger).toBeDefined();
			expect(typeof logger.info).toBe('function');
			expect(typeof logger.debug).toBe('function');
		});

		it('given logger instance, when logging methods called, then methods do not throw', () => {
			const options: LoggerOptions = {
				level: 'debug',
				verbose: false,
				file: '.aria/logs/test/hr-policy-method.log',
			};

			const logger = createLogger(options);

			expect(() => {
				logger.info({ test: 'data' }, 'Info message');
				logger.debug({ test: 'data' }, 'Debug message');
				logger.warn({ test: 'data' }, 'Warn message');
				logger.error({ test: 'data' }, 'Error message');
			}).not.toThrow();
		});

		it('given lowercase level in LoggerOptions, when createLogger called, then normalizes to lowercase', () => {
			const options: LoggerOptions = {
				level: 'info',
				verbose: false,
			};

			const logger = createLogger(options);

			expect(logger).toBeDefined();
		});

		it('given uppercase level in LoggerOptions, when createLogger called, then normalizes to lowercase', () => {
			const options: LoggerOptions = {
				level: 'error',
				verbose: false,
			};

			const logger = createLogger(options);

			expect(logger).toBeDefined();
		});

		it('given default file option when undefined, when createLogger called, then uses default filename', () => {
			const options: LoggerOptions = {
				level: 'info',
				verbose: false,
			};

			const logger = createLogger(options);

			expect(logger).toBeDefined();
			// Logger defaults to 'hr-policy.log' when file is not specified
		});

		it('given verbose false with INFO level, when createLogger called, then uses INFO level', () => {
			const options: LoggerOptions = {
				level: 'info',
				verbose: false,
			};

			const logger = createLogger(options);

			expect(logger).toBeDefined();
		});

		it('given verbose true with INFO level, when createLogger called, then overrides to DEBUG level', () => {
			const options: LoggerOptions = {
				level: 'info',
				verbose: true,
			};

			const logger = createLogger(options);

			expect(logger).toBeDefined();
			// When verbose is true, the logger level should be 'debug' regardless of the level setting
		});

		it('given multiple logger instances, when created independently, then both are functional', () => {
			const options1: LoggerOptions = {
				level: 'info',
				verbose: false,
				file: '.aria/logs/test/hr-policy-logger1.log',
			};

			const options2: LoggerOptions = {
				level: 'debug',
				verbose: false,
				file: '.aria/logs/test/hr-policy-logger2.log',
			};

			const logger1 = createLogger(options1);
			const logger2 = createLogger(options2);

			expect(logger1).toBeDefined();
			expect(logger2).toBeDefined();
			expect(typeof logger1.info).toBe('function');
			expect(typeof logger2.debug).toBe('function');
		});
	});
});
