/**
 * Config Loader Audit
 *
 * Enforces that every riff's config.ts uses the portable getRiffRoot()
 * pattern that walks up the directory tree looking for config.yaml.
 * This is critical for bundled riffs where the relative depth from
 * import.meta.dirname to the riff root differs from source layout.
 *
 * The canonical pattern:
 *   function getRiffRoot(): string {
 *       let dir = import.meta.dirname;
 *       for (let i = 0; i < 5; i++) {
 *           if (existsSync(resolve(dir, 'config.yaml'))) return dir;
 *           ...
 *       }
 *   }
 *
 * The forbidden pattern:
 *   return resolve(import.meta.dirname, '../..');
 *   (without the walk-up loop)
 */

import { resolve } from 'node:path';
import { readFileIfExists, riffRoot } from './utils.js';

// =============================================================================
// TYPES
// =============================================================================

export interface ConfigLoaderAuditResult {
	configLoaderExists: boolean;
	hasGetRiffRoot: boolean;
	usesWalkUpPattern: boolean;
	usesHardcodedRelativePath: boolean;
}

// =============================================================================
// MAIN AUDIT FUNCTION
// =============================================================================

export function auditConfigLoader(riff: string, repoRoot: string): ConfigLoaderAuditResult {
	const configLoaderPath = resolve(riffRoot(repoRoot, riff), 'src', 'lib', 'config.ts');
	const content = readFileIfExists(configLoaderPath);

	if (!content) {
		return {
			configLoaderExists: false,
			hasGetRiffRoot: false,
			usesWalkUpPattern: false,
			usesHardcodedRelativePath: false,
		};
	}

	const hasGetRiffRoot = /function\s+getRiffRoot\s*\(\s*\)/.test(content);

	// The walk-up pattern searches for config.yaml by walking parent directories
	const usesWalkUpPattern = hasGetRiffRoot && /existsSync\(resolve\(dir,\s*'config\.yaml'\)\)/.test(content);

	// The hardcoded pattern uses a fixed relative path without checking for config.yaml
	const usesHardcodedRelativePath =
		hasGetRiffRoot && !usesWalkUpPattern && /return\s+resolve\(import\.meta\.dirname,\s*['"]\.\./.test(content);

	return {
		configLoaderExists: true,
		hasGetRiffRoot,
		usesWalkUpPattern,
		usesHardcodedRelativePath,
	};
}
