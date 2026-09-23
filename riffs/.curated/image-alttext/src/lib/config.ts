/**
 * Configuration management for image-alttext riff
 *
 * Three-tier configuration system:
 * 1. Defaults (in Zod schema) - lowest priority
 * 2. YAML config file - overrides defaults
 * 3. Environment variables - highest priority
 */

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import { loadDotEnv } from './load-dotenv.js';
import { type ImageAlttextConfig, ImageAlttextConfigSchema } from './schema.js';

// Re-export types for convenience
export type { ImageAlttextConfig, ImageAlttextRiffConfig, LoggingConfig } from './schema.js';

/**
 * Get the riff's root directory (where config.yaml lives).
 * Walks up from the current file's directory looking for config.yaml.
 * Works in both source (src/lib/) and bundled (dist/) contexts.
 */
function getRiffRoot(): string {
	let dir = import.meta.dirname;
	for (let i = 0; i < 5; i++) {
		if (existsSync(resolve(dir, 'config.yaml'))) return dir;
		const parent = resolve(dir, '..');
		if (parent === dir) break;
		dir = parent;
	}
	return resolve(import.meta.dirname, '../..');
}

// =============================================================================
// TILDE EXPANSION
// =============================================================================

/** Expand leading `~/` to the user's home directory */
function expandTilde(p: string): string {
	return p.startsWith('~/') ? resolve(homedir(), p.slice(2)) : p;
}

/** Recursively expand tilde paths in all string values of an object */
function expandTildePaths<T>(obj: T): T {
	if (typeof obj === 'string') return expandTilde(obj) as T;
	if (Array.isArray(obj)) return obj.map(expandTildePaths) as T;
	if (obj && typeof obj === 'object') {
		const result = { ...obj } as Record<string, unknown>;
		for (const key of Object.keys(result)) {
			result[key] = expandTildePaths(result[key]);
		}
		return result as T;
	}
	return obj;
}

// =============================================================================
// CONFIG ERROR
// =============================================================================

export class ConfigError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ConfigError';
	}
}

// =============================================================================
// ENVIRONMENT OVERRIDES
// =============================================================================

function applyEnvOverrides(config: ImageAlttextConfig): ImageAlttextConfig {
	const riff = config['image-alttext'];

	if (process.env['IMAGE_ALTTEXT_VERBOSE']) {
		riff.verbose = process.env['IMAGE_ALTTEXT_VERBOSE'] === 'true';
	}

	if (process.env['IMAGE_ALTTEXT_DRY_RUN']) {
		riff.dryRun = process.env['IMAGE_ALTTEXT_DRY_RUN'] === 'true';
	}

	// Logging overrides (top-level peer section)
	if (process.env['IMAGE_ALTTEXT_LOG_LEVEL']) {
		const level = process.env['IMAGE_ALTTEXT_LOG_LEVEL'].toLowerCase();
		if (['trace', 'debug', 'info', 'warn', 'error', 'fatal'].includes(level)) {
			config.logging.level = level as typeof config.logging.level;
		}
	}

	if (process.env['IMAGE_ALTTEXT_LOG_VERBOSE']) {
		config.logging.verbose = process.env['IMAGE_ALTTEXT_LOG_VERBOSE'] === 'true';
	}

	if (process.env['IMAGE_ALTTEXT_LOG_FILE']) {
		config.logging.file = process.env['IMAGE_ALTTEXT_LOG_FILE'];
	}

	if (process.env['IMAGE_ALTTEXT_LOG_MAX_FILE_SIZE_MB']) {
		const maxFileSizeMb = parseInt(process.env['IMAGE_ALTTEXT_LOG_MAX_FILE_SIZE_MB'], 10);
		if (!Number.isNaN(maxFileSizeMb)) {
			config.logging.maxFileSizeMb = maxFileSizeMb;
		}
	}

	if (process.env['IMAGE_ALTTEXT_LOG_MAX_FILES']) {
		const maxFiles = parseInt(process.env['IMAGE_ALTTEXT_LOG_MAX_FILES'], 10);
		if (!Number.isNaN(maxFiles)) {
			config.logging.maxFiles = maxFiles;
		}
	}

	return config;
}

// =============================================================================
// LOADER - Tiered config: Defaults -> YAML -> Env vars
// =============================================================================

export function loadConfig(configPath?: string): ImageAlttextConfig {
	loadDotEnv();
	const defaultPath = resolve(getRiffRoot(), 'config.yaml');
	const finalPath = configPath ?? defaultPath;
	const explicitPathProvided = configPath !== undefined;

	let config: ImageAlttextConfig;

	if (!existsSync(finalPath)) {
		if (explicitPathProvided) {
			throw new ConfigError(`Config file not found: ${finalPath}`);
		}
		// No config file at default path - use defaults only
		config = ImageAlttextConfigSchema.parse({});
	} else {
		// Tier 2: YAML config file overrides defaults
		const content = readFileSync(finalPath, 'utf-8');
		const raw = parse(content);
		config = ImageAlttextConfigSchema.parse(raw);
	}

	// Tier 3: Environment variables override everything
	config = expandTildePaths(config);
	return applyEnvOverrides(config);
}

// =============================================================================
// CONFIG PATH EXPORT
// =============================================================================

export const configPath = resolve(getRiffRoot(), 'config.yaml');
