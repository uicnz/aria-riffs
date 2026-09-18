import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/lib/config.js';

describe('image-transcoder Config', () => {
	// Store original env vars
	let originalEnv: Record<string, string | undefined>;

	beforeEach(() => {
		originalEnv = {
			IMAGE_TRANSCODER_MAX_SIZE: process.env.IMAGE_TRANSCODER_MAX_SIZE,
			IMAGE_TRANSCODER_QUALITY: process.env.IMAGE_TRANSCODER_QUALITY,
			IMAGE_TRANSCODER_OUTPUT_DIR: process.env.IMAGE_TRANSCODER_OUTPUT_DIR,
			IMAGE_TRANSCODER_LOG_LEVEL: process.env.IMAGE_TRANSCODER_LOG_LEVEL,
		};
	});

	afterEach(() => {
		// Restore original env vars
		for (const [key, value] of Object.entries(originalEnv)) {
			if (value === undefined) {
				delete process.env[key];
			} else {
				process.env[key] = value;
			}
		}
	});

	it('given config file exists, when loadConfig called, then loads YAML successfully', () => {
		const config = loadConfig();

		expect(config).toBeDefined();
		const riffConfig = config['image-transcoder'];
		expect(riffConfig.transcoding).toBeDefined();
		expect(riffConfig.transcoding.maxFileSizeBytes).toBe(5242880);
		expect(riffConfig.transcoding.quality).toBe(85);
	});

	it('given config file exists, when loadConfig called, then returns logging config with defaults', () => {
		const config = loadConfig();

		expect(config.logging).toBeDefined();
		expect(config.logging.level).toBe('info');
		expect(config.logging.file).not.toContain('~/');
		expect(config.logging.file).toMatch(/^\//);
		expect(config.logging.file).toContain('.aria/logs/image-transcoder.log');
	});

	it('given IMAGE_TRANSCODER_MAX_SIZE env var set, when loadConfig called, then env var overrides YAML value', () => {
		process.env.IMAGE_TRANSCODER_MAX_SIZE = '10';

		const config = loadConfig();

		expect(config['image-transcoder'].transcoding.maxFileSizeBytes).toBe(10485760); // 10MB in bytes
	});

	it('given IMAGE_TRANSCODER_QUALITY env var set, when loadConfig called, then env var overrides YAML value', () => {
		process.env.IMAGE_TRANSCODER_QUALITY = '90';

		const config = loadConfig();

		expect(config['image-transcoder'].transcoding.quality).toBe(90);
	});

	it('given IMAGE_TRANSCODER_LOG_LEVEL env var set, when loadConfig called, then env var overrides YAML value', () => {
		process.env.IMAGE_TRANSCODER_LOG_LEVEL = 'DEBUG';

		const config = loadConfig();

		expect(config.logging.level).toBe('debug');
	});
});
