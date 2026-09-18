/** Package-local script audit for the canonical Riff scaffold. */

import { resolve } from 'node:path';
import { readFileIfExists } from './utils.js';

export interface ScriptsAuditResult {
	packageJsonExists: boolean;
	hasStartScript: boolean;
	hasTestScript: boolean;
	hasTypecheckScript: boolean;
	missingScripts: string[];
	nonCanonicalScripts: string[];
}

function canonicalScripts(riff: string): Record<'start' | 'test' | 'typecheck', string> {
	return {
		start: 'bun src/cli.ts',
		test: `vitest run --coverage --coverage.reportsDirectory=../../coverage/${riff} --coverage.include='**/*.ts' test/`,
		typecheck: 'tsc --noEmit -p tsconfig.json',
	};
}

export function auditScripts(riff: string, repoRoot: string): ScriptsAuditResult {
	const packageJsonPath = resolve(repoRoot, 'riffs', riff, 'package.json');
	const content = readFileIfExists(packageJsonPath);
	const expected = canonicalScripts(riff);
	const requiredNames = Object.keys(expected) as Array<keyof typeof expected>;

	if (!content) {
		return {
			packageJsonExists: false,
			hasStartScript: false,
			hasTestScript: false,
			hasTypecheckScript: false,
			missingScripts: requiredNames,
			nonCanonicalScripts: [],
		};
	}

	let packageJson: { scripts?: Record<string, string> };
	try {
		packageJson = JSON.parse(content) as { scripts?: Record<string, string> };
	} catch {
		return {
			packageJsonExists: true,
			hasStartScript: false,
			hasTestScript: false,
			hasTypecheckScript: false,
			missingScripts: requiredNames,
			nonCanonicalScripts: [],
		};
	}

	const scripts = packageJson.scripts ?? {};
	const missingScripts = requiredNames.filter(name => !Object.hasOwn(scripts, name));
	const nonCanonicalScripts = requiredNames
		.filter(name => Object.hasOwn(scripts, name) && scripts[name] !== expected[name])
		.map(name => `${name}: expected "${expected[name]}", got "${scripts[name]}"`);

	return {
		packageJsonExists: true,
		hasStartScript: Object.hasOwn(scripts, 'start'),
		hasTestScript: Object.hasOwn(scripts, 'test'),
		hasTypecheckScript: Object.hasOwn(scripts, 'typecheck'),
		missingScripts,
		nonCanonicalScripts,
	};
}
