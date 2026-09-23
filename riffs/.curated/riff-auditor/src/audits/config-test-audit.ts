/**
 * Config test pattern audit - enforces tilde expansion and canonical config test patterns
 *
 * Checks that every riff's config.ts has expandTilde/expandTildePaths,
 * and that config tests follow the canonical pattern with tilde expansion verification.
 */

import { type Dirent, readdirSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { readFileIfExists, riffRoot } from './utils.js';

// =============================================================================
// TYPES
// =============================================================================

export interface ConfigTestAuditResult {
	/** config.ts contains expandTilde function */
	hasExpandTilde: boolean;
	/** config.ts contains expandTildePaths generic walker */
	hasExpandTildePaths: boolean;
	/** loadConfig() calls expandTildePaths on config before returning */
	loadConfigCallsExpandTildePaths: boolean;
	/** test/unit/config.test.ts exists */
	hasConfigUnitTest: boolean;
	/** test/integration/config.test.ts exists */
	hasConfigIntegrationTest: boolean;
	/** Config unit test contains a tilde expansion test */
	hasTildeExpansionTest: boolean;
	/** Config test files with fragile exact YAML value assertions */
	fragileAssertions: string[];
	/** Checked-in YAML fixture configs whose basename is not config.yaml */
	nonCanonicalFixtureConfigPaths: string[];
}

// =============================================================================
// CHECKS
// =============================================================================

function checkExpandTilde(content: string): boolean {
	return /function\s+expandTilde\s*\(\s*p\s*:\s*string\s*\)\s*:\s*string/.test(content);
}

function checkExpandTildePaths(content: string): boolean {
	return /function\s+expandTildePaths\s*<\s*T\s*>\s*\(\s*obj\s*:\s*T\s*\)\s*:\s*T/.test(content);
}

function checkLoadConfigCallsExpand(content: string): boolean {
	// Look for the pattern: config = expandTildePaths(config)
	// within the loadConfig function body
	const loadConfigStart = content.indexOf('function loadConfig');
	if (loadConfigStart === -1) return false;
	const afterLoadConfig = content.slice(loadConfigStart, loadConfigStart + 5000);
	return /expandTildePaths\s*\(\s*config\s*\)/.test(afterLoadConfig);
}

function checkTildeExpansionTest(content: string): boolean {
	// Look for patterns that indicate a tilde expansion test:
	// - 'tilde' in test descriptions (it('...tilde...'))
	// - assertNoTildes helper
	// - Checking for '~/' in config values
	// - expandTilde or expandTildePaths references in test
	return (
		/(?:tilde|tildes)\s+(?:are\s+)?expand/i.test(content) ||
		/assertNoTildes/.test(content) ||
		/startsWith\s*\(\s*['"]~\/['"]\s*\)/.test(content) ||
		/Unexpanded tilde/.test(content)
	);
}

function findFragileAssertions(content: string, filePath: string): string[] {
	const results: string[] = [];

	// Check for exact tilde path assertions that break when expandTildePaths runs.
	// Only flag '~/.aria/' -- relative '.aria/' is legitimate for schema defaults and mock data.
	if (/\.toBe\s*\(\s*['"]~\/\.aria\//.test(content)) {
		results.push(`${filePath}: exact tilde path assertion (.toBe('~/.aria/...'))`);
	}

	return results;
}

function findNonCanonicalFixtureConfigPaths(riffDir: string): string[] {
	const nonCanonicalPaths: string[] = [];

	function visit(directory: string): void {
		let entries: Dirent[];
		try {
			entries = readdirSync(directory, { withFileTypes: true });
		} catch {
			return;
		}

		for (const entry of entries) {
			const entryPath = resolve(directory, entry.name);
			if (entry.isDirectory()) {
				visit(entryPath);
				continue;
			}
			if (!entry.isFile() || !/\.ya?ml$/u.test(entry.name) || entry.name === 'config.yaml') {
				continue;
			}
			nonCanonicalPaths.push(relative(riffDir, entryPath));
		}
	}

	visit(resolve(riffDir, 'fixtures'));
	visit(resolve(riffDir, 'test', 'fixtures'));
	return nonCanonicalPaths.sort();
}

// =============================================================================
// MAIN AUDIT FUNCTION
// =============================================================================

export function auditConfigTest(riff: string, repoRoot: string): ConfigTestAuditResult {
	const configPath = resolve(riffRoot(repoRoot, riff), 'src', 'lib', 'config.ts');
	const riffDir = riffRoot(repoRoot, riff);
	const unitTestPath = resolve(riffRoot(repoRoot, riff), 'test', 'unit', 'config.test.ts');
	const integrationTestPath = resolve(riffRoot(repoRoot, riff), 'test', 'integration', 'config.test.ts');

	const configContent = readFileIfExists(configPath);
	const unitTestContent = readFileIfExists(unitTestPath);
	const integrationTestContent = readFileIfExists(integrationTestPath);

	const hasConfigUnitTest = unitTestContent !== undefined;
	const hasConfigIntegrationTest = integrationTestContent !== undefined;

	// Check config.ts for tilde expansion functions
	const hasExpandTilde = configContent ? checkExpandTilde(configContent) : false;
	const hasExpandTildePaths = configContent ? checkExpandTildePaths(configContent) : false;
	const loadConfigCallsExpandTildePaths = configContent ? checkLoadConfigCallsExpand(configContent) : false;

	// Check tests for tilde expansion coverage
	const hasTildeExpansionTest = unitTestContent ? checkTildeExpansionTest(unitTestContent) : false;

	// Scan for fragile assertions
	const fragileAssertions: string[] = [];
	if (unitTestContent) {
		fragileAssertions.push(...findFragileAssertions(unitTestContent, 'test/unit/config.test.ts'));
	}
	if (integrationTestContent) {
		fragileAssertions.push(...findFragileAssertions(integrationTestContent, 'test/integration/config.test.ts'));
	}

	return {
		hasExpandTilde,
		hasExpandTildePaths,
		loadConfigCallsExpandTildePaths,
		hasConfigUnitTest,
		hasConfigIntegrationTest,
		hasTildeExpansionTest,
		fragileAssertions,
		nonCanonicalFixtureConfigPaths: findNonCanonicalFixtureConfigPaths(riffDir),
	};
}
