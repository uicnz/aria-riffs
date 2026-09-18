/**
 * CLI pattern audits - checks cli.ts structure and patterns
 */

import { resolve } from 'node:path';
import { readFileIfExists } from './utils.js';

// =============================================================================
// TYPES
// =============================================================================

export interface CliAuditResult {
	cliPath?: string;
	cliExists: boolean;
	cliHasCreateProgramFunc: boolean;
	cliHasModuleLevelProgram: boolean;
	cliHasExecutionGuard: boolean;
	cliProgramNameMatchesRiff: boolean;
	cliProgramName: string | null;
}

// =============================================================================
// CLI PATTERN CHECKS
// =============================================================================

/**
 * Check if cli.ts has a createProgram() function.
 * This is the recommended pattern for testability.
 * Accepts both exported and non-exported versions, any return type.
 */
function checkCliHasCreateProgramFunc(content: string): boolean {
	return /(?:export\s+)?function\s+createProgram\s*\(\s*\)\s*:\s*\w+/.test(content);
}

/**
 * Check if cli.ts has module-level program instantiation (bad pattern).
 * Looks for: const program = new Command() at module level (not inside a function).
 */
function checkCliHasModuleLevelProgram(content: string): boolean {
	// If createProgram() function exists, the program should be inside it
	const createProgramMatch = content.match(/(?:export\s+)?function\s+createProgram\s*\(\s*\)\s*:\s*\w+/);
	if (createProgramMatch && createProgramMatch.index !== undefined) {
		// createProgram exists - check if program declaration is BEFORE it (module-level)
		const beforeCreateProgram = content.slice(0, createProgramMatch.index);
		return /const\s+program\s*=\s*new\s+Command\s*\(/.test(beforeCreateProgram);
	}

	// No createProgram function - any program = new Command() is module-level
	return /const\s+program\s*=\s*new\s+Command\s*\(/.test(content);
}

/**
 * Check if cli.ts has an execution guard using fileURLToPath.
 * Pattern: if (process.argv[1] === fileURLToPath(import.meta.url))
 */
function checkCliHasExecutionGuard(content: string): boolean {
	return /if\s*\(\s*process\.argv\[1\]\s*===\s*fileURLToPath\s*\(\s*import\.meta\.url\s*\)/.test(content);
}

/**
 * Extract the program name from program.name('...') calls.
 * Only recognizes literal string arguments -- the standard
 * requires a literal name matching the riff directory.
 * Returns null if no name call is found.
 */
function extractProgramName(content: string): string | null {
	const match = /\.name\(\s*['"]([^'"]+)['"]\s*\)/.exec(content);
	return match?.[1] ?? null;
}

// =============================================================================
// MAIN AUDIT FUNCTION
// =============================================================================

export function auditCli(riff: string, repoRoot: string): CliAuditResult {
	const cliPath = resolve(repoRoot, 'riffs', riff, 'src', 'cli.ts');
	const cliContent = readFileIfExists(cliPath);
	const cliExists = cliContent !== undefined;

	if (!cliExists || !cliContent) {
		return {
			cliPath: undefined,
			cliExists: false,
			cliHasCreateProgramFunc: false,
			cliHasModuleLevelProgram: false,
			cliHasExecutionGuard: false,
			cliProgramNameMatchesRiff: false,
			cliProgramName: null,
		};
	}

	const programName = extractProgramName(cliContent);

	return {
		cliPath,
		cliExists,
		cliHasCreateProgramFunc: checkCliHasCreateProgramFunc(cliContent),
		cliHasModuleLevelProgram: checkCliHasModuleLevelProgram(cliContent),
		cliHasExecutionGuard: checkCliHasExecutionGuard(cliContent),
		cliProgramNameMatchesRiff: programName === riff,
		cliProgramName: programName,
	};
}
