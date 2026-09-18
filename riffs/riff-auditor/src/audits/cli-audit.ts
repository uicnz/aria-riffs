/**
 * CLI pattern audits - checks cli.ts structure and patterns
 */

import { spawnSync } from 'node:child_process';
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
	cliImportsPackageManifest: boolean;
	cliUsesPackageDescription: boolean;
	cliUsesPackageVersion: boolean;
}

export interface CliHelpAuditResult {
	cliHelpRenders: boolean;
	cliHelpExitCode: number;
	cliHelpOutput: string;
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
			cliImportsPackageManifest: false,
			cliUsesPackageDescription: false,
			cliUsesPackageVersion: false,
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
		cliImportsPackageManifest:
			/import\s+packageManifest\s+from\s+['"]\.\.\/package\.json['"]\s+with\s+\{\s*type:\s*['"]json['"]\s*\}/u.test(
				cliContent
			),
		cliUsesPackageDescription: /\.description\(\s*packageManifest\.description\s*\)/u.test(cliContent),
		cliUsesPackageVersion: /\.version\(\s*packageManifest\.version\s*\)/u.test(cliContent),
	};
}

/**
 * Execute the public help path so startup work cannot intercept --help.
 */
export function auditCliHelp(riff: string, repoRoot: string): CliHelpAuditResult {
	const cliPath = resolve(repoRoot, 'riffs', riff, 'src', 'cli.ts');
	const helpProcess = spawnSync(process.execPath, [cliPath, '--help'], {
		cwd: resolve(repoRoot, 'riffs', riff),
		encoding: 'utf8',
	});
	const stdout = helpProcess.stdout;
	const stderr = helpProcess.stderr;
	const output = [stdout, stderr].filter(Boolean).join('\n').trim();
	const exitCode = helpProcess.status ?? -1;

	return {
		cliHelpRenders: exitCode === 0 && output.startsWith(`Usage: ${riff}`) && !/^Error:/mu.test(output),
		cliHelpExitCode: exitCode,
		cliHelpOutput: output,
	};
}
