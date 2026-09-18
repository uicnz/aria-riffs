import { homedir } from 'node:os';
import * as path from 'node:path';
import * as fs from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('dir-differ Config', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('schema defaults', () => {
		it('given empty config, when loadConfig called, then returns valid config with correct types', async () => {
			const tempDir = await fs.mkdtemp(path.join(homedir(), '.aria-test-'));
			const emptyConfigPath = path.join(tempDir, 'empty-config.yaml');
			await fs.writeFile(emptyConfigPath, '{}');

			try {
				const { loadConfig } = await import('../../src/lib/config.js');
				const config = loadConfig(emptyConfigPath);

				expect(config).toHaveProperty('dir-differ');
				expect(config).toHaveProperty('logging');
				expect(typeof config['dir-differ']).toBe('object');
				expect(typeof config.logging).toBe('object');
				expect(typeof config.logging.level).toBe('string');
				expect(typeof config.logging.verbose).toBe('boolean');
			} finally {
				await fs.remove(tempDir);
			}
		});
	});

	describe('error handling', () => {
		it('given non-existent explicit config path, when loadConfig called, then throws ConfigError', async () => {
			const { loadConfig, ConfigError } = await import('../../src/lib/config.js');

			expect(() => loadConfig('/non/existent/config.yaml')).toThrow(ConfigError);
			expect(() => loadConfig('/non/existent/config.yaml')).toThrow('Config file not found');
		});

		it('given invalid YAML config, when loaded, then throws error', async () => {
			const tempDir = await fs.mkdtemp(path.join(homedir(), '.aria-test-'));
			const tempConfigPath = path.join(tempDir, 'invalid-config.yaml');
			await fs.writeFile(tempConfigPath, 'invalid: yaml: content: [');

			try {
				const { loadConfig } = await import('../../src/lib/config.js');
				expect(() => loadConfig(tempConfigPath)).toThrow();
			} finally {
				await fs.remove(tempDir);
			}
		});
	});

	describe('tilde expansion', () => {
		it('given config with tilde paths, when loadConfig called, then tildes are expanded to home directory', async () => {
			const tempDir = await fs.mkdtemp(path.join(homedir(), '.aria-test-'));
			const tempConfigPath = path.join(tempDir, 'tilde-config.yaml');
			await fs.writeFile(
				tempConfigPath,
				`
dir-differ:
    paths:
        output:
            dir: '~/.aria/output'
logging:
    file: '~/.aria/logs/dir-differ.log'
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

	describe('type contracts', () => {
		it('given loaded config, then required fields exist with correct types', async () => {
			const { loadConfig } = await import('../../src/lib/config.js');
			const config = loadConfig();

			expect(config['dir-differ']).toBeDefined();
			expect(typeof config['dir-differ']).toBe('object');
			expect(config.logging).toBeDefined();
			expect(typeof config.logging).toBe('object');
		});
	});
});
