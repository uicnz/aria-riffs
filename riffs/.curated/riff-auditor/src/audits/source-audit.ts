/**
 * Source code audits - checks for deprecated exports and compatibility vestiges.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import { SyntaxKind } from 'typescript/unstable/ast';
import { isIdentifier, type SourceToken, scanTypeScript, stringLiteralValue } from './typescript-scanner.js';
import {
	countWrapperUsage,
	findSnakeCaseStringLiterals,
	isDirectory,
	listFilesRecursive,
	readFileIfExists,
	riffRoot,
} from './utils.js';

// =============================================================================
// TYPES
// =============================================================================

export interface SourceAuditResult {
	srcWrapperUsageCount: number;
	srcSnakeCaseStringLiterals: string[];
	hasDeprecatedExports: boolean;
	deprecatedExports: string[];
	hasCompatibilityVestigeComments: boolean;
	hasDirectConsoleUsage: boolean;
	directConsoleUsage: string[];
	hasChalkUsage: boolean;
	chalkUsageFiles: string[];
	hasNonBunShebang: boolean;
	nonBunShebangFiles: string[];
	hasNonBunRuntimeInvocations: boolean;
	nonBunRuntimeInvocations: string[];
	testDirExists: boolean;
	typesFileExists: boolean;
	typesIsDirectory: boolean;
}

// =============================================================================
// SOURCE CODE CHECKS
// =============================================================================

function checkDeprecatedExports(content: string): string[] {
	const deprecated: string[] = [];
	// Match @deprecated JSDoc followed by export statement
	// Use [\s\S] instead of [^] for multiline matching (biome lint compliance)
	const pattern = /@deprecated[\s\S]*?export\s+(?:type|const|function|class)\s+(\w+)/g;
	let match = pattern.exec(content);
	while (match !== null) {
		deprecated.push(match[1]);
		match = pattern.exec(content);
	}
	return deprecated;
}

function checkCompatibilityVestigeComments(content: string): boolean {
	// Comments that mention compatibility vestiges or backward-compat paths are not allowed in greenfield riffs.
	const compatibilityVestigePatterns = [
		/\/\/.*\blegacy\b/i,
		/\/\/.*\bbackward[s]?\s*compat/i,
		/\/\*.*\blegacy\b.*\*\//is,
		/\/\*.*\bbackward[s]?\s*compat.*\*\//is,
	];
	return compatibilityVestigePatterns.some(pattern => pattern.test(content));
}

function isBrowserOrVendorRuntimeFile(filePath: string): boolean {
	return (
		filePath.includes(`${sep}src${sep}viewer${sep}`) ||
		filePath.endsWith('.min.js') ||
		filePath.includes(`${sep}viewer${sep}libs${sep}`)
	);
}

function isAutomatedTestFile(filePath: string): boolean {
	return filePath.includes(`${sep}test${sep}unit${sep}`) || filePath.includes(`${sep}test${sep}integration${sep}`);
}

function sourcePosition(content: string, offset: number): { line: number; character: number } {
	const prefix = content.slice(0, offset);
	const lastLineBreak = prefix.lastIndexOf('\n');
	return {
		line: prefix.split('\n').length,
		character: offset - lastLineBreak,
	};
}

function findConsoleBoundaryViolations(filePath: string, content: string, riffRoot: string): string[] {
	const results: string[] = [];
	const tokens = scanTypeScript(content);

	for (const [index, token] of tokens.entries()) {
		if (isIdentifier(token, 'console')) {
			const accessor = tokens[index + 1];
			let method: string | undefined;
			let callToken: SourceToken | undefined;

			if (accessor?.kind === SyntaxKind.DotToken || accessor?.kind === SyntaxKind.QuestionDotToken) {
				method = tokens[index + 2]?.text;
				callToken = tokens[index + 3];
			} else if (accessor?.kind === SyntaxKind.OpenBracketToken) {
				method = stringLiteralValue(tokens[index + 2]) ?? '[computed]';
				if (tokens[index + 3]?.kind === SyntaxKind.CloseBracketToken) {
					callToken = tokens[index + 4];
				}
			}

			if (method && callToken?.kind === SyntaxKind.OpenParenToken) {
				const position = sourcePosition(content, token.start);
				results.push(
					`${relative(riffRoot, filePath)}:${position.line}:${position.character} console.${method}(...)`
				);
			}
		}

		if (isIdentifier(token, 'spyOn') && tokens[index + 1]?.kind === SyntaxKind.OpenParenToken) {
			const target = tokens[index + 2];
			const separator = tokens[index + 3];
			const methodToken = tokens[index + 4];
			if (isIdentifier(target, 'console') && separator?.kind === SyntaxKind.CommaToken) {
				const method = stringLiteralValue(methodToken) ?? '[computed]';
				let expressionStart = index;
				while (
					expressionStart >= 2 &&
					tokens[expressionStart - 1]?.kind === SyntaxKind.DotToken &&
					tokens[expressionStart - 2]?.kind === SyntaxKind.Identifier
				) {
					expressionStart -= 2;
				}
				const position = sourcePosition(content, tokens[expressionStart]?.start ?? token.start);
				results.push(
					`${relative(riffRoot, filePath)}:${position.line}:${position.character} spyOn(console, '${method}')`
				);
			}
		}
	}

	return results;
}

function usesChalk(content: string): boolean {
	return /from\s+['"]chalk['"]/.test(content) || /\bchalk\./.test(content);
}

function hasNonBunShebang(content: string): boolean {
	const firstLine = content.split('\n', 1)[0]?.trim() ?? '';
	return firstLine.startsWith('#!') && firstLine !== '#!/usr/bin/env bun';
}

function findNonBunRuntimeInvocations(filePath: string, content: string, riffRoot: string): string[] {
	const results: string[] = [];
	const patterns = [
		/\b(?:node|tsx|ts-node|deno)\s+-e\b/,
		/spawn\(\s*['"](?:node|tsx|ts-node|deno)['"]/,
		/exec\(\s*['"](?:node|tsx|ts-node|deno)['"]/,
	];
	const lines = content.split('\n');

	for (const [index, line] of lines.entries()) {
		if (patterns.some(pattern => pattern.test(line))) {
			results.push(`${relative(riffRoot, filePath)}:${index + 1}`);
		}
	}

	return results;
}

function typesDirectoryContainsOnlyDeclarations(typesDirPath: string): boolean {
	if (!isDirectory(typesDirPath)) return false;
	const files = readdirSync(typesDirPath);
	return files.length > 0 && files.every(f => f.endsWith('.d.ts'));
}

// =============================================================================
// MAIN AUDIT FUNCTION
// =============================================================================

export function auditSource(riff: string, repoRoot: string): SourceAuditResult {
	const srcDir = resolve(riffRoot(repoRoot, riff), 'src');
	const testDir = resolve(riffRoot(repoRoot, riff), 'test');
	const typesPath = resolve(riffRoot(repoRoot, riff), 'src', 'lib', 'types.ts');
	const typesDirPath = resolve(riffRoot(repoRoot, riff), 'src', 'lib', 'types');
	const schemaPath = resolve(riffRoot(repoRoot, riff), 'src', 'lib', 'schema.ts');
	const configLoaderPath = resolve(riffRoot(repoRoot, riff), 'src', 'lib', 'config.ts');

	// List all code files
	const srcFiles = isDirectory(srcDir) ? listFilesRecursive(srcDir) : [];
	const testFiles = isDirectory(testDir) ? listFilesRecursive(testDir) : [];
	const codeFiles = [...srcFiles, ...testFiles].filter(file => file.endsWith('.ts') || file.endsWith('.tsx'));
	const shippedRuntimeFiles = srcFiles.filter(
		file => (file.endsWith('.ts') || file.endsWith('.tsx')) && !isBrowserOrVendorRuntimeFile(file)
	);
	const automatedTestFiles = testFiles.filter(
		file => (file.endsWith('.ts') || file.endsWith('.tsx')) && isAutomatedTestFile(file)
	);

	// Count wrapper usage and find snake_case literals
	let srcWrapperUsageCount = 0;
	const snakeCaseStringLiterals = new Set<string>();
	for (const file of codeFiles) {
		const content = readFileSync(file, 'utf8');
		srcWrapperUsageCount += countWrapperUsage(riff, content);
		const literals = findSnakeCaseStringLiterals(content);
		for (const literal of literals) {
			snakeCaseStringLiterals.add(literal);
		}
	}

	const consoleBoundaryFiles = [...shippedRuntimeFiles, ...automatedTestFiles];
	const directConsoleUsage = consoleBoundaryFiles.flatMap(file =>
		findConsoleBoundaryViolations(file, readFileSync(file, 'utf8'), riffRoot(repoRoot, riff))
	);
	const chalkUsageFiles = shippedRuntimeFiles
		.filter(file => usesChalk(readFileSync(file, 'utf8')))
		.map(file => relative(riffRoot(repoRoot, riff), file));
	const nonBunShebangFiles = shippedRuntimeFiles
		.filter(file => hasNonBunShebang(readFileSync(file, 'utf8')))
		.map(file => relative(riffRoot(repoRoot, riff), file));
	const nonBunRuntimeInvocations = shippedRuntimeFiles.flatMap(file =>
		findNonBunRuntimeInvocations(file, readFileSync(file, 'utf8'), riffRoot(repoRoot, riff))
	);

	// Check for deprecated exports
	const schemaContent = readFileIfExists(schemaPath);
	const configLoaderContent = readFileIfExists(configLoaderPath);
	const schemaDeprecated = schemaContent ? checkDeprecatedExports(schemaContent) : [];
	const configDeprecated = configLoaderContent ? checkDeprecatedExports(configLoaderContent) : [];
	const deprecatedExports = [...schemaDeprecated, ...configDeprecated];

	// Check for comments that indicate compatibility vestiges.
	const schemaHasCompatibilityVestigeComments = schemaContent
		? checkCompatibilityVestigeComments(schemaContent)
		: false;
	const configHasCompatibilityVestigeComments = configLoaderContent
		? checkCompatibilityVestigeComments(configLoaderContent)
		: false;

	// Check directory/file existence
	const testDirExists = isDirectory(testDir);
	const typesFileExists = readFileIfExists(typesPath) !== undefined;
	const typesIsDirectory = isDirectory(typesDirPath) && !typesDirectoryContainsOnlyDeclarations(typesDirPath);

	return {
		srcWrapperUsageCount,
		srcSnakeCaseStringLiterals: [...snakeCaseStringLiterals].sort(),
		hasDeprecatedExports: deprecatedExports.length > 0,
		deprecatedExports,
		hasCompatibilityVestigeComments: schemaHasCompatibilityVestigeComments || configHasCompatibilityVestigeComments,
		hasDirectConsoleUsage: directConsoleUsage.length > 0,
		directConsoleUsage,
		hasChalkUsage: chalkUsageFiles.length > 0,
		chalkUsageFiles,
		hasNonBunShebang: nonBunShebangFiles.length > 0,
		nonBunShebangFiles,
		hasNonBunRuntimeInvocations: nonBunRuntimeInvocations.length > 0,
		nonBunRuntimeInvocations,
		testDirExists,
		typesFileExists,
		typesIsDirectory,
	};
}
