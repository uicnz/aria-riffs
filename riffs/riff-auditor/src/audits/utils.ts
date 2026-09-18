/**
 * Shared utility functions for audit modules
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

// =============================================================================
// FILE SYSTEM UTILITIES
// =============================================================================

export function isDirectory(p: string): boolean {
	try {
		return statSync(p).isDirectory();
	} catch {
		return false;
	}
}

export function readFileIfExists(filePath: string): string | undefined {
	try {
		return readFileSync(filePath, 'utf8');
	} catch {
		return undefined;
	}
}

export function listFilesRecursive(dirPath: string): string[] {
	const entries = readdirSync(dirPath, { withFileTypes: true });
	const files: string[] = [];
	for (const entry of entries) {
		const fullPath = resolve(dirPath, entry.name);
		if (entry.isDirectory()) {
			files.push(...listFilesRecursive(fullPath));
		} else {
			files.push(fullPath);
		}
	}
	return files;
}

// =============================================================================
// STRING UTILITIES
// =============================================================================

export function toPascalCase(kebab: string): string {
	return kebab
		.split('-')
		.map(part => part.charAt(0).toUpperCase() + part.slice(1))
		.join('');
}

export function toScreamingSnakeCase(kebab: string): string {
	return kebab.replace(/-/g, '_').toUpperCase();
}

// =============================================================================
// RIFF DISCOVERY
// =============================================================================

export function listRiffDirs(riffsDir: string): string[] {
	return readdirSync(riffsDir, { withFileTypes: true })
		.filter(entry => entry.isDirectory())
		.map(entry => entry.name)
		.sort();
}

/** Find the nearest ancestor that owns the configured Riff collection. */
export function findRiffRepoRoot(startDir: string, riffsPath = 'riffs'): string {
	let current = resolve(startDir);
	for (;;) {
		if (isDirectory(resolve(current, riffsPath))) return current;
		const parent = resolve(current, '..');
		if (parent === current) return resolve(startDir);
		current = parent;
	}
}

// =============================================================================
// KEY COLLECTION
// =============================================================================

export function collectUnderscoreKeys(value: unknown, prefix: string, results: string[]): void {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		return;
	}
	for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
		const keyPath = prefix ? `${prefix}.${key}` : key;
		if (key.includes('_')) {
			results.push(keyPath);
		}
		collectUnderscoreKeys(child, keyPath, results);
	}
}

// =============================================================================
// SNAKE_CASE DETECTION
// =============================================================================

export function findSnakeCaseStringLiterals(content: string): string[] {
	const results = new Set<string>();
	const pattern = /['"]([a-z0-9]+_[a-z0-9_]+)['"]/g;
	let match = pattern.exec(content);
	while (match !== null) {
		results.add(match[1]);
		match = pattern.exec(content);
	}
	return [...results].sort();
}

// =============================================================================
// WRAPPER USAGE COUNTING
// =============================================================================

export function countWrapperUsage(riff: string, content: string): number {
	const pattern = new RegExp(`\\['${riff}'\\]`, 'g');
	return (content.match(pattern) ?? []).length;
}
