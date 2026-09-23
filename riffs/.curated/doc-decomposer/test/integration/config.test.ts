import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/lib/config.js';

describe('Config Integration', () => {
	describe('YAML file loading', () => {
		it('given actual config file, when loadConfig called, then returns valid config structure', () => {
			const config = loadConfig();

			expect(config).toHaveProperty('doc-decomposer');
			expect(config).toHaveProperty('logging');
			expect(typeof config['doc-decomposer']).toBe('object');
			expect(typeof config.logging).toBe('object');
		});

		it('given loaded config, when checked for tilde paths, then no unexpanded tildes remain', () => {
			const config = loadConfig();

			const assertNoTildes = (obj: unknown, path = ''): void => {
				if (typeof obj === 'string' && obj.startsWith('~/')) {
					throw new Error(`Unexpanded tilde at ${path}: ${obj}`);
				}
				if (obj && typeof obj === 'object') {
					for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
						assertNoTildes(value, `${path}.${key}`);
					}
				}
			};
			assertNoTildes(config);
		});
	});
});
