import { homedir } from 'node:os';
import * as path from 'node:path';
import * as fs from 'fs-extra';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/lib/config.js';

describe('Config Integration', () => {
	describe('YAML file loading', () => {
		it('given valid config file, when loadConfig called, then returns valid config structure', async () => {
			const tempDir = await fs.mkdtemp(path.join(homedir(), '.aria-test-'));
			const tempConfigPath = path.join(tempDir, 'config.yaml');
			await fs.writeFile(tempConfigPath, '{}');

			try {
				const config = loadConfig(tempConfigPath);

				expect(config).toHaveProperty('doc-converter');
				expect(config).toHaveProperty('logging');
				expect(typeof config['doc-converter']).toBe('object');
				expect(typeof config.logging).toBe('object');
			} finally {
				await fs.remove(tempDir);
			}
		});

		it('given loaded config, when checked for tilde paths, then no unexpanded tildes remain', async () => {
			const tempDir = await fs.mkdtemp(path.join(homedir(), '.aria-test-'));
			const tempConfigPath = path.join(tempDir, 'config.yaml');
			await fs.writeFile(
				tempConfigPath,
				`
doc-converter:
    paths:
        output:
            dir: '~/.aria/output'
logging:
    file: '~/.aria/logs/doc-converter.log'
`
			);

			try {
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
