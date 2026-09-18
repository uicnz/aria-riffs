import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('image-sanitiser Config', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();
		// Clear environment variables
		delete process.env['IMAGE_SANITISER_MAX_FILE_SIZE_MB'];
		delete process.env['IMAGE_SANITISER_USE_SHARP_METADATA'];
		delete process.env['IMAGE_SANITISER_STRICT_MODE'];
		delete process.env['IMAGE_SANITISER_BACKUP_ORIGINALS'];
		delete process.env['IMAGE_SANITISER_LOG_LEVEL'];
		delete process.env['IMAGE_SANITISER_LOG_VERBOSE'];
		delete process.env['IMAGE_SANITISER_LOG_FILE'];
		delete process.env['IMAGE_SANITISER_LOG_MAX_FILE_SIZE_MB'];
		delete process.env['IMAGE_SANITISER_LOG_MAX_FILES'];
		delete process.env['IMAGE_SANITISER_LOG_CONSOLE_COLORS'];
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('loadConfig', () => {
		it('should load configuration with default values', async () => {
			const { loadConfig } = await import('../../src/lib/config.js');

			// Test against default values from Zod schema
			const config = loadConfig();

			const riffConfig = config['image-sanitiser'];
			expect(riffConfig.images.maxFileSizeMb).toBe(100);
			expect(riffConfig.images.verifyAfterRename).toBe(true);
			expect(riffConfig.images.supportedExtensions).toContain('.jpg');
			expect(riffConfig.fileOperations.safeMoveRetries).toBe(3);
			expect(riffConfig.detection.useSharpMetadata).toBe(true);
			expect(config.logging.level).toBe('info');
			expect(riffConfig.processing.progressBar).toBe(true);
			expect(riffConfig.database.tableName).toBe('images');
		});

		it('should apply IMAGE_SANITISER_MAX_FILE_SIZE_MB environment variable override', async () => {
			process.env['IMAGE_SANITISER_MAX_FILE_SIZE_MB'] = '50';

			vi.resetModules();
			const { loadConfig } = await import('../../src/lib/config.js');
			const config = loadConfig();

			expect(config['image-sanitiser'].images.maxFileSizeMb).toBe(50);
		});

		it('should apply IMAGE_SANITISER_USE_SHARP_METADATA environment variable override', async () => {
			process.env['IMAGE_SANITISER_USE_SHARP_METADATA'] = 'false';

			vi.resetModules();
			const { loadConfig } = await import('../../src/lib/config.js');
			const config = loadConfig();

			expect(config['image-sanitiser'].detection.useSharpMetadata).toBe(false);
		});

		it('should apply IMAGE_SANITISER_STRICT_MODE environment variable override', async () => {
			process.env['IMAGE_SANITISER_STRICT_MODE'] = 'true';

			vi.resetModules();
			const { loadConfig } = await import('../../src/lib/config.js');
			const config = loadConfig();

			expect(config['image-sanitiser'].detection.strictMode).toBe(true);
		});

		it('should apply IMAGE_SANITISER_BACKUP_ORIGINALS environment variable override', async () => {
			process.env['IMAGE_SANITISER_BACKUP_ORIGINALS'] = 'true';

			vi.resetModules();
			const { loadConfig } = await import('../../src/lib/config.js');
			const config = loadConfig();

			expect(config['image-sanitiser'].fileOperations.backupOriginals).toBe(true);
		});

		it('should apply logging environment variable overrides', async () => {
			process.env['IMAGE_SANITISER_LOG_LEVEL'] = 'debug';
			process.env['IMAGE_SANITISER_LOG_VERBOSE'] = 'true';
			process.env['IMAGE_SANITISER_LOG_FILE'] = '/custom/log/path.log';

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
			const riffConfig = config['image-sanitiser'];
			expect(riffConfig.images).toBeDefined();
			expect(typeof riffConfig.images).toBe('object');
			expect(riffConfig.detection).toBeDefined();
			expect(typeof riffConfig.detection).toBe('object');

			// Test array access from schema defaults
			expect(Array.isArray(riffConfig.images.supportedExtensions)).toBe(true);
			expect(riffConfig.images.supportedExtensions).toContain('.png');
			expect(riffConfig.images.supportedExtensions).toContain('.jpg');
		});
	});

	describe('config file loading', () => {
		it('given partial images config, when loaded, then merges with defaults', async () => {
			const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'config-test-'));
			const tempConfigPath = path.join(tempDir, 'config.yaml');

			await fs.writeFile(
				tempConfigPath,
				`
image-sanitiser:
    images:
        maxFileSizeMb: 25
`
			);

			vi.resetModules();
			const { loadConfig } = await import('../../src/lib/config.js');

			try {
				const config = loadConfig(tempConfigPath);

				const riffConfig = config['image-sanitiser'];
				expect(riffConfig.images.maxFileSizeMb).toBe(25);
				expect(riffConfig.images.supportedExtensions).toContain('.jpg');
				expect(riffConfig.images.verifyAfterRename).toBe(true);
			} finally {
				await fs.remove(tempDir);
			}
		});

		it('given partial detection config, when loaded, then merges with defaults', async () => {
			const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'config-test-'));
			const tempConfigPath = path.join(tempDir, 'config.yaml');

			await fs.writeFile(
				tempConfigPath,
				`
image-sanitiser:
    detection:
        strictMode: true
`
			);

			vi.resetModules();
			const { loadConfig } = await import('../../src/lib/config.js');

			try {
				const config = loadConfig(tempConfigPath);

				const riffConfig = config['image-sanitiser'];
				expect(riffConfig.detection.strictMode).toBe(true);
				expect(riffConfig.detection.useSharpMetadata).toBe(true);
				expect(riffConfig.detection.preferSharpOverMagic).toBe(false);
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
			const tempConfigPath = path.join(tempDir, 'config.yaml');

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

			const riffConfig = config['image-sanitiser'];
			expect(riffConfig.paths.database.file).not.toContain('~/');
			expect(riffConfig.paths.database.file).toMatch(/^\//);
			expect(riffConfig.paths.database.file).toContain('.aria/db/image-sanitiser/image-sanitiser.sqlite');
			expect(riffConfig.database.tableName).toBe('images');
			expect(riffConfig.database.journalMode).toBe('DELETE');
		});
	});

	describe('tilde expansion', () => {
		it('given config with tilde paths, when loadConfig called, then tildes are expanded to home directory', async () => {
			const tempDir = await fs.mkdtemp(path.join(os.homedir(), '.aria-test-'));
			const tempConfigPath = path.join(tempDir, 'config.yaml');

			await fs.writeFile(
				tempConfigPath,
				`
image-sanitiser:
    paths:
        output:
            dir: '~/.aria/output'
        database:
            file: '~/.aria/db/test.sqlite'
logging:
    file: '~/.aria/logs/image-sanitiser.log'
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
