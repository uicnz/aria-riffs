import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as fs from 'fs-extra';
import { describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../../src/lib/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Config - Unit Tests', () => {
	it('given config file, when loadConfig called, then returns config with defaults applied', () => {
		const config = loadConfig();

		expect(config).toBeDefined();
		const riffConfig = config['image-transcoder'];
		expect(riffConfig.transcoding.maxFileSizeBytes).toBe(5242880);
		expect(riffConfig.transcoding.quality).toBe(85);
	});

	it('given missing config file, when loadConfig called with nonexistent path, then throws error', () => {
		expect(() => loadConfig('/nonexistent/path/config.yaml')).toThrow('Config file not found');
	});

	it('given partial config file with only quality, when loadConfig called, then merges with defaults', () => {
		const partialConfigPath = path.resolve(__dirname, '../fixtures/partial-config.yaml');
		const config = loadConfig(partialConfigPath);

		expect(config).toBeDefined();
		const riffConfig = config['image-transcoder'];
		expect(riffConfig.transcoding.maxFileSizeBytes).toBe(5242880); // Default
		expect(riffConfig.transcoding.quality).toBe(90); // From partial config
	});

	it('given partial config file with only max_file_size, when loadConfig called, then merges with defaults', () => {
		const partialConfigPath = path.resolve(__dirname, '../fixtures/partial-max-size-config.yaml');
		const config = loadConfig(partialConfigPath);

		expect(config).toBeDefined();
		const riffConfig = config['image-transcoder'];
		expect(riffConfig.transcoding.maxFileSizeBytes).toBe(10485760); // From partial config (10MB)
		expect(riffConfig.transcoding.quality).toBe(85); // Default
	});

	it('given config with output_dir, when loadConfig called, then returns output_dir from config', () => {
		const configPath = path.resolve(__dirname, '../fixtures/output-dir-config.yaml');
		const config = loadConfig(configPath);

		expect(config).toBeDefined();
		expect(config['image-transcoder'].paths.output.dir).toBe('/custom/output/path');
	});

	it('given no output dir specified, when loadConfig called, then output dir is null', () => {
		const config = loadConfig();

		expect(config).toBeDefined();
		expect(config['image-transcoder'].paths.output.dir).toBeNull();
	});

	it('given logging config in file, when loadConfig called, then returns logging settings', () => {
		const config = loadConfig();

		expect(config.logging).toBeDefined();
		expect(config.logging.level).toBe('info');
		expect(config.logging.file).not.toContain('~/');
		expect(config.logging.file).toMatch(/^\//);
		expect(config.logging.file).toContain('.aria/logs/image-transcoder.log');
	});

	describe('tilde expansion', () => {
		it('given config with tilde paths, when loadConfig called, then tildes are expanded to home directory', async () => {
			const tempDir = await fs.mkdtemp(path.join(homedir(), '.aria-test-'));
			const tempConfigPath = path.join(tempDir, 'tilde-config.yaml');
			await fs.writeFile(
				tempConfigPath,
				`
image-transcoder:
    paths:
        output:
            dir: '~/.aria/output'
logging:
    file: '~/.aria/logs/image-transcoder.log'
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
