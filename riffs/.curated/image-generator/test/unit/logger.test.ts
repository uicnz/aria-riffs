import { describe, expect, it } from 'vitest';
import { createLogger } from '../../src/lib/logger.js';

describe('Logger System', () => {
	describe('createLogger', () => {
		it('given valid configuration, when createLogger called, then returns logger with all methods', () => {
			const logger = createLogger({
				level: 'info',
				verbose: false,
				file: '.aria/logs/test/image-generator-logger.log',
				maxFileSizeMb: 5,
				maxFiles: 3,
			});

			expect(logger).toBeDefined();
			expect(logger.info).toBeDefined();
			expect(logger.error).toBeDefined();
			expect(logger.debug).toBeDefined();
			expect(logger.warn).toBeDefined();
		});

		it('given verbose true, when createLogger called, then sets level to debug', () => {
			const logger = createLogger({
				level: 'info',
				verbose: true,
				file: '.aria/logs/test/image-generator-verbose.log',
				maxFileSizeMb: 5,
				maxFiles: 3,
			});

			expect(logger).toBeDefined();
			expect(logger.level).toBe('debug');
		});
	});
});
