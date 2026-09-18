import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('image-renamer Config', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();
		// Clear environment variables
		delete process.env['IMAGE_RENAMER_LLM_PROVIDER'];
		delete process.env['IMAGE_RENAMER_OLLAMA_ENDPOINT'];
		delete process.env['IMAGE_RENAMER_OLLAMA_MODEL'];
		delete process.env['IMAGE_RENAMER_OLLAMA_TIMEOUT'];
		delete process.env['IMAGE_RENAMER_OLLAMA_RETRY_ATTEMPTS'];
		delete process.env['IMAGE_RENAMER_OLLAMA_RETRY_DELAY'];
		delete process.env['IMAGE_RENAMER_OLLAMA_PROMPT'];
		process.env['ANTHROPIC_API_KEY'] = '';
		delete process.env['IMAGE_RENAMER_ANTHROPIC_MODEL'];
		delete process.env['IMAGE_RENAMER_ANTHROPIC_TIMEOUT'];
		delete process.env['IMAGE_RENAMER_ANTHROPIC_MAX_TOKENS'];
		delete process.env['IMAGE_RENAMER_ANTHROPIC_BASE_URL'];
		delete process.env['IMAGE_RENAMER_ANTHROPIC_PROMPT'];
		process.env['GOOGLE_API_KEY'] = '';
		delete process.env['IMAGE_RENAMER_GOOGLE_MODEL'];
		delete process.env['IMAGE_RENAMER_GOOGLE_TIMEOUT'];
		delete process.env['IMAGE_RENAMER_GOOGLE_MAX_TOKENS'];
		delete process.env['IMAGE_RENAMER_GOOGLE_BASE_URL'];
		delete process.env['IMAGE_RENAMER_GOOGLE_PROMPT'];
		delete process.env['IMAGE_RENAMER_FILENAME_PROMPT'];
		delete process.env['IMAGE_RENAMER_LOG_LEVEL'];
		delete process.env['IMAGE_RENAMER_LOG_VERBOSE'];
		delete process.env['IMAGE_RENAMER_LOG_FILE'];
		delete process.env['IMAGE_RENAMER_LOG_MAX_FILE_SIZE_MB'];
		delete process.env['IMAGE_RENAMER_LOG_MAX_FILES'];
		delete process.env['IMAGE_RENAMER_LOG_CONSOLE_COLORS'];
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('loadConfig', () => {
		it('should load configuration with default values', async () => {
			const { loadConfig } = await import('../../src/lib/config.js');

			// Test against default values from Zod schema
			const config = loadConfig();

			const riffConfig = config['image-renamer'];
			expect(riffConfig.llm.provider).toBe('ollama');
			expect(riffConfig.llm.ollama.endpoint).toBe('http://localhost:11434/');
			expect(riffConfig.llm.ollama.model).toBe('gemma4:12b');
			expect(riffConfig.llm.ollama.timeout).toBe(30);
			expect(riffConfig.llm.ollama.retryAttempts).toBe(3);
			expect(riffConfig.llm.ollama.retryDelay).toBe(1.0);
			expect(riffConfig.filename.replaceSpacesWith).toBe('-');
			expect(config.logging.level).toBe('info');
		});

		it('should apply Ollama environment variable overrides', async () => {
			process.env['IMAGE_RENAMER_OLLAMA_ENDPOINT'] = 'http://custom:8080';
			process.env['IMAGE_RENAMER_OLLAMA_MODEL'] = 'custom-model';
			process.env['IMAGE_RENAMER_OLLAMA_TIMEOUT'] = '60';
			process.env['IMAGE_RENAMER_OLLAMA_PROMPT'] = 'Custom ollama prompt';

			vi.resetModules();
			const { loadConfig } = await import('../../src/lib/config.js');
			const config = loadConfig();

			const riffConfig = config['image-renamer'];
			expect(riffConfig.llm.ollama.endpoint).toBe('http://custom:8080');
			expect(riffConfig.llm.ollama.model).toBe('custom-model');
			expect(riffConfig.llm.ollama.timeout).toBe(60);
			expect(riffConfig.llm.ollama.prompt).toBe('Custom ollama prompt');
		});

		it('should apply Anthropic environment variable overrides', async () => {
			process.env['IMAGE_RENAMER_LLM_PROVIDER'] = 'anthropic';
			process.env['ANTHROPIC_API_KEY'] = 'test-anthropic-key';
			process.env['IMAGE_RENAMER_ANTHROPIC_MODEL'] = 'claude-3-opus-20240229';
			process.env['IMAGE_RENAMER_ANTHROPIC_TIMEOUT'] = '90';
			process.env['IMAGE_RENAMER_ANTHROPIC_MAX_TOKENS'] = '2048';
			process.env['IMAGE_RENAMER_ANTHROPIC_BASE_URL'] = 'https://custom.anthropic.com/v1';
			process.env['IMAGE_RENAMER_ANTHROPIC_PROMPT'] = 'Custom Anthropic prompt';

			vi.resetModules();
			const { loadConfig } = await import('../../src/lib/config.js');
			const config = loadConfig();

			const riffConfig = config['image-renamer'];
			expect(riffConfig.llm.provider).toBe('anthropic');
			expect(riffConfig.llm.anthropic.apiKey).toBe('test-anthropic-key');
			expect(riffConfig.llm.anthropic.model).toBe('claude-3-opus-20240229');
			expect(riffConfig.llm.anthropic.timeout).toBe(90);
			expect(riffConfig.llm.anthropic.maxTokens).toBe(2048);
			expect(riffConfig.llm.anthropic.baseUrl).toBe('https://custom.anthropic.com/v1');
			expect(riffConfig.llm.anthropic.prompt).toBe('Custom Anthropic prompt');
		});

		it('should apply Gemini environment variable overrides', async () => {
			process.env['IMAGE_RENAMER_LLM_PROVIDER'] = 'gemini';
			process.env['GOOGLE_API_KEY'] = 'test-google-key';
			process.env['IMAGE_RENAMER_GOOGLE_MODEL'] = 'gemini-2.0-flash';
			process.env['IMAGE_RENAMER_GOOGLE_TIMEOUT'] = '45';
			process.env['IMAGE_RENAMER_GOOGLE_MAX_TOKENS'] = '2048';
			process.env['IMAGE_RENAMER_GOOGLE_BASE_URL'] = 'https://custom.googleapis.com/v1';
			process.env['IMAGE_RENAMER_GOOGLE_PROMPT'] = 'Custom Gemini prompt';

			vi.resetModules();
			const { loadConfig } = await import('../../src/lib/config.js');
			const config = loadConfig();

			const riffConfig = config['image-renamer'];
			expect(riffConfig.llm.provider).toBe('gemini');
			expect(riffConfig.llm.gemini.apiKey).toBe('test-google-key');
			expect(riffConfig.llm.gemini.model).toBe('gemini-2.0-flash');
			expect(riffConfig.llm.gemini.timeout).toBe(45);
			expect(riffConfig.llm.gemini.maxTokens).toBe(2048);
			expect(riffConfig.llm.gemini.baseUrl).toBe('https://custom.googleapis.com/v1');
			expect(riffConfig.llm.gemini.prompt).toBe('Custom Gemini prompt');
		});

		it('should apply filename prompt environment variable override', async () => {
			process.env['IMAGE_RENAMER_FILENAME_PROMPT'] = 'Custom filename prompt';

			vi.resetModules();
			const { loadConfig } = await import('../../src/lib/config.js');
			const config = loadConfig();

			expect(config['image-renamer'].filename.prompt).toBe('Custom filename prompt');
		});

		it('should apply logging environment variable overrides', async () => {
			process.env['IMAGE_RENAMER_LOG_LEVEL'] = 'debug';
			process.env['IMAGE_RENAMER_LOG_VERBOSE'] = 'true';
			process.env['IMAGE_RENAMER_LOG_FILE'] = '/custom/log/path.log';

			vi.resetModules();
			const { loadConfig } = await import('../../src/lib/config.js');
			const config = loadConfig();

			expect(config.logging.level).toBe('debug');
			expect(config.logging.verbose).toBe(true);
			expect(config.logging.file).toBe('/custom/log/path.log');
		});

		it('should return nested configuration values', async () => {
			const { loadConfig } = await import('../../src/lib/config.js');
			const config = loadConfig();

			// Test nested object access
			const riffConfig = config['image-renamer'];
			expect(riffConfig.llm).toBeDefined();
			expect(typeof riffConfig.llm).toBe('object');
			expect(riffConfig.llm.ollama).toBeDefined();
			expect(typeof riffConfig.llm.ollama).toBe('object');

			// Test array access from schema defaults
			expect(Array.isArray(riffConfig.images.supportedExtensions)).toBe(true);
			expect(riffConfig.images.supportedExtensions).toContain('.png');
			expect(riffConfig.images.supportedExtensions).toContain('.jpg');

			// Test other nested values
			expect(riffConfig.fileOperations.safeMoveRetries).toBe(3);
			expect(riffConfig.watcher.recursive).toBe(false);
			expect(riffConfig.processing.batchSize).toBe(10);
		});
	});

	describe('config file loading', () => {
		it('given partial images config, when loaded, then merges with defaults', async () => {
			const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'config-test-'));
			const tempConfigPath = path.join(tempDir, 'partial-config.yaml');

			await fs.writeFile(
				tempConfigPath,
				`
image-renamer:
    images:
        maxFileSizeMb: 25
`
			);

			vi.resetModules();
			const { loadConfig } = await import('../../src/lib/config.js');

			try {
				const config = loadConfig(tempConfigPath);

				const riffConfig = config['image-renamer'];
				expect(riffConfig.images.maxFileSizeMb).toBe(25);
				expect(riffConfig.images.supportedExtensions).toEqual(['.png', '.jpg', '.jpeg', '.gif', '.bmp']);
				expect(riffConfig.images.verifyBeforeProcessing).toBe(true);
			} finally {
				await fs.remove(tempDir);
			}
		});

		it('given partial filename config, when loaded, then merges with defaults', async () => {
			const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'config-test-'));
			const tempConfigPath = path.join(tempDir, 'partial-config.yaml');

			await fs.writeFile(
				tempConfigPath,
				`
image-renamer:
    filename:
        maxLength: 50
`
			);

			vi.resetModules();
			const { loadConfig } = await import('../../src/lib/config.js');

			try {
				const config = loadConfig(tempConfigPath);

				const riffConfig = config['image-renamer'];
				expect(riffConfig.filename.maxLength).toBe(50);
				expect(riffConfig.filename.patternCleanup).toBe(true);
				expect(riffConfig.filename.removePunctuation).toBe(true);
				expect(riffConfig.filename.replaceSpacesWith).toBe('-');
				expect(riffConfig.filename.caseConversion).toBe('lower');
			} finally {
				await fs.remove(tempDir);
			}
		});

		it('given partial llm config with provider, when loaded, then uses that provider with defaults', async () => {
			const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'config-test-'));
			const tempConfigPath = path.join(tempDir, 'partial-config.yaml');

			await fs.writeFile(
				tempConfigPath,
				`
image-renamer:
    llm:
        provider: 'anthropic'
`
			);

			vi.resetModules();
			const { loadConfig } = await import('../../src/lib/config.js');

			try {
				const config = loadConfig(tempConfigPath);

				const riffConfig = config['image-renamer'];
				expect(riffConfig.llm.provider).toBe('anthropic');
				expect(riffConfig.llm.ollama.endpoint).toBe('http://localhost:11434/');
				expect(riffConfig.llm.anthropic.model).toBe('claude-sonnet-5');
				expect(riffConfig.llm.gemini.apiKey).toBe('');
			} finally {
				await fs.remove(tempDir);
			}
		});

		it('given non-existent explicit config path, when loaded, then throws ConfigError', async () => {
			vi.resetModules();
			const { loadConfig, ConfigError } = await import('../../src/lib/config.js');

			expect(() => loadConfig('/non/existent/config.yaml')).toThrow(ConfigError);
			expect(() => loadConfig('/non/existent/config.yaml')).toThrow('Config file not found');
		});

		it('given invalid YAML config, when loaded, then throws ConfigError', async () => {
			const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'config-test-'));
			const tempConfigPath = path.join(tempDir, 'invalid-config.yaml');

			await fs.writeFile(tempConfigPath, 'invalid: yaml: content: [');

			vi.resetModules();
			const { loadConfig, ConfigError } = await import('../../src/lib/config.js');

			try {
				expect(() => loadConfig(tempConfigPath)).toThrow(ConfigError);
			} finally {
				await fs.remove(tempDir);
			}
		});
	});

	describe('default database configuration', () => {
		it('should return default database config from Zod schema', async () => {
			const { loadConfig } = await import('../../src/lib/config.js');
			const config = loadConfig();

			const riffConfig = config['image-renamer'];
			expect(riffConfig.paths.database.file).not.toContain('~/');
			expect(riffConfig.paths.database.file).toMatch(/^\//);
			expect(riffConfig.paths.database.file).toContain('.aria/db/image-renamer/image-renamer.sqlite');
			expect(riffConfig.database.tableName).toBe('images');
			expect(riffConfig.database.journalMode).toBe('DELETE');
		});
	});

	describe('tilde expansion', () => {
		it('given config with tilde paths, when loadConfig called, then tildes are expanded to home directory', async () => {
			const tempDir = await fs.mkdtemp(path.join(os.homedir(), '.aria-test-'));
			const tempConfigPath = path.join(tempDir, 'tilde-config.yaml');

			await fs.writeFile(
				tempConfigPath,
				`
image-renamer:
    paths:
        output:
            dir: '~/.aria/output'
        database:
            file: '~/.aria/db/test.sqlite'
logging:
    file: '~/.aria/logs/image-renamer.log'
`
			);

			try {
				vi.resetModules();
				const { loadConfig } = await import('../../src/lib/config.js');
				const config = loadConfig(tempConfigPath);

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
