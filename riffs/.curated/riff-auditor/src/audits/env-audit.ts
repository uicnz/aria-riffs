/**
 * Environment variable audits - checks config.ts env var patterns
 */

import { resolve, sep } from 'node:path';
import { isSharedProviderEnvVar } from './constants.js';
import { isDirectory, listFilesRecursive, readFileIfExists, riffRoot, toScreamingSnakeCase } from './utils.js';

// =============================================================================
// TYPES
// =============================================================================

export interface EnvAuditResult {
	configLoaderPath?: string;
	configLoaderExists: boolean;
	configLoaderUsesWrapper: boolean;
	configLoaderUsesSchema: boolean;
	dotEnvLoaderPath?: string;
	dotEnvLoaderExists: boolean;
	hasAriaHomeConstant: boolean;
	hasGetAriaHome: boolean;
	hasLoadDotEnv: boolean;
	hasCanonicalDotEnvPrecedence: boolean;
	configLoadsDotEnv: boolean;
	envPrefix: string;
	envPrefixUsed: boolean;
	envNonCanonicalVars: string[];
	envSharedVarsUsed: string[];
	providerKeyNamesUsed: string[];
	nonCanonicalProviderKeyNames: string[];
	applyEnvOverridesReturnsConfig: boolean;
	hasApplyEnvOverridesFunc: boolean;
	hasConfigErrorClass: boolean;
	hasProcessExit: boolean;
	usesBracketNotation: boolean;
	loadConfigReturnsFullConfig: boolean;
}

// =============================================================================
// CONFIG LOADER CHECKS
// =============================================================================

function checkApplyEnvOverridesReturns(content: string): boolean {
	const hasReturnType = /function\s+applyEnvOverrides[^:]*:\s*(?!void)\w+/.test(content);
	if (!hasReturnType) {
		if (/function\s+applyEnvOverrides[^:]*:\s*void/.test(content)) {
			return false;
		}
	}
	const funcStart = content.indexOf('function applyEnvOverrides');
	if (funcStart === -1) return true;
	const afterFunc = content.slice(funcStart, funcStart + 10000);
	return /return\s+config\s*;/.test(afterFunc);
}

function checkHasApplyEnvOverridesFunc(content: string): boolean {
	return /function\s+applyEnvOverrides/.test(content);
}

function checkConfigErrorClass(content: string): boolean {
	return /class\s+ConfigError\s+extends\s+Error/.test(content);
}

function checkProcessExit(content: string): boolean {
	return /process\.exit\s*\(/.test(content);
}

function checkBracketNotation(content: string): boolean {
	const dotNotation = content.match(/process\.env\.([A-Z_]+)/g) ?? [];
	const realDotUsage = dotNotation.filter(m => !content.includes(`typeof ${m}`));
	return realDotUsage.length === 0;
}

function checkLoadConfigReturnType(content: string, riff: string): boolean {
	// Standard: loadConfig() should return {RiffName}Config (full config with wrapper)
	const pascalRiff = riff
		.split('-')
		.map(part => part.charAt(0).toUpperCase() + part.slice(1))
		.join('');
	const expectedType = `${pascalRiff}Config`;

	// Match: export function loadConfig(...): {ReturnType} {
	const pattern = /export\s+function\s+loadConfig\s*\([^)]*\)\s*:\s*(\w+)/;
	const match = content.match(pattern);

	if (!match) {
		// No explicit return type found
		return false;
	}

	const returnType = match[1];
	return returnType === expectedType;
}

