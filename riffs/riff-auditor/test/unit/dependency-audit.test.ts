import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { auditDependencies } from '../../src/audits/dependency-audit.js';

const TEST_ROOT = resolve(tmpdir(), 'aria-dependency-audit-test');

function writeJson(path: string, value: unknown): void {
	mkdirSync(resolve(path, '..'), { recursive: true });
	writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeSource(riff: string, source: string): void {
	const path = resolve(TEST_ROOT, 'riffs', riff, 'src', 'cli.ts');
	mkdirSync(resolve(path, '..'), { recursive: true });
	writeFileSync(path, source, 'utf8');
}

function writeRootManifest(): void {
	writeJson(resolve(TEST_ROOT, 'package.json'), {
		packageManager: 'bun@1.4.2',
		engines: {
			bun: '>=1.4.0',
			node: '>=26.0.0',
		},
	});
}

describe('Dependency Audit', () => {
	beforeEach(() => {
		mkdirSync(TEST_ROOT, { recursive: true });
	});

	afterEach(() => {
		rmSync(TEST_ROOT, { recursive: true, force: true });
	});

	it('given a standalone Bun package with aligned dependencies, when audited, then reports canonical dependencies', () => {
		writeRootManifest();
		writeJson(resolve(TEST_ROOT, 'riffs', 'test-riff', 'package.json'), {
			packageManager: 'bun@1.4.2',
			engines: {
				bun: '>=1.4.0',
				node: '>=26.0.0',
			},
			dependencies: {
				commander: '^15.0.0',
				pino: '^10.3.1',
			},
		});
		writeSource(
			'test-riff',
			[
				"import { Command } from 'commander';",
				"import pino from 'pino';",
				"// import ignored from 'comment-only-package'",
				"const dependencyName = 'example';",
				"const example = `import value from '" + '$' + "{dependencyName}'`;",
				'const quotedExample = "from \'string-only-package\'";',
			].join('\n')
		);
		const result = auditDependencies('test-riff', TEST_ROOT);

		expect(result.packageJsonValid).toBe(true);
		expect(result.packageManagerMatchesCanonical).toBe(true);
		expect(result.bunEngineMatchesCanonical).toBe(true);
		expect(result.nodeEngineMatchesCanonical).toBe(true);
		expect(result.dependenciesSorted).toBe(true);
		expect(result.invalidDependencySpecs).toEqual([]);
		expect(result.sharedDependencyVersionMismatches).toEqual([]);
		expect(result.undeclaredSourceDependencies).toEqual([]);
		expect(result.unusedDeclaredDependencies).toEqual([]);
		expect(result.hasCanonicalDependencies).toBe(true);
	});

	it('given supported module syntax, when audited, then collects executable specifiers only', () => {
		writeRootManifest();
		writeJson(resolve(TEST_ROOT, 'riffs', 'test-riff', 'package.json'), {
			packageManager: 'bun@1.4.2',
			engines: {
				bun: '>=1.4.0',
				node: '>=26.0.0',
			},
			dependencies: {
				'@scope/types': '^1.0.0',
				'dynamic-package': '^1.0.0',
				'exported-package': '^1.0.0',
				'required-package': '^1.0.0',
				'side-effect-package': '^1.0.0',
			},
		});
		writeSource(
			'test-riff',
			[
				"import type { Contract } from '@scope/types/subpath';",
				"import 'side-effect-package';",
				"export { value } from 'exported-package';",
				"const dynamic = import('dynamic-package');",
				"const required = require.resolve('required-package');",
			].join('\n')
		);

		const result = auditDependencies('test-riff', TEST_ROOT);

		expect(result.sourceDependencies).toEqual([
			'@scope/types',
			'dynamic-package',
			'exported-package',
			'required-package',
			'side-effect-package',
		]);
		expect(result.hasCanonicalDependencies).toBe(true);
	});

	it('given package identity and dependency drift, when audited, then reports every violation', () => {
		writeRootManifest();
		writeJson(resolve(TEST_ROOT, 'riffs', 'test-riff', 'package.json'), {
			packageManager: 'npm@11.0.0',
			engines: {
				bun: '>=1.3.0',
				node: '>=24.0.0',
			},
			dependencies: {
				pino: '^10.3.1',
				commander: '^15.0.0',
				zod: '4.6.5',
			},
		});
		writeJson(resolve(TEST_ROOT, 'riffs', 'other-riff', 'package.json'), {
			dependencies: {
				commander: '15.0.0',
			},
		});
		writeSource('test-riff', "import pino from 'pino';\nimport { parse } from 'yaml';\n");
		const result = auditDependencies('test-riff', TEST_ROOT);

		expect(result.packageManagerMatchesCanonical).toBe(false);
		expect(result.bunEngineMatchesCanonical).toBe(false);
		expect(result.nodeEngineMatchesCanonical).toBe(false);
		expect(result.dependenciesSorted).toBe(false);
		expect(result.invalidDependencySpecs).toEqual(['zod: 4.6.5']);
		expect(result.sharedDependencyVersionMismatches).toEqual(['commander: 15.0.0, ^15.0.0']);
		expect(result.undeclaredSourceDependencies).toEqual(['yaml']);
		expect(result.unusedDeclaredDependencies).toEqual(['commander', 'zod']);
		expect(result.hasCanonicalDependencies).toBe(false);
	});

	it('given invalid package JSON, when audited, then reports an invalid dependency contract', () => {
		writeRootManifest();
		const packagePath = resolve(TEST_ROOT, 'riffs', 'test-riff', 'package.json');
		mkdirSync(resolve(packagePath, '..'), { recursive: true });
		writeFileSync(packagePath, '{ invalid', 'utf8');

		const result = auditDependencies('test-riff', TEST_ROOT);

		expect(result.packageExists).toBe(true);
		expect(result.packageJsonValid).toBe(false);
		expect(result.hasCanonicalDependencies).toBe(false);
	});
});
