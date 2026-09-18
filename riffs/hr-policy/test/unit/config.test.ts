import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import * as fs from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	buildEmbeddingConfig,
	DEFAULT_DOC_INDEXER_CONFIG,
	DEFAULT_LOGGING,
	DEFAULT_PATHS,
	loadDocIndexerConfig,
} from '../../src/lib/config.js';
import type {
	GeminiEmbeddingConfig,
	OllamaEmbeddingConfig,
	OpenAIEmbeddingConfig,
} from '../../src/providers/embedding-client.js';

describe('Configuration Management', () => {
	const testDir = '/tmp/hr-policy-config-test';
	const testConfigPath = path.join(testDir, 'config.yaml');

	beforeEach(() => {
		mkdirSync(testDir, { recursive: true });
		// Clear environment variables that affect config
		delete process.env['HR_POLICY_EMBEDDINGS_PROVIDER'];
		process.env['OPENAI_API_KEY'] = '';
		delete process.env['HR_POLICY_OPENAI_EMBEDDING_MODEL'];
		delete process.env['HR_POLICY_OPENAI_EMBEDDING_DIMENSIONS'];
		delete process.env['HR_POLICY_OPENAI_TIMEOUT'];
		process.env['GOOGLE_API_KEY'] = '';
		delete process.env['HR_POLICY_GOOGLE_EMBEDDING_MODEL'];
		delete process.env['HR_POLICY_GOOGLE_EMBEDDING_DIMENSIONS'];
		delete process.env['HR_POLICY_GOOGLE_TIMEOUT'];
		delete process.env['HR_POLICY_OLLAMA_ENDPOINT'];
		delete process.env['HR_POLICY_OLLAMA_EMBEDDING_MODEL'];
		delete process.env['HR_POLICY_OLLAMA_EMBEDDING_DIMENSIONS'];
		delete process.env['HR_POLICY_OLLAMA_TIMEOUT'];
	});

	afterEach(() => {
		try {
			rmSync(testDir, { recursive: true, force: true });
		} catch {
			// Cleanup failure is not critical
		}
	});

	describe('buildEmbeddingConfig()', () => {
		it('given no env vars and no config file, when buildEmbeddingConfig called, then returns default OpenAI config', () => {
			const config = buildEmbeddingConfig();

			expect(config.provider).toBe('openai');
			expect(config.model).toBe('text-embedding-3-large');
			expect(config.dimensions).toBe(3072);
			expect(config.timeout).toBe(30);
		});

		it('given HR_POLICY_EMBEDDINGS_PROVIDER env var, when buildEmbeddingConfig called, then uses specified provider', () => {
			process.env['HR_POLICY_EMBEDDINGS_PROVIDER'] = 'ollama';
			const config = buildEmbeddingConfig();

			expect(config.provider).toBe('ollama');
		});

		it('given OPENAI_API_KEY env var, when buildEmbeddingConfig called, then returns config with API key', () => {
			process.env['OPENAI_API_KEY'] = 'sk-test-key-123';
			const config = buildEmbeddingConfig();

			expect(config.provider).toBe('openai');
			expect((config as OpenAIEmbeddingConfig).api_key).toBe('sk-test-key-123');
		});

		it('given OpenAI provider, when buildEmbeddingConfig called, then returns valid OpenAI config', () => {
			process.env['HR_POLICY_EMBEDDINGS_PROVIDER'] = 'openai';
			const config = buildEmbeddingConfig();

			expect(config.provider).toBe('openai');
			expect(config.model).toBeDefined();
			expect(config.dimensions).toBeGreaterThan(0);
			expect(config.timeout).toBeGreaterThan(0);
		});

		it('given Ollama provider, when buildEmbeddingConfig called, then returns valid Ollama config', () => {
			process.env['HR_POLICY_EMBEDDINGS_PROVIDER'] = 'ollama';
			const config = buildEmbeddingConfig();

			expect(config.provider).toBe('ollama');
			expect((config as OllamaEmbeddingConfig).endpoint).toBeDefined();
			expect((config as OllamaEmbeddingConfig).endpoint).toContain('http');
			expect(config.model).toBeDefined();
		});

		it('given GOOGLE_API_KEY env var, when buildEmbeddingConfig called, then returns Gemini config with API key', () => {
			process.env['HR_POLICY_EMBEDDINGS_PROVIDER'] = 'gemini';
			process.env['GOOGLE_API_KEY'] = 'gemini-key-123';
			const config = buildEmbeddingConfig();

			expect(config.provider).toBe('gemini');
			expect((config as GeminiEmbeddingConfig).api_key).toBe('gemini-key-123');
		});

		it('given invalid provider in env, when buildEmbeddingConfig called, then throws error', () => {
			process.env['HR_POLICY_EMBEDDINGS_PROVIDER'] = 'invalid-provider';

			expect(() => buildEmbeddingConfig()).toThrow('Unknown or unsupported embedding provider: invalid-provider');
		});

		it('given Gemini defaults when no env vars, when buildEmbeddingConfig called, then uses correct defaults', () => {
			process.env['HR_POLICY_EMBEDDINGS_PROVIDER'] = 'gemini';
			const config = buildEmbeddingConfig();

			expect(config.provider).toBe('gemini');
			expect(config.model).toBe('gemini-embedding-2');
			expect(config.dimensions).toBe(768);
			expect((config as GeminiEmbeddingConfig).base_url).toBe('https://generativelanguage.googleapis.com/v1');
		});

		it('given Ollama defaults when no env vars, when buildEmbeddingConfig called, then uses correct defaults', () => {
			process.env['HR_POLICY_EMBEDDINGS_PROVIDER'] = 'ollama';
			const config = buildEmbeddingConfig();

			expect(config.provider).toBe('ollama');
			expect(config.model).toBe('embeddinggemma:latest');
			expect(config.dimensions).toBe(768);
			expect((config as OllamaEmbeddingConfig).endpoint).toMatch(/^http:\/\/localhost:11434\/?$/);
		});

		it('given HR_POLICY_OLLAMA_KEEP_ALIVE env var, when buildEmbeddingConfig called, then includes keep_alive in config', () => {
			process.env['HR_POLICY_EMBEDDINGS_PROVIDER'] = 'ollama';
			process.env['HR_POLICY_OLLAMA_KEEP_ALIVE'] = '300';
			const config = buildEmbeddingConfig();

			expect((config as OllamaEmbeddingConfig).keep_alive).toBe(300);
		});
	});

	describe('loadDocIndexerConfig()', () => {
		it('given explicit path to nonexistent config file, when loadDocIndexerConfig called, then throws error', async () => {
			await expect(loadDocIndexerConfig(path.join(testDir, 'nonexistent.yaml'))).rejects.toThrow(
				'Config file not found'
			);
		});

		it('given config file with indexer section, when loadDocIndexerConfig called, then merges with defaults', async () => {
			const configContent = `
hr-policy:
  embeddings:
    provider: 'openai'
    maxChars: 25000
    openai:
      apiKey: 'test-key'
      model: 'text-embedding-3-large'
      dimensions: 3072
      timeout: 30
  indexer:
    weightResponse: 2.0
    useFts: false
logging:
  level: 'info'
`;
			writeFileSync(testConfigPath, configContent, 'utf-8');

			const config = await loadDocIndexerConfig(testConfigPath);

			expect(config.weightResponse).toBe(2.0);
			expect(config.useFts).toBe(false);
			expect(config.hybrid).toBe(DEFAULT_DOC_INDEXER_CONFIG.hybrid); // Default value
			expect(config.maxEmbedChars).toBe(25000);
			expect(config.model).toBe('text-embedding-3-large');
			expect(config.dimensions).toBe(3072);
		});

		it('given config with custom paths, when loadDocIndexerConfig called, then indexer config has no paths (paths are on riff root)', async () => {
			const configContent = `
hr-policy:
  paths:
    input:
      policies: '/custom/input'
      sections: 'custom-sources'
    output:
      sections: '/custom/output'
      dir: '/custom/output-dir'
    database:
      decomposer: '/custom/path/db.db'
      indexer: '/custom/path/db.sqlite'
  embeddings:
    provider: 'openai'
    openai:
      apiKey: 'test-key'
      model: 'text-embedding-3-large'
      dimensions: 3072
      timeout: 30
  indexer:
    weightResponse: 1.8
logging:
  level: 'info'
`;
			writeFileSync(testConfigPath, configContent, 'utf-8');

			const config = await loadDocIndexerConfig(testConfigPath);

			// Paths are no longer on IndexerConfig - they live at riff.paths
			expect(config.weightResponse).toBe(1.8);
		});

		it('given config with logging section, when loadDocIndexerConfig called, then uses logging config', async () => {
			const configContent = `
hr-policy:
  embeddings:
    provider: 'openai'
    openai:
      apiKey: 'test-key'
      model: 'text-embedding-3-large'
      dimensions: 3072
      timeout: 30
  indexer:
    weightResponse: 1.0
logging:
  level: 'debug'
  verbose: true
  file: '.aria/logs/test/hr-policy-custom.log'
  maxFileSizeMb: 50
  maxFiles: 14
`;
			writeFileSync(testConfigPath, configContent, 'utf-8');

			const config = await loadDocIndexerConfig(testConfigPath);

			expect(config.logging?.level).toBe('debug');
			expect(config.logging?.verbose).toBe(true);
			expect(config.logging?.file).toBe('.aria/logs/test/hr-policy-custom.log');
			expect(config.logging?.maxFileSizeMb).toBe(50);
			expect(config.logging?.maxFiles).toBe(14);
		});

		it('given config with all indexer fields, when loadDocIndexerConfig called, then uses all configured values', async () => {
			const configContent = `
hr-policy:
  embeddings:
    provider: 'openai'
    maxChars: 30000
    openai:
      apiKey: 'test-key'
      model: 'text-embedding-3-large'
      dimensions: 3072
      timeout: 30
  indexer:
    sections: 'request'
    weightResponse: 1.5
    useFts: false
    hybrid: false
    alpha: 0.5
    showMetadata: false
    highlight: false
logging:
  level: 'info'
`;
			writeFileSync(testConfigPath, configContent, 'utf-8');

			const config = await loadDocIndexerConfig(testConfigPath);

			expect(config.sections).toBe('request');
			expect(config.weightResponse).toBe(1.5);
			expect(config.useFts).toBe(false);
			expect(config.hybrid).toBe(false);
			expect(config.alpha).toBe(0.5);
			expect(config.showMetadata).toBe(false);
			expect(config.highlight).toBe(false);
			expect(config.maxEmbedChars).toBe(30000);
		});

		it('given config with all paths fields at riff level, when loadDocIndexerConfig called, then indexer config returned without paths', async () => {
			const configContent = `
hr-policy:
  paths:
    input:
      policies: '/custom/input'
      sections: 'custom-sources'
    output:
      sections: '/custom/output'
      dir: '/custom/output-dir'
    database:
      decomposer: '/custom/db.db'
      indexer: '/custom/db.sqlite'
  embeddings:
    provider: 'openai'
    openai:
      apiKey: 'test-key'
      model: 'text-embedding-3-large'
      dimensions: 3072
      timeout: 30
  indexer:
    weightResponse: 1.8
logging:
  level: 'info'
`;
			writeFileSync(testConfigPath, configContent, 'utf-8');

			const config = await loadDocIndexerConfig(testConfigPath);

			// Paths moved to riff.paths, no longer on IndexerConfig
			expect(config.weightResponse).toBe(1.8);
			expect(config.model).toBe('text-embedding-3-large');
		});

		it('given config with embedding model and dimensions, when loadDocIndexerConfig called, then uses values from embedding config', async () => {
			process.env['HR_POLICY_EMBEDDINGS_PROVIDER'] = 'gemini';
			const configContent = `
hr-policy:
  embeddings:
    provider: 'gemini'
    maxChars: 15000
    gemini:
      apiKey: 'gemini-key'
      model: 'gemini-embedding-2'
      dimensions: 768
      timeout: 45
    openai:
      apiKey: 'test-key'
      model: 'text-embedding-3-large'
      dimensions: 3072
      timeout: 30
  indexer:
    weightResponse: 1.0
logging:
  level: 'info'
`;
			writeFileSync(testConfigPath, configContent, 'utf-8');

			const config = await loadDocIndexerConfig(testConfigPath);

			expect(config.model).toBe('gemini-embedding-2');
			expect(config.dimensions).toBe(768);
			expect(config.maxEmbedChars).toBe(15000);
		});

		it('given Gemini provider config, when loadDocIndexerConfig called, then uses Gemini embedding settings', async () => {
			process.env['HR_POLICY_EMBEDDINGS_PROVIDER'] = 'gemini';
			process.env['GOOGLE_API_KEY'] = 'test-google-key';

			const configContent = `
hr-policy:
  embeddings:
    provider: 'gemini'
    maxChars: 20000
    gemini:
      apiKey: 'config-gemini-key'
      model: 'gemini-embedding-2'
      dimensions: 768
      timeout: 45
  indexer:
    weightResponse: 1.0
logging:
  level: 'info'
`;
			writeFileSync(testConfigPath, configContent, 'utf-8');

			const config = await loadDocIndexerConfig(testConfigPath);

			expect(config.model).toBe('gemini-embedding-2');
			expect(config.dimensions).toBe(768);
		});

		it('given invalid YAML config file, when loadDocIndexerConfig called, then throws error', async () => {
			writeFileSync(testConfigPath, 'invalid: yaml: content: [', 'utf-8');

			await expect(loadDocIndexerConfig(testConfigPath)).rejects.toThrow('Failed to load config');
		});

		it('given default config call without path argument, when loadDocIndexerConfig called, then uses default config path', async () => {
			// This test verifies that the function can be called without arguments
			// The actual file may not exist, so it will return defaults
			const config = await loadDocIndexerConfig();

			expect(config.logging).toBeDefined();
			expect(config.model).toBeDefined();
			expect(config.dimensions).toBeDefined();
		});

		it('given config with default maxChars, when loadDocIndexerConfig called, then uses default 35000 when not specified', async () => {
			const configContent = `
hr-policy:
  embeddings:
    provider: 'openai'
    openai:
      apiKey: 'test-key'
      model: 'text-embedding-3-large'
      dimensions: 3072
      timeout: 30
  indexer:
    weightResponse: 1.0
logging:
  level: 'info'
`;
			writeFileSync(testConfigPath, configContent, 'utf-8');

			const config = await loadDocIndexerConfig(testConfigPath);

			expect(config.maxEmbedChars).toBe(35000);
		});
	});

	describe('DEFAULT_PATHS constant', () => {
		it('given DEFAULT_PATHS, when accessed, then contains all required nested paths', () => {
			expect(DEFAULT_PATHS.input.policies).toBe('sources/cello/hr-policies/');
			expect(DEFAULT_PATHS.input.sections).toBe('.aria/exports/cello/hr-policies/');
			expect(DEFAULT_PATHS.output.sections).toBe('.aria/exports/cello/hr-policies/');
			expect(DEFAULT_PATHS.output.dir).toBe('.aria/db/hr-policy');
			expect(DEFAULT_PATHS.database.decomposer).toBe('.aria/db/hr-policy/hr-policy.db');
			expect(DEFAULT_PATHS.database.indexer).toBe('.aria/db/hr-policy/hr-policy.sqlite');
		});
	});

	describe('DEFAULT_LOGGING constant', () => {
		it('given DEFAULT_LOGGING, when accessed, then contains all required logging settings', () => {
			expect(DEFAULT_LOGGING.level).toBe('info');
			expect(DEFAULT_LOGGING.verbose).toBe(false);
			expect(DEFAULT_LOGGING.file).toBe('.aria/logs/hr-policy.log');
			expect(DEFAULT_LOGGING.maxFileSizeMb).toBe(10);
			expect(DEFAULT_LOGGING.maxFiles).toBe(7);
		});
	});

	describe('DEFAULT_DOC_INDEXER_CONFIG constant', () => {
		it('given DEFAULT_DOC_INDEXER_CONFIG, when accessed, then contains all required indexer settings', () => {
			expect(DEFAULT_DOC_INDEXER_CONFIG.logging).toEqual(DEFAULT_LOGGING);
			expect(DEFAULT_DOC_INDEXER_CONFIG.weightResponse).toBe(1.8);
			expect(DEFAULT_DOC_INDEXER_CONFIG.useFts).toBe(true);
			expect(DEFAULT_DOC_INDEXER_CONFIG.hybrid).toBe(true);
			expect(DEFAULT_DOC_INDEXER_CONFIG.alpha).toBe(0.1);
			expect(DEFAULT_DOC_INDEXER_CONFIG.showMetadata).toBe(true);
			expect(DEFAULT_DOC_INDEXER_CONFIG.highlight).toBe(true);
		});
	});

	describe('tilde expansion', () => {
		it('given config with tilde paths, when loadConfig called, then tildes are expanded to home directory', async () => {
			const tempDir = await fs.mkdtemp(path.join(homedir(), '.aria-test-'));
			const tempConfigPath = path.join(tempDir, 'config.yaml');
			await fs.writeFile(
				tempConfigPath,
				`
hr-policy:
    paths:
        output:
            dir: '~/.aria/output'
logging:
    file: '~/.aria/logs/hr-policy.log'
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
