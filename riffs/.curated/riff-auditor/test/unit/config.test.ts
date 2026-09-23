import { homedir } from 'node:os';
import * as path from 'node:path';
import * as fs from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('riff-auditor Config', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();
		delete process.env['RIFF_AUDITOR_OUTPUT_DIRECTORY'];
		delete process.env['RIFF_AUDITOR_OUTPUT_FILENAME'];
		delete process.env['RIFF_AUDITOR_LOG_LEVEL'];
		delete process.env['RIFF_AUDITOR_LOG_VERBOSE'];
		delete process.env['RIFF_AUDITOR_LOG_FILE'];
		delete process.env['RIFF_AUDITOR_LOG_MAX_FILE_SIZE_MB'];
		delete process.env['RIFF_AUDITOR_LOG_MAX_FILES'];
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('schema defaults', () => {
		it('given no config file, when loadConfig called with missing path, then returns valid config with correct types', async () => {
			const tempDir = await fs.mkdtemp(path.join(homedir(), '.aria-test-'));

			try {
				const { loadConfig } = await import('../../src/lib/config.js');
				const emptyConfigPath = path.join(tempDir, 'config.yaml');
				await fs.writeFile(emptyConfigPath, '');

				const config = loadConfig(emptyConfigPath);

				expect(config).toHaveProperty('riff-auditor');
				expect(config).toHaveProperty('logging');
				expect(typeof config['riff-auditor'].paths.output.dir).toBe('string');
				expect(typeof config['riff-auditor'].paths.output.filename).toBe('string');
				expect(typeof config.logging.level).toBe('string');
				expect(typeof config.logging.verbose).toBe('boolean');
				expect(typeof config.logging.maxFileSizeMb).toBe('number');
				expect(typeof config.logging.maxFiles).toBe('number');
			} finally {
				await fs.remove(tempDir);
			}
		});
	});

	describe('partial merge', () => {
		it('given partial config, when loaded, then merges with schema defaults', async () => {
			const tempDir = await fs.mkdtemp(path.join(homedir(), '.aria-test-'));
			const tempConfigPath = path.join(tempDir, 'config.yaml');

			await fs.writeFile(
				tempConfigPath,
				`
riff-auditor:
    paths:
        output:
            filename: custom-audit.json
`
			);

			try {
				const { loadConfig } = await import('../../src/lib/config.js');
				const config = loadConfig(tempConfigPath);

				expect(config['riff-auditor'].paths.output.filename).toBe('custom-audit.json');
				// Other fields get defaults
				expect(typeof config['riff-auditor'].paths.output.dir).toBe('string');
				expect(typeof config['riff-auditor'].paths.output.filename).toBe('string');
				expect(config.logging.level).toBeDefined();
			} finally {
				await fs.remove(tempDir);
			}
		});
	});

	describe('env overrides', () => {
		it('given RIFF_AUDITOR_OUTPUT_DIRECTORY env var, when loadConfig called, then overrides output dir', async () => {
			process.env['RIFF_AUDITOR_OUTPUT_DIRECTORY'] = '/custom/output';

			vi.resetModules();
			const { loadConfig } = await import('../../src/lib/config.js');
			const config = loadConfig();

			expect(config['riff-auditor'].paths.output.dir).toBe('/custom/output');
		});

		it('given RIFF_AUDITOR_LOG_LEVEL env var, when loadConfig called, then overrides log level', async () => {
			process.env['RIFF_AUDITOR_LOG_LEVEL'] = 'debug';

			vi.resetModules();
			const { loadConfig } = await import('../../src/lib/config.js');
			const config = loadConfig();

			expect(config.logging.level).toBe('debug');
		});

		it('given RIFF_AUDITOR_LOG_VERBOSE env var, when loadConfig called, then overrides verbose flag', async () => {
			process.env['RIFF_AUDITOR_LOG_VERBOSE'] = 'true';

			vi.resetModules();
			const { loadConfig } = await import('../../src/lib/config.js');
			const config = loadConfig();

			expect(config.logging.verbose).toBe(true);
		});
	});

	describe('error handling', () => {
		it('given non-existent explicit config path, when loadConfig called, then throws ConfigError', async () => {
			const { loadConfig, ConfigError } = await import('../../src/lib/config.js');

			expect(() => loadConfig('/non/existent/config.yaml')).toThrow(ConfigError);
			expect(() => loadConfig('/non/existent/config.yaml')).toThrow('Config file not found');
		});

		it('given invalid YAML config, when loaded, then throws ConfigError', async () => {
			const tempDir = await fs.mkdtemp(path.join(homedir(), '.aria-test-'));
			const tempConfigPath = path.join(tempDir, 'config.yaml');

			await fs.writeFile(tempConfigPath, 'invalid: yaml: content: [');

			try {
				const { loadConfig, ConfigError } = await import('../../src/lib/config.js');
				expect(() => loadConfig(tempConfigPath)).toThrow(ConfigError);
			} finally {
				await fs.remove(tempDir);
			}
		});
	});

	describe('tilde expansion', () => {
		it('given config with tilde paths, when loadConfig called, then tildes are expanded to home directory', async () => {
			const tempDir = await fs.mkdtemp(path.join(homedir(), '.aria-test-'));
			const tempConfigPath = path.join(tempDir, 'config.yaml');

			await fs.writeFile(
				tempConfigPath,
				`
riff-auditor:
    paths:
        input:
            riffs: '~/.aria/riffs'
        output:
            dir: '~/.aria/audits'
logging:
    file: '~/.aria/logs/riff-auditor.log'
`
			);

			try {
				vi.resetModules();
				const { loadConfig } = await import('../../src/lib/config.js');
				const config = loadConfig(tempConfigPath);

				// Walk config and assert no unexpanded tildes remain
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

				// Verify paths are absolute
				expect(config['riff-auditor'].paths.output.dir).toMatch(/^\//);
				expect(config['riff-auditor'].paths.input.riffs).toMatch(/^\//);
				expect(config.logging.file).toMatch(/^\//);
			} finally {
				await fs.remove(tempDir);
			}
		});
	});

	describe('type contracts', () => {
		it('given loaded config, then required fields exist with correct types', async () => {
			const { loadConfig } = await import('../../src/lib/config.js');
			const config = loadConfig();

			// Riff section exists
			expect(config['riff-auditor']).toBeDefined();
			expect(typeof config['riff-auditor']).toBe('object');

			// Nested objects accessible
			expect(config['riff-auditor'].paths).toBeDefined();
			expect(config['riff-auditor'].audits).toBeDefined();
			expect(config['riff-auditor'].rules).toBeDefined();

			// Logging section exists
			expect(config.logging).toBeDefined();
			expect(typeof config.logging).toBe('object');

			// Audit toggles are booleans
			expect(typeof config['riff-auditor'].audits.config).toBe('boolean');
			expect(typeof config['riff-auditor'].audits.schema).toBe('boolean');
			expect(typeof config['riff-auditor'].audits.configTest).toBe('boolean');
		});
	});
});