function collectEnvVarNames(content: string): string[] {
	const names = new Set<string>();
	for (const match of content.matchAll(/process\.env(?:\[['"]([A-Z][A-Z0-9_]*)['"]\]|\.([A-Z][A-Z0-9_]*))/g)) {
		const name = match[1] ?? match[2];
		if (name) names.add(name);
	}
	return [...names].sort();
}

function collectProviderKeyNames(content: string): string[] {
	return [...new Set([...content.matchAll(/\b([A-Z][A-Z0-9_]*API_KEY)\b/g)].map(match => match[1]))]
		.filter((name): name is string => name !== undefined)
		.sort();
}

function checkCanonicalDotEnvPrecedence(content: string): boolean {
	const projectDeclaration = content.search(
		/const\s+projectEnv\s*=\s*resolve\(cwd,\s*['"]\.aria['"],\s*['"]\.env['"]\)/
	);
	const userDeclaration = content.search(/const\s+userEnv\s*=\s*join\(getAriaHome\(\),\s*['"]\.env['"]\)/);
	const projectPush = content.search(/paths\.push\(projectEnv\)/);
	const userPush = content.search(/paths\.push\(userEnv\)/);
	const preservesProcessEnv = /typeof\s+process\.env\[key\]\s*===\s*['"]string['"]/.test(content);

	return (
		projectDeclaration >= 0 &&
		userDeclaration > projectDeclaration &&
		projectPush > userDeclaration &&
		userPush > projectPush &&
		preservesProcessEnv
	);
}

// =============================================================================
// MAIN AUDIT FUNCTION
// =============================================================================

export function auditEnv(riff: string, repoRoot: string): EnvAuditResult {
	const configLoaderPath = resolve(riffRoot(repoRoot, riff), 'src', 'lib', 'config.ts');
	const configLoaderContent = readFileIfExists(configLoaderPath);
	const configLoaderExists = configLoaderContent !== undefined;
	const dotEnvLoaderPath = resolve(riffRoot(repoRoot, riff), 'src', 'lib', 'load-dotenv.ts');
	const dotEnvLoaderContent = readFileIfExists(dotEnvLoaderPath);
	const dotEnvLoaderExists = dotEnvLoaderContent !== undefined;
	const srcDir = resolve(riffRoot(repoRoot, riff), 'src');
	const sourceFiles = isDirectory(srcDir)
		? listFilesRecursive(srcDir).filter(path => path.endsWith('.ts') || path.endsWith('.tsx'))
		: [];
	const envNames = new Set<string>();
	const providerKeyNames = new Set<string>();
	const systemBootstrapVars = new Set(['HOME', 'USERPROFILE']);

	for (const sourcePath of sourceFiles) {
		const source = readFileIfExists(sourcePath) ?? '';
		for (const name of collectEnvVarNames(source)) {
			if (sourcePath.endsWith(`${sep}load-dotenv.ts`) && systemBootstrapVars.has(name)) continue;
			envNames.add(name);
		}
		for (const name of collectProviderKeyNames(source)) providerKeyNames.add(name);
	}

	const envPrefix = toScreamingSnakeCase(riff);
	const sortedEnvNames = [...envNames].sort();
	const providerKeyNamesUsed = [...providerKeyNames].sort();
	const envPrefixUsed = sortedEnvNames.some(name => name.startsWith(`${envPrefix}_`));
	const envSharedVarsUsed = sortedEnvNames.filter(isSharedProviderEnvVar);
	const envNonCanonicalVars = sortedEnvNames.filter(
		name => !name.startsWith(`${envPrefix}_`) && !isSharedProviderEnvVar(name)
	);
	const nonCanonicalProviderKeyNames = providerKeyNamesUsed.filter(
		name => !name.startsWith(`${envPrefix}_`) && !isSharedProviderEnvVar(name)
	);

	if (!configLoaderExists || !configLoaderContent) {
		return {
			configLoaderPath: undefined,
			configLoaderExists: false,
			configLoaderUsesWrapper: false,
			configLoaderUsesSchema: false,
			dotEnvLoaderPath: dotEnvLoaderExists ? dotEnvLoaderPath : undefined,
			dotEnvLoaderExists,
			hasAriaHomeConstant: /export\s+const\s+ARIA_HOME\b/.test(dotEnvLoaderContent ?? ''),
			hasGetAriaHome: /export\s+function\s+getAriaHome\s*\(/.test(dotEnvLoaderContent ?? ''),
			hasLoadDotEnv: /export\s+function\s+loadDotEnv\s*\(/.test(dotEnvLoaderContent ?? ''),
			hasCanonicalDotEnvPrecedence: checkCanonicalDotEnvPrecedence(dotEnvLoaderContent ?? ''),
			configLoadsDotEnv: false,
			envPrefix,
			envPrefixUsed,
			envNonCanonicalVars,
			envSharedVarsUsed,
			providerKeyNamesUsed,
			nonCanonicalProviderKeyNames,
			applyEnvOverridesReturnsConfig: true,
			hasApplyEnvOverridesFunc: false,
			hasConfigErrorClass: false,
			hasProcessExit: false,
			usesBracketNotation: true,
			loadConfigReturnsFullConfig: false,
		};
	}

	const configLoaderUsesWrapper = new RegExp(`\\['${riff}'\\]`).test(configLoaderContent);
	const configLoaderUsesSchema = /schema\.js|schema\.ts|ConfigSchema/.test(configLoaderContent);

	return {
		configLoaderPath,
		configLoaderExists,
		configLoaderUsesWrapper,
		configLoaderUsesSchema,
		dotEnvLoaderPath: dotEnvLoaderExists ? dotEnvLoaderPath : undefined,
		dotEnvLoaderExists,
		hasAriaHomeConstant: /export\s+const\s+ARIA_HOME\b/.test(dotEnvLoaderContent ?? ''),
		hasGetAriaHome: /export\s+function\s+getAriaHome\s*\(/.test(dotEnvLoaderContent ?? ''),
		hasLoadDotEnv: /export\s+function\s+loadDotEnv\s*\(/.test(dotEnvLoaderContent ?? ''),
		hasCanonicalDotEnvPrecedence: checkCanonicalDotEnvPrecedence(dotEnvLoaderContent ?? ''),
		configLoadsDotEnv:
			/import\s*\{\s*loadDotEnv\s*\}\s*from\s*['"]\.\/load-dotenv\.js['"]/.test(configLoaderContent) &&
			/loadDotEnv\(\);/.test(configLoaderContent),
		envPrefix,
		envPrefixUsed,
		envNonCanonicalVars,
		envSharedVarsUsed,
		providerKeyNamesUsed,
		nonCanonicalProviderKeyNames,
		applyEnvOverridesReturnsConfig: checkApplyEnvOverridesReturns(configLoaderContent),
		hasApplyEnvOverridesFunc: checkHasApplyEnvOverridesFunc(configLoaderContent),
		hasConfigErrorClass: checkConfigErrorClass(configLoaderContent),
		hasProcessExit: checkProcessExit(configLoaderContent),
		usesBracketNotation: checkBracketNotation(configLoaderContent),
		loadConfigReturnsFullConfig: checkLoadConfigReturnType(configLoaderContent, riff),
	};
}
