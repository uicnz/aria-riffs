/**
 * Scripts audits - checks for required npm scripts in package.json
 */

import { resolve } from 'node:path';
import { readFileIfExists } from './utils.js';

// =============================================================================
// TYPES
// =============================================================================

export interface ScriptsAuditOptions {
	packageJsonPath: string;
}

export interface ScriptsAuditResult {
	packageJsonExists: boolean;
	hasRiffScript: boolean;
	hasRiffTestScript: boolean;
	hasRiffTypecheckScript: boolean;
	riffScriptName: string;
	riffTestScriptName: string;
	riffTypecheckScriptName: string;
	missingScripts: string[];
}

// =============================================================================
// MAIN AUDIT FUNCTION
// =============================================================================

export function auditScripts(
	riff: string,
	repoRoot: string,
	options: ScriptsAuditOptions = { packageJsonPath: 'package.json' }
): ScriptsAuditResult {
	const packageJsonPath = resolve(repoRoot, options.packageJsonPath);
	const content = readFileIfExists(packageJsonPath);

	const riffScriptName = riff;
	const riffTestScriptName = `${riff}:test`;
	const riffTypecheckScriptName = `${riff}:typecheck`;

	if (!content) {
		return {
			packageJsonExists: false,
			hasRiffScript: false,
			hasRiffTestScript: false,
			hasRiffTypecheckScript: false,
			riffScriptName,
			riffTestScriptName,
			riffTypecheckScriptName,
			missingScripts: [riffScriptName, riffTestScriptName, riffTypecheckScriptName],
		};
	}

	let packageJson: { scripts?: Record<string, string> };
	try {
		packageJson = JSON.parse(content);
	} catch {
		return {
			packageJsonExists: true,
			hasRiffScript: false,
			hasRiffTestScript: false,
			hasRiffTypecheckScript: false,
			riffScriptName,
			riffTestScriptName,
			riffTypecheckScriptName,
			missingScripts: [riffScriptName, riffTestScriptName, riffTypecheckScriptName],
		};
	}

	const scripts = packageJson.scripts ?? {};
	const hasRiffScript = Object.hasOwn(scripts, riffScriptName);
	const hasRiffTestScript = Object.hasOwn(scripts, riffTestScriptName);
	const hasRiffTypecheckScript = Object.hasOwn(scripts, riffTypecheckScriptName);

	const missingScripts: string[] = [];
	if (!hasRiffScript) missingScripts.push(riffScriptName);
	if (!hasRiffTestScript) missingScripts.push(riffTestScriptName);
	if (!hasRiffTypecheckScript) missingScripts.push(riffTypecheckScriptName);

	return {
		packageJsonExists: true,
		hasRiffScript,
		hasRiffTestScript,
		hasRiffTypecheckScript,
		riffScriptName,
		riffTestScriptName,
		riffTypecheckScriptName,
		missingScripts,
	};
}
