/**
 * Paths audit - validates nested path structure in riff configs
 *
 * Enforces that riff configs use the nested paths convention:
 * paths.input, paths.output, paths.template, paths.database
 */

import { relative, resolve } from 'node:path';
import * as yaml from 'js-yaml';
import { listFilesRecursive, readFileIfExists } from './utils.js';

// =============================================================================
// TYPES
// =============================================================================

export interface PathsAuditResult {
	pathsHasNestedStructure: boolean;
	pathsValidCategories: boolean;
	pathsHasFlatKeys: boolean;
	pathsFlatKeys: string[];
	pathsInvalidCategories: string[];
	pathsNonCanonicalCacheReferences: string[];
	pathsLoggingHasFile: boolean;
	pathsLoggingFollowsConvention: boolean;
	pathsOrphanedSections: string[];
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** Valid path category keys under the paths section */
const VALID_PATH_CATEGORIES = new Set(['input', 'output', 'template', 'database']);

/** Patterns that indicate a flat path key (non-nested) */
const LEGACY_PATH_PATTERNS = [
	/Directory$/i,
	/Dir$/i,
	/File$/i,
	/Path$/i,
	/^inputDir/i,
	/^outputDir/i,
	/^defaultDir/i,
	/^syncFolder/i,
	/^outputCsv/i,
	/^outputSqlite/i,
	/^databasePath/i,
	/^qdrantStorage/i,
];

const NON_CANONICAL_CACHE_REFERENCE_PATTERNS = [
	/\bpaths\.cache\b/g,
	/\bPathCacheSchema\b/g,
	/\b[A-Z0-9_]+_CACHE_DIR\b/g,
];

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Check if a key name matches a flat path key pattern.
 */
function isFlatPathKey(key: string): boolean {
	return LEGACY_PATH_PATTERNS.some(pattern => pattern.test(key));
}

function findNonCanonicalCacheReferences(riffDir: string): string[] {
	const allowedExtensions = new Set(['.ts', '.yaml']);
	const references = new Set<string>();

	for (const filePath of listFilesRecursive(riffDir)) {
		const relativePath = relative(riffDir, filePath);
		if (relativePath !== 'config.yaml' && !relativePath.startsWith('src/')) {
			continue;
		}

		const extension = filePath.slice(filePath.lastIndexOf('.'));
		if (!allowedExtensions.has(extension)) {
			continue;
		}

		const content = readFileIfExists(filePath);
		if (!content) {
			continue;
		}

		for (const pattern of NON_CANONICAL_CACHE_REFERENCE_PATTERNS) {
			const matches = content.match(pattern);
			if (!matches) {
				continue;
			}
			for (const match of matches) {
				references.add(`${relativePath}: ${match}`);
			}
		}
	}

	return [...references].sort();
}

/**
 * Detect path-like keys as direct children of the riff wrapper section.
 *
 * Only checks the riff wrapper's immediate keys (1 level). Nested config
 * sections (e.g., llm, database, chat) are not searched because path keys
 * inside them are either already migrated or intentionally kept in their
 * provider-specific section.
 */
function findOrphanedPathSections(riffSection: Record<string, unknown>, riffName: string): string[] {
	const orphaned: string[] = [];

	for (const key of Object.keys(riffSection)) {
		// Skip the paths section itself -- that is where paths belong
		if (key === 'paths') continue;

		// Check if this direct child key is a flat path key
		if (isFlatPathKey(key)) {
			orphaned.push(`${riffName}.${key}`);
		}
	}

	return orphaned;
}

// =============================================================================
// MAIN AUDIT FUNCTION
// =============================================================================

/**
 * Audit a riff's config.yaml for nested paths compliance.
 *
 * Riffs without nested structure get detected but this is reported as
 * informational -- the orchestrator decides severity.
 */
export function auditPaths(riff: string, repoRoot: string): PathsAuditResult {
	const configPath = resolve(repoRoot, 'riffs', riff, 'config.yaml');
	const riffDir = resolve(repoRoot, 'riffs', riff);
	const content = readFileIfExists(configPath);

	// Default result for missing config
	if (!content) {
		return {
			pathsHasNestedStructure: false,
			pathsValidCategories: true,
			pathsHasFlatKeys: false,
			pathsFlatKeys: [],
			pathsInvalidCategories: [],
			pathsNonCanonicalCacheReferences: [],
			pathsLoggingHasFile: false,
			pathsLoggingFollowsConvention: false,
			pathsOrphanedSections: [],
		};
	}

	let parsed: Record<string, unknown>;
	try {
		parsed = (yaml.load(content) as Record<string, unknown>) || {};
	} catch {
		return {
			pathsHasNestedStructure: false,
			pathsValidCategories: true,
			pathsHasFlatKeys: false,
			pathsFlatKeys: [],
			pathsInvalidCategories: [],
			pathsNonCanonicalCacheReferences: [],
			pathsLoggingHasFile: false,
			pathsLoggingFollowsConvention: false,
			pathsOrphanedSections: [],
		};
	}

	// Get riff wrapper section
	const riffSection = parsed[riff] as Record<string, unknown> | undefined;
	const loggingSection = parsed['logging'] as Record<string, unknown> | undefined;

	// Check logging.file
	const pathsLoggingHasFile = loggingSection != null && typeof loggingSection['file'] === 'string';
	const loggingFile = pathsLoggingHasFile ? (loggingSection['file'] as string) : '';
	const expectedLoggingPathSystem = `~/.aria/logs/${riff}.log`;
	const expectedLoggingPathRepo = `.aria/logs/${riff}.log`;
	const pathsLoggingFollowsConvention =
		loggingFile === expectedLoggingPathSystem || loggingFile === expectedLoggingPathRepo;

	if (!riffSection) {
		return {
			pathsHasNestedStructure: false,
			pathsValidCategories: true,
			pathsHasFlatKeys: false,
			pathsFlatKeys: [],
			pathsInvalidCategories: [],
			pathsNonCanonicalCacheReferences: [],
			pathsLoggingHasFile,
			pathsLoggingFollowsConvention,
			pathsOrphanedSections: [],
		};
	}

	// Check paths section
	const pathsSection = riffSection['paths'] as Record<string, unknown> | undefined;

	// Determine if nested structure exists
	// A nested structure means paths has at least one valid category child (input, output, template, database)
	// OR paths is an empty object (valid -- riff has no configured paths yet)
	let pathsHasNestedStructure = false;
	const pathsInvalidCategories: string[] = [];

	if (pathsSection != null && typeof pathsSection === 'object') {
		const pathKeys = Object.keys(pathsSection);

		if (pathKeys.length === 0) {
			// Empty paths: {} -- considered valid nested structure (no paths configured)
			pathsHasNestedStructure = true;
		} else {
			// Check if children are valid categories with nested objects
			const hasValidCategory = pathKeys.some(key => {
				if (!VALID_PATH_CATEGORIES.has(key)) return false;
				const child = pathsSection[key];
				return child !== null && typeof child === 'object' && !Array.isArray(child);
			});
			pathsHasNestedStructure = hasValidCategory;

			// Find invalid category keys
			for (const key of pathKeys) {
				if (!VALID_PATH_CATEGORIES.has(key)) {
					// Only flag as invalid if the value is a nested object (looks like a path category)
					// Flat string values are flat path keys, not invalid categories
					const child = pathsSection[key];
					if (child !== null && typeof child === 'object' && !Array.isArray(child)) {
						pathsInvalidCategories.push(key);
					}
				}
			}
		}
	}

	const pathsValidCategories = pathsInvalidCategories.length === 0;
	const pathsNonCanonicalCacheReferences = findNonCanonicalCacheReferences(riffDir);

	// Find flat path keys inside the riff wrapper (outside paths nested structure)
	const orphanedSections = findOrphanedPathSections(riffSection, riff);

	// Find flat path keys inside the paths section itself (non-nested naming)
	const flatKeysInPaths: string[] = [];
	if (pathsSection != null && typeof pathsSection === 'object') {
		for (const [key, value] of Object.entries(pathsSection)) {
			// If a child of paths is a string (not an object), it is a flat path key
			if (typeof value === 'string' || value === null) {
				if (isFlatPathKey(key)) {
					flatKeysInPaths.push(`paths.${key}`);
				}
			}
		}
	}

	const allFlatKeys = [...flatKeysInPaths, ...orphanedSections.filter(s => isFlatPathKey(s.split('.').pop() ?? ''))];

	return {
		pathsHasNestedStructure,
		pathsValidCategories,
		pathsHasFlatKeys: allFlatKeys.length > 0,
		pathsFlatKeys: allFlatKeys,
		pathsInvalidCategories,
		pathsNonCanonicalCacheReferences,
		pathsLoggingHasFile,
		pathsLoggingFollowsConvention,
		pathsOrphanedSections: orphanedSections,
	};
}
