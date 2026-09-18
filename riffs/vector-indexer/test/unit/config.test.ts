/**
 * Unit tests for configuration loading
 */

import { homedir } from 'node:os';
import * as path from 'node:path';
import * as fs from 'fs-extra';
import { describe, expect, it, vi } from 'vitest';
import { getDefaultConfig } from '../../src/lib/config.js';

describe('Configuration', () => {
	it('should return default configuration', () => {
		const config = getDefaultConfig();

		expect(config).toBeDefined();
		expect(config.ollama.host).toBe('http://localhost:11434');
		expect(config.qdrant.port).toBe(6333);
		expect(config.embedding.model).toBe('qwen3-embedding:8b');
	});

	it('should have valid embedding configuration', () => {
		const config = getDefaultConfig();

		expect(config.embedding.dimensions).toBeGreaterThan(0);
		expect(config.embedding.batchSize).toBeGreaterThan(0);
		expect(config.embedding.model).toBeTruthy();
		expect(config.embedding.fallbackModel).toBeTruthy();
	});

	it('should have valid logging configuration', () => {
		const config = getDefaultConfig();

		expect(config.logging.level).toBeTruthy();
		expect(['debug', 'info', 'warn', 'error']).toContain(config.logging.level);
		expect(config.logging.maxFileSizeMb).toBeGreaterThan(0);
		expect(config.logging.maxFiles).toBeGreaterThan(0);
	});

	describe('tilde expansion', () => {
		it('given config with tilde paths, when loadConfig called, then tildes are expanded to home directory', async () => {
			const tempDir = await fs.mkdtemp(path.join(homedir(), '.aria-test-'));
			const tempConfigPath = path.join(tempDir, 'tilde-config.yaml');
			await fs.writeFile(
				tempConfigPath,
				`
vector-indexer:
    paths:
        output:
            dir: '~/.aria/output'
logging:
    file: '~/.aria/logs/vector-indexer.log'
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
