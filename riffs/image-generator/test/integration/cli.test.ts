import { describe, expect, it } from 'vitest';
import { ChatSessionCommand } from '../../src/core/chat-session.js';
import { ComposeImagesCommand } from '../../src/core/compose-images.js';
import { EditImageCommand } from '../../src/core/edit-image.js';
import { GenerateImageCommand } from '../../src/core/generate-image.js';
import { loadConfig } from '../../src/lib/config.js';
import { createLogger } from '../../src/lib/logger.js';

describe('CLI Integration', () => {
	describe('Command Class Instantiation', () => {
		it('given valid config, when command classes instantiated, then no errors thrown', () => {
			const config = loadConfig();
			const riff = config['image-generator'];
			const logger = createLogger({
				level: 'error',
				verbose: false,
				file: '.aria/logs/test/image-generator-cli.log',
				maxFileSizeMb: 5,
				maxFiles: 1,
			});

			// Set API key for testing
			process.env.GOOGLE_API_KEY = 'test-key';

			expect(() => new GenerateImageCommand(riff, logger)).not.toThrow();
			expect(() => new EditImageCommand(riff, logger)).not.toThrow();
			expect(() => new ComposeImagesCommand(riff, logger)).not.toThrow();
			expect(() => new ChatSessionCommand(riff, logger)).not.toThrow();
		});

		it('given missing API key, when command instantiated, then throws error', () => {
			const config = loadConfig();
			const riff = config['image-generator'];
			const logger = createLogger({
				level: 'error',
				verbose: false,
				file: '.aria/logs/test/image-generator-cli-nokey.log',
				maxFileSizeMb: 5,
				maxFiles: 1,
			});

			process.env.GOOGLE_API_KEY = '';

			expect(() => new GenerateImageCommand(riff, logger)).toThrow('GOOGLE_API_KEY');
		});
	});

	describe('Configuration Integration', () => {
		it('given production config, when loaded, then contains expected defaults', () => {
			const config = loadConfig();
			const riff = config['image-generator'];

			expect(riff.gemini.defaultModel).toBe('gemini-3-pro-image-preview');
			expect(riff.defaults.aspectRatio).toBe('16:9');
			expect(riff.defaults.imageSize).toBe('2K');
		});
	});
});
