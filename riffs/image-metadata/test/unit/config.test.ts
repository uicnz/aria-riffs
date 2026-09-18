import fs from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock fs before importing config
vi.mock('node:fs');

describe('ImageMeta Config', () => {
	const mockConfig = {
		'image-metadata': {
			paths: {
				input: { dir: './images' },
				database: { file: '.aria/db/image/descriptions.db' },
			},
			llm: {
				provider: 'ollama',
			},
			database: {
				backupCount: 3,
				journalMode: 'DELETE',
			},
			images: {
				supportedExtensions: ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'],
				maxFileSizeMb: 50,
			},
			metadata: {
				retryAttempts: 3,
				retryDelay: 1.0,
			},
			processing: {
				batchSize: 10,
				progressBar: true,
			},
		},
		logging: {
			level: 'info',
			verbose: false,
			file: '.aria/logs/test/image-metadata-config.log',
			maxFileSizeMb: 10,
			maxFiles: 7,
		},
		llmProviders: {
			ollama: {
				endpoint: 'http://localhost:11434/',
				model: 'llava-llama3',
				timeout: 60,
				keepAlive: 5,
				prompt: 'Describe this image in detail.',
			},
			anthropic: {
				apiKey: '',
				model: 'claude-sonnet-4-20250514',
				timeout: 30,
				maxTokens: 1024,
				baseUrl: 'https://api.anthropic.com/v1',
				prompt: 'Describe this image.',
			},
			gemini: {
				apiKey: '',
				model: 'gemini-2.5-flash',
				timeout: 30,
				maxTokens: 1024,
				baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
				prompt: 'Describe this image.',
			},
		},
	};

	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();
		// Clear all environment variables that could affect config
		delete process.env['IMAGE_METADATA_PROVIDER'];
		delete process.env['IMAGE_METADATA_OLLAMA_ENDPOINT'];
		delete process.env['IMAGE_METADATA_OLLAMA_MODEL'];
		delete process.env['IMAGE_METADATA_OLLAMA_TIMEOUT'];
		delete process.env['IMAGE_METADATA_OLLAMA_PROMPT'];
		process.env['ANTHROPIC_API_KEY'] = '';
		delete process.env['IMAGE_METADATA_ANTHROPIC_MODEL'];
		delete process.env['IMAGE_METADATA_ANTHROPIC_TIMEOUT'];
		delete process.env['IMAGE_METADATA_ANTHROPIC_MAX_TOKENS'];
		delete process.env['IMAGE_METADATA_ANTHROPIC_BASE_URL'];
		delete process.env['IMAGE_METADATA_ANTHROPIC_PROMPT'];
		process.env['GOOGLE_API_KEY'] = '';
		delete process.env['IMAGE_METADATA_GOOGLE_MODEL'];
		delete process.env['IMAGE_METADATA_GOOGLE_TIMEOUT'];
		delete process.env['IMAGE_METADATA_GOOGLE_MAX_TOKENS'];
		delete process.env['IMAGE_METADATA_GOOGLE_PROMPT'];
		delete process.env['IMAGE_METADATA_DATABASE_PATH'];
		delete process.env['IMAGE_METADATA_LOG_LEVEL'];
		delete process.env['IMAGE_METADATA_LOG_VERBOSE'];
		delete process.env['IMAGE_METADATA_LOG_FILE'];
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('loadConfig', () => {
		it('given YAML config file exists, when loadConfig called, then should load configuration from YAML', async () => {
			const yaml = await import('js-yaml');
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(yaml.dump(mockConfig));

			const { loadConfig } = await import('../../src/lib/config.js');
			const config = loadConfig();
			const riff = config['image-metadata'];

			expect(riff.llm.provider).toBe('ollama');
			expect(config.llmProviders.ollama.model).toBe('llava-llama3');
			expect(config.llmProviders.ollama.endpoint).toBe('http://localhost:11434/');
			expect(config.llmProviders.ollama.timeout).toBe(60);
			expect(riff.paths.database.file).toBe('.aria/db/image/descriptions.db');
			expect(config.logging.level).toBe('info');
		});

		it('given environment variables set, when loadConfig called, then should apply overrides', async () => {
			process.env['IMAGE_METADATA_PROVIDER'] = 'anthropic';
			process.env['IMAGE_METADATA_OLLAMA_ENDPOINT'] = 'http://custom:8080';
			process.env['IMAGE_METADATA_OLLAMA_MODEL'] = 'custom-model';
			process.env['ANTHROPIC_API_KEY'] = 'test-key';
			process.env['IMAGE_METADATA_DATABASE_PATH'] = './custom.db';
			process.env['IMAGE_METADATA_LOG_LEVEL'] = 'DEBUG';

			const yaml = await import('js-yaml');
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(yaml.dump(mockConfig));

			vi.resetModules();
			const { loadConfig } = await import('../../src/lib/config.js');
			const config = loadConfig();
			const riff = config['image-metadata'];

			expect(riff.llm.provider).toBe('anthropic');
			expect(config.llmProviders.ollama.endpoint).toBe('http://custom:8080');
			expect(config.llmProviders.ollama.model).toBe('custom-model');
			expect(config.llmProviders.anthropic.apiKey).toBe('test-key');
			expect(riff.paths.database.file).toBe('./custom.db');
			expect(config.logging.level).toBe('debug');
		});

		it('given nested config values, when loadConfig called, then should access nested values correctly', async () => {
			const yaml = await import('js-yaml');
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(yaml.dump(mockConfig));

			const { loadConfig } = await import('../../src/lib/config.js');
			const config = loadConfig();
			const riff = config['image-metadata'];

			// Test nested object access
			expect(riff.llm).toBeDefined();
			expect(typeof riff.llm).toBe('object');

			const ollamaConfig = config.llmProviders.ollama;
			expect(ollamaConfig).toBeDefined();
			expect(typeof ollamaConfig).toBe('object');

			// Test array access
			expect(Array.isArray(riff.images.supportedExtensions)).toBe(true);
			expect(riff.images.supportedExtensions).toContain('.png');
			expect(riff.images.supportedExtensions).toContain('.jpg');

			// Test deep nested values
			expect(riff.processing.batchSize).toBe(10);
		});

		it('given explicit path not found, when loadConfig called, then should throw error', async () => {
			vi.mocked(fs.existsSync).mockReturnValue(false);

			const { loadConfig } = await import('../../src/lib/config.js');
			expect(() => loadConfig('/nonexistent/path.yaml')).toThrow('Config file not found');
		});

		it('given invalid YAML, when loadConfig called, then should throw error', async () => {
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue('invalid: yaml: content: [[[');

			const { loadConfig } = await import('../../src/lib/config.js');
			expect(() => loadConfig()).toThrow();
		});

		it('given no config file at default path, when loadConfig called, then should use defaults', async () => {
			vi.mocked(fs.existsSync).mockReturnValue(false);

			const { loadConfig } = await import('../../src/lib/config.js');
			const config = loadConfig();
			const riff = config['image-metadata'];

			// Should have default values from schema
			expect(riff.llm.provider).toBe('ollama');
			expect(config.logging.level).toBe('info');
		});
	});

	describe('tilde expansion', () => {
		it('given config with tilde paths, when loadConfig called, then tildes are expanded to home directory', async () => {
			const tildeConfig = {
				...mockConfig,
				logging: {
					...mockConfig.logging,
					file: '~/.aria/logs/image-metadata.log',
				},
			};
			const yaml = await import('yaml');
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(yaml.stringify(tildeConfig));

			const { loadConfig } = await import('../../src/lib/config.js');
			const config = loadConfig();

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
		});
	});
});
