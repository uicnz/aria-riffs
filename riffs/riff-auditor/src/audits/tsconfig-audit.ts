/**
 * TSConfig file audits - ensures all riffs have the canonical tsconfig.json
 *
 * Riffs must have standalone, portable tsconfig.json files that don't extend
 * parent configs, enabling them to work independently of the platform.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// =============================================================================
// TYPES
// =============================================================================

export interface TsconfigAuditResult {
	tsconfigPath?: string;
	tsconfigExists: boolean;
	tsconfigMatchesCanonical: boolean;
	tsconfigHasExtends: boolean;
	tsconfigDifferences: string[];
}

// =============================================================================
// CANONICAL TSCONFIG
// =============================================================================

/**
 * The canonical tsconfig.json that all riffs must use exactly.
 * This is a standalone, portable configuration with no extends.
 */
export const CANONICAL_TSCONFIG = {
	compilerOptions: {
		outDir: 'dist',
		rootDir: '.',
		declaration: true,
		declarationMap: true,
		sourceMap: true,
		skipLibCheck: true,
		strict: true,
		alwaysStrict: true,
		allowUnreachableCode: false,
		allowUnusedLabels: false,
		exactOptionalPropertyTypes: false,
		noFallthroughCasesInSwitch: true,
		noImplicitAny: true,
		noImplicitOverride: true,
		noImplicitReturns: true,
		noImplicitThis: true,
		noPropertyAccessFromIndexSignature: false,
		noUncheckedIndexedAccess: false,
		noUnusedLocals: true,
		noUnusedParameters: true,
		strictBindCallApply: true,
		strictBuiltinIteratorReturn: true,
		strictFunctionTypes: true,
		strictNullChecks: true,
		strictPropertyInitialization: true,
		useUnknownInCatchVariables: true,
		target: 'ESNext',
		lib: ['ESNext'],
		libReplacement: false,
		jsx: 'react-jsx',
		module: 'NodeNext',
		moduleResolution: 'NodeNext',
		esModuleInterop: true,
		resolveJsonModule: true,
		isolatedModules: true,
		allowSyntheticDefaultImports: true,
		forceConsistentCasingInFileNames: true,
		allowArbitraryExtensions: true,
		types: ['bun-types', 'node'],
	},
	include: ['src/**/*.ts', 'src/**/*.tsx', 'test/**/*.ts'],
	exclude: ['node_modules', 'dist'],
} as const;

/**
 * Get the canonical tsconfig as a formatted JSON string
 */
export function getCanonicalTsconfigString(): string {
	return JSON.stringify(CANONICAL_TSCONFIG, null, 4);
}

// =============================================================================
// COMPARISON UTILITIES
// =============================================================================

/**
 * Deep compare two objects and return list of differences
 */
function findDifferences(actual: unknown, expected: unknown, path = ''): string[] {
	const differences: string[] = [];

	if (actual === expected) {
		return differences;
	}

	if (typeof actual !== typeof expected) {
		differences.push(`${path}: type mismatch (got ${typeof actual}, expected ${typeof expected})`);
		return differences;
	}

	if (Array.isArray(expected)) {
		if (!Array.isArray(actual)) {
			differences.push(`${path}: expected array, got ${typeof actual}`);
			return differences;
		}
		if (actual.length !== expected.length) {
			differences.push(`${path}: array length mismatch (got ${actual.length}, expected ${expected.length})`);
		}
		const actualSet = new Set(actual);
		const expectedSet = new Set(expected);
		for (const item of expectedSet) {
			if (!actualSet.has(item)) {
				differences.push(`${path}: missing array item "${item}"`);
			}
		}
		for (const item of actualSet) {
			if (!expectedSet.has(item)) {
				differences.push(`${path}: unexpected array item "${item}"`);
			}
		}
		return differences;
	}

	if (typeof expected === 'object' && expected !== null) {
		if (typeof actual !== 'object' || actual === null) {
			differences.push(`${path}: expected object, got ${actual === null ? 'null' : typeof actual}`);
			return differences;
		}

		const actualObj = actual as Record<string, unknown>;
		const expectedObj = expected as Record<string, unknown>;

		// Check for missing keys
		for (const key of Object.keys(expectedObj)) {
			if (!(key in actualObj)) {
				differences.push(`${path ? `${path}.${key}` : key}: missing required key`);
			} else {
				differences.push(...findDifferences(actualObj[key], expectedObj[key], path ? `${path}.${key}` : key));
			}
		}

		// Check for extra keys
		for (const key of Object.keys(actualObj)) {
			if (!(key in expectedObj)) {
				differences.push(`${path ? `${path}.${key}` : key}: unexpected extra key`);
			}
		}

		return differences;
	}

	// Primitive comparison
	if (actual !== expected) {
		differences.push(`${path}: value mismatch (got "${actual}", expected "${expected}")`);
	}

	return differences;
}

// =============================================================================
// MAIN AUDIT FUNCTION
// =============================================================================

export function auditTsconfig(riff: string, repoRoot: string): TsconfigAuditResult {
	const riffDir = resolve(repoRoot, 'riffs', riff);
	const tsconfigPath = resolve(riffDir, 'tsconfig.json');
	const tsconfigExists = existsSync(tsconfigPath);

	if (!tsconfigExists) {
		return {
			tsconfigPath: undefined,
			tsconfigExists: false,
			tsconfigMatchesCanonical: false,
			tsconfigHasExtends: false,
			tsconfigDifferences: ['tsconfig.json file not found'],
		};
	}

	try {
		const content = readFileSync(tsconfigPath, 'utf-8');
		const tsconfig = JSON.parse(content) as Record<string, unknown>;

		// Check for extends (not allowed - riffs must be standalone)
		const tsconfigHasExtends = 'extends' in tsconfig;

		// Find all differences from canonical
		const tsconfigDifferences = findDifferences(tsconfig, CANONICAL_TSCONFIG);

		if (tsconfigHasExtends) {
			tsconfigDifferences.unshift('extends: tsconfig must not use extends (must be standalone)');
		}

		return {
			tsconfigPath,
			tsconfigExists: true,
			tsconfigMatchesCanonical: tsconfigDifferences.length === 0,
			tsconfigHasExtends,
			tsconfigDifferences,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			tsconfigPath,
			tsconfigExists: true,
			tsconfigMatchesCanonical: false,
			tsconfigHasExtends: false,
			tsconfigDifferences: [`Failed to parse tsconfig.json: ${message}`],
		};
	}
}
