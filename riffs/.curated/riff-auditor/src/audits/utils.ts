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

/** Source tiers beneath the Riff collection, each a dot-prefixed directory. */
export const RIFF_SOURCE_TIERS = ['system', 'curated', 'experimental'] as const;

export type RiffSourceTier = (typeof RIFF_SOURCE_TIERS)[number];

function isReleaseUnitName(name: string): boolean {
	return !name.startsWith('.') && !name.startsWith('_');
}

/** Every Riff beneath every present tier, sorted by name. A name may occur in only one tier. */
export function listRiffDirs(riffsDir: string): string[] {
	const names = new Map<string, RiffSourceTier>();
	for (const tier of RIFF_SOURCE_TIERS) {
		const tierDir = resolve(riffsDir, `.${tier}`);
		if (!isDirectory(tierDir)) continue;
		for (const entry of readdirSync(tierDir, { withFileTypes: true })) {
			if (!entry.isDirectory() || !isReleaseUnitName(entry.name)) continue;
			const owner = names.get(entry.name);
			if (owner) throw new Error(`Riff ${entry.name} occurs in both .${owner} and .${tier}`);
			names.set(entry.name, tier);
		}
	}
	return [...names.keys()].sort();
}

/** The directory of one Riff, found in whichever tier holds it. Falls back to .curated for a Riff that does not exist yet. */
export function riffRoot(repoRoot: string, riff: string, riffsPath = 'riffs'): string {
	for (const tier of RIFF_SOURCE_TIERS) {
		const candidate = resolve(repoRoot, riffsPath, `.${tier}`, riff);
		if (isDirectory(candidate)) return candidate;
	}
	return resolve(repoRoot, riffsPath, '.curated', riff);
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
