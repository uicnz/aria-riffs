import { homedir } from 'node:os';
import * as path from 'node:path';
import { resolve } from 'node:path';
import * as fs from 'fs-extra';
import { describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../../src/lib/config.js';
import { ImageGeneratorConfigSchema } from '../../src/lib/schema.js';

describe('Configuration System', () => {
	describe('loadConfig', () => {
		it('given test config file, when loadConfig called, then returns parsed config', () => {
			const testConfigPath = resolve(
				process.cwd(),
				'riffs/image-generator/test/fixtures/config/test-config.yaml'
			);
			const config = loadConfig(testConfigPath);
			const riff = config['image-generator'];

			expect(config).toBeDefined();
			expect(riff.gemini.defaultModel).toBe('gemini-2.5-flash-image');
			expect(riff.defaults.aspectRatio).toBe('1:1');
			expect(riff.defaults.imageSize).toBe('1K');
			expect(config.logging.level).toBe('debug');
		});

		it('given default config path, when loadConfig called, then returns production config', () => {
			const config = loadConfig();
			const riff = config['image-generator'];

			expect(config).toBeDefined();
			expect(riff.gemini.defaultModel).toBe('gemini-3-pro-image-preview');
			expect(riff.defaults.aspectRatio).toBe('16:9');
			expect(riff.defaults.imageSize).toBe('2K');
		});

		it('given nonexistent config path, when loadConfig called, then throws error', () => {
			expect(() => loadConfig('/nonexistent/config.yaml')).toThrow('Config file not found');
		});
	});

	describe('ImageGeneratorConfigSchema', () => {
		it('given valid config object, when parsed, then succeeds', () => {
			const validConfig = {
				'image-generator': {
					gemini: {
						defaultModel: 'gemini-2.5-flash-image',
						timeoutMs: 60000,
						retryAttempts: 3,
					},
					defaults: {
						aspectRatio: '16:9',
						imageSize: '2K',
						outputFormat: 'png',
					},
					output: {
						filenamePattern: '{timestamp}_{operation}',
						timestampFormat: 'YYYY-MM-DD_HH-mm-ss',
					},
					paths: {
						output: {
							dir: '.aria/exports/image-generator',
							chatDir: '.',
							history: '.image-generator-chat-history.json',
						},
					},
					chat: {
						autoSave: false,
					},
				},
				logging: {
					level: 'info',
					verbose: false,
					file: '.aria/logs/test/image-generator.log',
					maxFileSizeMb: 10,
					maxFiles: 7,
				},
			};

			const result = ImageGeneratorConfigSchema.safeParse(validConfig);
			expect(result.success).toBe(true);
		});

		it('given empty config object, when parsed, then applies schema defaults', () => {
			const result = ImageGeneratorConfigSchema.parse({});
			const riff = result['image-generator'];

			expect(riff.gemini.defaultModel).toBe('gemini-3-pro-image-preview');
			expect(riff.defaults.aspectRatio).toBe('1:1');
			expect(result.logging.level).toBe('info');
		});
	});

	describe('tilde expansion', () => {
		it('given config with tilde paths, when loadConfig called, then tildes are expanded to home directory', async () => {
			const tempDir = await fs.mkdtemp(path.join(homedir(), '.aria-test-'));
			const tempConfigPath = path.join(tempDir, 'tilde-config.yaml');
			await fs.writeFile(
				tempConfigPath,
				`
image-generator:
    paths:
        output:
            dir: '~/.aria/output'
logging:
    file: '~/.aria/logs/image-generator.log'
`
			);

			try {
				vi.resetModules();
				const { loadConfig: load } = await import('../../src/lib/config.js');
				const config = load(tempConfigPath);

				const assertNoTildes = (obj: unknown, objPath = ''): void => {
					if (typeof obj === 'string' && obj.startsWith('~/')) {
						throw new Error(`Unexpanded tilde at ${objPath}: ${obj}`);
					}
					if (obj && typeof obj === 'object') {
						for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
							assertNoTildes(value, `${objPath}.${key}`);
						}
					}
				};
				assertNoTildes(config);
			} finally {
				await fs.remove(tempDir);
			}
		});
	});
});
