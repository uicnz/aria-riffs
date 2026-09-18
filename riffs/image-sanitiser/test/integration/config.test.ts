import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/lib/config.js';

describe('Config Integration', () => {
	describe('YAML file loading', () => {
		it('given actual config file, when loadConfig called, then returns correct config values', () => {
			// Given: Actual config-image-sanitiser.yaml in config directory
			// When: Loading config
			const config = loadConfig();

			// Then: Should return values from actual config file or Zod defaults
			const riffConfig = config['image-sanitiser'];
			expect(riffConfig.images.supportedExtensions).toBeDefined();
			expect(Array.isArray(riffConfig.images.supportedExtensions)).toBe(true);
			expect(riffConfig.images.maxFileSizeMb).toBeDefined();
			expect(typeof riffConfig.images.maxFileSizeMb).toBe('number');
			expect(riffConfig.processing.progressBar).toBeDefined();
			expect(typeof riffConfig.processing.progressBar).toBe('boolean');
			expect(config.logging.level).toBeDefined();
			expect(typeof config.logging.level).toBe('string');
		});

		it('given database config in YAML, when loadConfig called, then returns expected values', () => {
			// Given: Actual config with database section
			// When: Loading config
			const config = loadConfig();

			// Then: Should return values from YAML or defaults
			expect(config['image-sanitiser'].paths.database.file).not.toContain('~/');
			expect(config['image-sanitiser'].paths.database.file).toMatch(/^\//);
			expect(config['image-sanitiser'].paths.database.file).toContain(
				'.aria/db/image-sanitiser/image-sanitiser.sqlite'
			);
			expect(config['image-sanitiser'].database.tableName).toBe('images');
		});
	});
});
