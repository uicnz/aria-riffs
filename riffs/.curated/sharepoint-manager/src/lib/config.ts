/**
 * Configuration management for SharePoint riffset
 *
 * Three-tier configuration system:
 * 1. Defaults (in Zod schema) - lowest priority
 * 2. YAML config file - overrides defaults
 * 3. Environment variables - highest priority
 */

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import * as yaml from 'js-yaml';
import type { Logger } from 'pino';
import { loadDotEnv } from './load-dotenv.js';
import { createLogger } from './logger.js';
import { type SharepointManagerConfig, SharepointManagerConfigSchema } from './schema.js';

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

function applyEnvOverrides(config: SharepointManagerConfig): SharepointManagerConfig {
	const riff = config['sharepoint-manager'];

	// Paths overrides
	if (process.env['SHAREPOINT_MANAGER_SYNC_FOLDER']) {
		riff.paths.input.onedrive = process.env['SHAREPOINT_MANAGER_SYNC_FOLDER'];
	}
	if (process.env['SHAREPOINT_MANAGER_OUTPUT_CSV']) {
		riff.paths.output.index = process.env['SHAREPOINT_MANAGER_OUTPUT_CSV'];
	}
	if (process.env['SHAREPOINT_MANAGER_OUTPUT_SQLITE']) {
		riff.paths.database.file = process.env['SHAREPOINT_MANAGER_OUTPUT_SQLITE'];
	}

	// Links overrides
	if (process.env['SHAREPOINT_MANAGER_BASE_URL']) {
		riff.links.sharePointBase = process.env['SHAREPOINT_MANAGER_BASE_URL'];
	}
	if (process.env['SHAREPOINT_MANAGER_EXTRACTION_DELAY']) {
		const delay = parseInt(process.env['SHAREPOINT_MANAGER_EXTRACTION_DELAY'], 10);
		if (!Number.isNaN(delay)) {
			riff.links.extractionDelay = delay;
		}
	}

	// Processing overrides
	if (process.env['SHAREPOINT_MANAGER_BATCH_SIZE']) {
		const batchSize = parseInt(process.env['SHAREPOINT_MANAGER_BATCH_SIZE'], 10);
		if (!Number.isNaN(batchSize)) {
			riff.processing.batchSize = batchSize;
		}
	}

	// Database overrides
	if (process.env['SHAREPOINT_MANAGER_ONEDRIVE_DB_PATH']) {
		riff.paths.input.onedriveDb = process.env['SHAREPOINT_MANAGER_ONEDRIVE_DB_PATH'];
	}
	if (process.env['SHAREPOINT_MANAGER_METHOD']) {
		const method = process.env['SHAREPOINT_MANAGER_METHOD'].toLowerCase();
		if (method === 'auto' || method === 'database' || method === 'applescript') {
			riff.database.method = method;
		}
	}

	// Logging overrides
	if (process.env['SHAREPOINT_MANAGER_LOG_LEVEL']) {
		const level = process.env['SHAREPOINT_MANAGER_LOG_LEVEL'].toLowerCase();
		if (['trace', 'debug', 'info', 'warn', 'error', 'fatal'].includes(level)) {
			config.logging.level = level as typeof config.logging.level;
		}
	}
	if (process.env['SHAREPOINT_MANAGER_LOG_VERBOSE']) {
		config.logging.verbose = process.env['SHAREPOINT_MANAGER_LOG_VERBOSE'] === 'true';
	}
	if (process.env['SHAREPOINT_MANAGER_LOG_FILE']) {
		config.logging.file = process.env['SHAREPOINT_MANAGER_LOG_FILE'];
	}
	if (process.env['SHAREPOINT_MANAGER_LOG_MAX_FILE_SIZE_MB']) {
		const maxFileSizeMb = parseInt(process.env['SHAREPOINT_MANAGER_LOG_MAX_FILE_SIZE_MB'], 10);
		if (!Number.isNaN(maxFileSizeMb)) {
			config.logging.maxFileSizeMb = maxFileSizeMb;
		}
	}
	if (process.env['SHAREPOINT_MANAGER_LOG_MAX_FILES']) {
		const maxFiles = parseInt(process.env['SHAREPOINT_MANAGER_LOG_MAX_FILES'], 10);
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
 * 2. YAML config file overrides
 * 3. Environment variable overrides
 */
export function loadConfig(configPath?: string): SharepointManagerConfig {
	loadDotEnv();
	const defaultPath = resolve(getRiffRoot(), 'config.yaml');
	const finalPath = configPath ?? defaultPath;
	const explicitPathProvided = configPath !== undefined;

	let config: SharepointManagerConfig;

	if (!existsSync(finalPath)) {
		if (explicitPathProvided) {
			throw new ConfigError(`Config file not found: ${finalPath}`);
		}
		config = SharepointManagerConfigSchema.parse({});
	} else {
		try {
			const fileContents = readFileSync(finalPath, 'utf8');
			const parsed = yaml.load(fileContents) as Record<string, unknown>;
			config = SharepointManagerConfigSchema.parse(parsed);
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

/**
 * Initialize logger with config and CLI verbose flag override
 */
export function initLogger(configPath?: string, verbose?: boolean): Logger {
	const config = loadConfig(configPath);

	return createLogger({
		level: config.logging.level,
		verbose: verbose || config.logging.verbose,
		file: config.logging.file,
		maxFileSizeMb: config.logging.maxFileSizeMb,
		maxFiles: config.logging.maxFiles,
	});
}
