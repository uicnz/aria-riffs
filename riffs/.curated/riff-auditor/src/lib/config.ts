/**
 * Configuration management for riff-auditor
 * 3-tier config: Defaults (Zod) -> YAML file -> Environment variables
 *
 * Config is co-located with the riff (config.yaml in the riff's directory)
 */

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { parse as yamlParse } from 'yaml';
import { loadDotEnv } from './load-dotenv.js';
import { type LoggingConfig, type RiffAuditorConfig, RiffAuditorConfigSchema } from './schema.js';

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

function applyEnvOverrides(config: RiffAuditorConfig): RiffAuditorConfig {
	const riff = config['riff-auditor'];

	// Riff-specific overrides
	if (process.env['RIFF_AUDITOR_OUTPUT_DIRECTORY']) {
		riff.paths.output.dir = process.env['RIFF_AUDITOR_OUTPUT_DIRECTORY'];
	}
	if (process.env['RIFF_AUDITOR_OUTPUT_FILENAME']) {
		riff.paths.output.filename = process.env['RIFF_AUDITOR_OUTPUT_FILENAME'];
	}
	// Logging overrides (standard for all riffs)
	if (process.env['RIFF_AUDITOR_LOG_LEVEL']) {
		const level = process.env['RIFF_AUDITOR_LOG_LEVEL'].toLowerCase();
		if (['trace', 'debug', 'info', 'warn', 'error', 'fatal'].includes(level)) {
			config.logging.level = level as LoggingConfig['level'];
		}
	}
	if (process.env['RIFF_AUDITOR_LOG_VERBOSE']) {
		config.logging.verbose = process.env['RIFF_AUDITOR_LOG_VERBOSE'] === 'true';
	}
	if (process.env['RIFF_AUDITOR_LOG_FILE']) {
		config.logging.file = process.env['RIFF_AUDITOR_LOG_FILE'];
	}
	if (process.env['RIFF_AUDITOR_LOG_MAX_FILE_SIZE_MB']) {
		const maxFileSizeMb = parseInt(process.env['RIFF_AUDITOR_LOG_MAX_FILE_SIZE_MB'], 10);
		if (!Number.isNaN(maxFileSizeMb)) {
			config.logging.maxFileSizeMb = maxFileSizeMb;
		}
	}
	if (process.env['RIFF_AUDITOR_LOG_MAX_FILES']) {
		const maxFiles = parseInt(process.env['RIFF_AUDITOR_LOG_MAX_FILES'], 10);
		if (!Number.isNaN(maxFiles)) {
			config.logging.maxFiles = maxFiles;
		}
	}

	return config;
}

// =============================================================================
// LOAD CONFIG
// =============================================================================

/**
 * Load configuration with 3-tier priority:
 * 1. Defaults from Zod schema
 * 2. YAML config file overrides (co-located at riffs/riff-auditor/config.yaml)
 * 3. Environment variable overrides
 */
export function loadConfig(configPath?: string): RiffAuditorConfig {
	loadDotEnv();
	const defaultPath = resolve(getRiffRoot(), 'config.yaml');
	const finalPath = configPath ?? defaultPath;
	const explicitPathProvided = configPath !== undefined;

	let config: RiffAuditorConfig;

	if (!existsSync(finalPath)) {
		if (explicitPathProvided) {
			throw new ConfigError(`Config file not found: ${finalPath}`);
		}
		config = RiffAuditorConfigSchema.parse({});
	} else {
		try {
			const fileContent = readFileSync(finalPath, 'utf8');
			const rawConfig = yamlParse(fileContent) || {};
			config = RiffAuditorConfigSchema.parse(rawConfig);
		} catch (error) {
			if (error instanceof Error && error.name === 'ZodError') {
				throw new ConfigError(`Invalid config file: ${error.message}`);
			}
			throw new ConfigError(`Failed to load config: ${error}`);
		}
	}

	config = expandTildePaths(config);
	return applyEnvOverrides(config);
}

// =============================================================================
// CONFIG PATH EXPORT
// =============================================================================

export const configPath = resolve(getRiffRoot(), 'config.yaml');
