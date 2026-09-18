import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { auditEnv } from '../../src/audits/env-audit.js';

const TEST_ROOT = resolve(tmpdir(), 'aria-env-audit-test');

function writeConfig(source: string): void {
	const path = resolve(TEST_ROOT, 'riffs', 'example-riff', 'src', 'lib', 'config.ts');
	mkdirSync(resolve(path, '..'), { recursive: true });
	writeFileSync(path, source, 'utf8');
}

function writeSource(relativePath: string, source: string): void {
	const path = resolve(TEST_ROOT, 'riffs', 'example-riff', 'src', relativePath);
	mkdirSync(resolve(path, '..'), { recursive: true });
	writeFileSync(path, source, 'utf8');
}

describe('Environment Audit', () => {
	beforeEach(() => {
		mkdirSync(TEST_ROOT, { recursive: true });
	});

	afterEach(() => {
		rmSync(TEST_ROOT, { recursive: true, force: true });
	});

	it('accepts Riff-owned and provider-boundary environment variables', () => {
		writeConfig(`
            import { ExampleRiffConfigSchema, type ExampleRiffConfig } from './schema.js';
            function applyEnvOverrides(config: ExampleRiffConfig): ExampleRiffConfig {
                config['example-riff'].value = process.env['EXAMPLE_RIFF_VALUE'];
                const apiKey = process.env['ANTHROPIC_API_KEY'];
                return config;
            }
            export function loadConfig(): ExampleRiffConfig {
                return applyEnvOverrides(ExampleRiffConfigSchema.parse({}));
            }
            export class ConfigError extends Error {}
        `);

		const result = auditEnv('example-riff', TEST_ROOT);

		expect(result.envPrefixUsed).toBe(true);
		expect(result.envSharedVarsUsed).toEqual(['ANTHROPIC_API_KEY']);
		expect(result.envNonCanonicalVars).toEqual([]);
	});

	it('rejects unowned generic aliases without per-Riff exceptions', () => {
		writeConfig(`
            const output = process.env['OUTPUT_DIRECTORY'];
            const trace = process.env.TRACE_DIRECTORY;
        `);

		const result = auditEnv('example-riff', TEST_ROOT);

		expect(result.envNonCanonicalVars).toEqual(['OUTPUT_DIRECTORY', 'TRACE_DIRECTORY']);
	});

	it('rejects provider key aliases anywhere in shipped source', () => {
		writeConfig(`
            const output = process.env['EXAMPLE_RIFF_OUTPUT'];
        `);
		writeSource('core/provider.ts', `export const key = process.env['GEMINI_API_KEY'];`);

		const result = auditEnv('example-riff', TEST_ROOT);

		expect(result.envNonCanonicalVars).toEqual(['GEMINI_API_KEY']);
		expect(result.providerKeyNamesUsed).toEqual(['GEMINI_API_KEY']);
		expect(result.nonCanonicalProviderKeyNames).toEqual(['GEMINI_API_KEY']);
	});

	it('accepts the canonical Aria dotenv names and precedence', () => {
		writeConfig(`
            import { loadDotEnv } from './load-dotenv.js';
            import { ExampleRiffConfigSchema, type ExampleRiffConfig } from './schema.js';
            function applyEnvOverrides(config: ExampleRiffConfig): ExampleRiffConfig {
                config['example-riff'].value = process.env['EXAMPLE_RIFF_VALUE'];
                return config;
            }
            export function loadConfig(): ExampleRiffConfig {
                loadDotEnv();
                return applyEnvOverrides(ExampleRiffConfigSchema.parse({}));
            }
            export class ConfigError extends Error {}
        `);
		writeSource(
			'lib/load-dotenv.ts',
			`
                export const ARIA_HOME = '/tmp/.aria';
                export function getAriaHome(): string { return ARIA_HOME; }
                export function loadDotEnv(cwd: string = process.cwd()): void {
                    const paths: string[] = [];
                    const projectEnv = resolve(cwd, '.aria', '.env');
                    const userEnv = join(getAriaHome(), '.env');
                    if (existsSync(projectEnv)) paths.push(projectEnv);
                    if (existsSync(userEnv)) paths.push(userEnv);
                    for (const key of paths) {
                        if (typeof process.env[key] === 'string') continue;
                    }
                }
            `
		);

		const result = auditEnv('example-riff', TEST_ROOT);

		expect(result.dotEnvLoaderExists).toBe(true);
		expect(result.hasAriaHomeConstant).toBe(true);
		expect(result.hasGetAriaHome).toBe(true);
		expect(result.hasLoadDotEnv).toBe(true);
		expect(result.hasCanonicalDotEnvPrecedence).toBe(true);
		expect(result.configLoadsDotEnv).toBe(true);
	});
});
