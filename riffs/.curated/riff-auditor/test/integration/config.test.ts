/**
 * Integration tests for config loading
 */

import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/lib/config.js';

describe('Config Integration', () => {
	describe('YAML file loading', () => {
		it('given actual config file, when loadConfig called, then returns correct config values', () => {
			// Given: Actual config.yaml at the Riff root
			// When: Loading config
			const config = loadConfig();

			// Then: Should return values from actual config file or Zod defaults
			const riffConfig = config['riff-auditor'];
			expect(riffConfig.paths.output.dir).toBeDefined();
			expect(typeof riffConfig.paths.output.dir).toBe('string');
			expect(riffConfig.paths.output.filename).toBeDefined();
			expect(typeof riffConfig.paths.output.filename).toBe('string');
			expect(config.logging.level).toBeDefined();
			expect(typeof config.logging.level).toBe('string');
		});

		it('given output config in YAML, when loadConfig called, then returns expected values', () => {
			// Given: Actual config with output section
			// When: Loading config
			const config = loadConfig();

			// Then: Tilde paths are expanded to absolute, non-path strings remain as-is
			expect(config['riff-auditor'].paths.output.dir).not.toContain('~/');
			expect(config['riff-auditor'].paths.output.dir).toMatch(/^\//);
			expect(config['riff-auditor'].paths.output.filename).toBe('riff-auditor.json');
		});

		it('given logging config in YAML, when loadConfig called, then returns expected defaults', () => {
			// Given: Actual config with logging section
			// When: Loading config
			const config = loadConfig();

			// Then: Should return standard logging defaults
			expect(config.logging.level).toBe('info');
			expect(config.logging.maxFileSizeMb).toBe(10);
			expect(config.logging.maxFiles).toBe(7);
		});
	});
});
