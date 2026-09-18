import * as fs from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildEmbeddingConfig, loadDocIndexerConfig } from '../../src/lib/config.js';

describe('Configuration Loading Pipeline Integration', () => {
	let testConfigDir: string;
	let testConfigPath: string;

	beforeEach(async () => {
		testConfigDir = `/tmp/hr-policy-config-test-${Date.now()}`;
		testConfigPath = path.join(testConfigDir, 'config.yaml');
		await fs.mkdir(testConfigDir, { recursive: true });
	});

	afterEach(async () => {
		try {
			await fs.rm(testConfigDir, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
	});

	it('given config file with indexer settings, when loadDocIndexerConfig called, then returns config object', async () => {
		const configContent = `hr-policy:
  embeddings:
    provider: 'openai'
  indexer:
    weightResponse: 2.0
logging:
  level: 'info'`;

		await fs.writeFile(testConfigPath, configContent);

		const config = await loadDocIndexerConfig(testConfigPath);

		// Verify function returns a valid config object
		expect(config).toBeDefined();
		expect(config.weightResponse).toBeGreaterThan(0);
		expect(config.maxEmbedChars).toBeGreaterThan(0);
	});

	it('given partial config file, when loadDocIndexerConfig called, then defaults are applied', async () => {
		const configContent = `hr-policy:
  embeddings:
    provider: 'openai'
  indexer:
    weightResponse: 1.5
logging:
  level: 'info'`;

		await fs.writeFile(testConfigPath, configContent);

		const config = await loadDocIndexerConfig(testConfigPath);

		// Specified value
		expect(config.weightResponse).toBe(1.5);

		// Default values for unspecified settings
		expect(config.maxEmbedChars).toBe(35000);
		expect(config.useFts).toBe(true);
		expect(config.hybrid).toBe(true);
		expect(config.alpha).toBe(0.1);
		expect(config.showMetadata).toBe(true);
		expect(config.highlight).toBe(true);
	});

	it('given missing config file with explicit path, when loadDocIndexerConfig called, then throws error', async () => {
		await expect(loadDocIndexerConfig('/nonexistent/path/config.yaml')).rejects.toThrow('Config file not found');
	});

	it('given yaml with camelCase keys in config, when loadDocIndexerConfig called, then loads successfully', async () => {
		const configContent = `hr-policy:
  embeddings:
    provider: 'openai'
  indexer:
    weightResponse: 1.9
logging:
  level: 'info'`;

		await fs.writeFile(testConfigPath, configContent);

		const config = await loadDocIndexerConfig(testConfigPath);

		// Verify function loads config successfully
		expect(config).toBeDefined();
		expect(typeof config.weightResponse).toBe('number');
	});

	it('given embedding config with OpenAI provider, when buildEmbeddingConfig called, then returns valid config', async () => {
		const configContent = `hr-policy:
  embeddings:
    provider: openai
    openai:
      model: text-embedding-3-large
      dimensions: 3072
logging:
  level: 'info'`;

		await fs.writeFile(testConfigPath, configContent);

		const config = buildEmbeddingConfig();

		// Verify config has required fields
		expect(config).toBeDefined();
		expect(config.provider).toBeDefined();
		expect(config.model).toBeDefined();
		expect(config.dimensions).toBeGreaterThan(0);
	});

	it('given embedding config, when buildEmbeddingConfig called, then returns valid embedding config', async () => {
		const configContent = `hr-policy:
  embeddings:
    provider: openai
    openai:
      model: text-embedding-3-small
      dimensions: 1536
logging:
  level: 'info'`;

		await fs.writeFile(testConfigPath, configContent);

		const config = buildEmbeddingConfig();

		// Verify config has required fields
		expect(config).toBeDefined();
		expect(config.provider).toBeDefined();
		expect(config.model).toBeDefined();
		expect(config.dimensions).toBeGreaterThan(0);
	});

	it('given embedding config, when buildEmbeddingConfig called, then returns default config', async () => {
		const config = buildEmbeddingConfig();

		// Should return some valid config (likely defaults)
		expect(config).toBeDefined();
		expect(typeof config.provider).toBe('string');
		expect(config.dimensions).toBeGreaterThan(0);
	});

	it('given empty config file, when loadDocIndexerConfig called, then all defaults applied', async () => {
		const configContent = `hr-policy: {}
logging:
  level: 'info'`;
		await fs.writeFile(testConfigPath, configContent);

		const config = await loadDocIndexerConfig(testConfigPath);

		expect(config.maxEmbedChars).toBe(35000);
		expect(config.weightResponse).toBe(1.8);
		expect(config.useFts).toBe(true);
		expect(config.hybrid).toBe(true);
		expect(config.alpha).toBe(0.1);
		expect(config.showMetadata).toBe(true);
		expect(config.highlight).toBe(true);
	});

	it('given multiple config files with different paths, when loadDocIndexerConfig called separately, then each returns correct config', async () => {
		const config1Path = path.join(testConfigDir, 'config1.yaml');
		const config2Path = path.join(testConfigDir, 'config2.yaml');

		await fs.writeFile(
			config1Path,
			`hr-policy:
  embeddings:
    provider: 'openai'
  indexer:
    weightResponse: 1.5
    useFts: false
logging:
  level: 'info'`
		);

		await fs.writeFile(
			config2Path,
			`hr-policy:
  embeddings:
    provider: 'openai'
  indexer:
    weightResponse: 2.5
    useFts: true
logging:
  level: 'info'`
		);

		const result1 = await loadDocIndexerConfig(config1Path);
		const result2 = await loadDocIndexerConfig(config2Path);

		expect(result1.weightResponse).toBe(1.5);
		expect(result1.useFts).toBe(false);

		expect(result2.weightResponse).toBe(2.5);
		expect(result2.useFts).toBe(true);
	});

	it('given config with paths section at riff level, when loadDocIndexerConfig called, then indexer settings use defaults', async () => {
		const configContent = `hr-policy:
  paths:
    input:
      policies: /custom/input
      sections: /custom/indexes
    output:
      sections: /custom/output
      dir: /custom/output-dir
    database:
      decomposer: /custom/db.db
      indexer: /custom/db.sqlite
  embeddings:
    provider: 'openai'
logging:
  level: 'info'`;

		await fs.writeFile(testConfigPath, configContent);

		const config = await loadDocIndexerConfig(testConfigPath);

		// Config should still have indexer settings with defaults
		expect(config.maxEmbedChars).toBe(35000);
		expect(config.weightResponse).toBe(1.8);
	});

	it('given incomplete alpha value, when config parsed, then alpha defaults to 0.1', async () => {
		const configContent = `hr-policy:
  embeddings:
    provider: 'openai'
  indexer:
    weightResponse: 1.8
logging:
  level: 'info'`;

		await fs.writeFile(testConfigPath, configContent);

		const config = await loadDocIndexerConfig(testConfigPath);

		expect(config.alpha).toBe(0.1);
	});

	it('given config with numeric values in YAML, when loaded, then values are accessible', async () => {
		const configContent = `hr-policy:
  embeddings:
    provider: 'openai'
  indexer:
    weightResponse: 2.0
    alpha: 0.5
logging:
  level: 'info'`;

		await fs.writeFile(testConfigPath, configContent);

		const config = await loadDocIndexerConfig(testConfigPath);

		// Verify config returns values
		expect(config).toBeDefined();
		expect(config.weightResponse).toBeGreaterThan(0);
		expect(config.alpha).toBeGreaterThan(0);
	});
});
