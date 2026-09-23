/**
 * Configuration management for image-transcoder riff
 * 3-tier config: Defaults (Zod) -> YAML file -> Environment variables
 */

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { parse as yamlParse } from 'yaml';
import { loadDotEnv } from './load-dotenv.js';
import { type ImageTranscoderConfig, ImageTranscoderConfigSchema } from './schema.js';

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

function applyEnvOverrides(config: ImageTranscoderConfig): ImageTranscoderConfig {
	const riff = config['image-transcoder'];

	// Transcoding overrides
	if (process.env['IMAGE_TRANSCODER_MAX_SIZE']) {
		const maxSizeMb = Number.parseInt(process.env['IMAGE_TRANSCODER_MAX_SIZE'], 10);
		if (!Number.isNaN(maxSizeMb)) {
			riff.transcoding.maxFileSizeBytes = maxSizeMb * 1024 * 1024;
		}
	}
	if (process.env['IMAGE_TRANSCODER_QUALITY']) {
		const quality = Number.parseInt(process.env['IMAGE_TRANSCODER_QUALITY'], 10);
		if (!Number.isNaN(quality)) {
			riff.transcoding.quality = quality;
		}
	}

	// Paths overrides
	if (process.env['IMAGE_TRANSCODER_OUTPUT_DIR']) {
		riff.paths.output.dir = process.env['IMAGE_TRANSCODER_OUTPUT_DIR'];
	}
	if (process.env['IMAGE_TRANSCODER_INPUT_DIR']) {
		riff.paths.input.dir = process.env['IMAGE_TRANSCODER_INPUT_DIR'];
	}

	// Processing overrides
	if (process.env['IMAGE_TRANSCODER_RECURSIVE']) {
		riff.processing.recursive = process.env['IMAGE_TRANSCODER_RECURSIVE'] === 'true';
	}

	// Logging overrides
	if (process.env['IMAGE_TRANSCODER_LOG_LEVEL']) {
		const level = process.env['IMAGE_TRANSCODER_LOG_LEVEL'].toLowerCase();
		if (['trace', 'debug', 'info', 'warn', 'error', 'fatal'].includes(level)) {
			config.logging.level = level as typeof config.logging.level;
		}
	}
	if (process.env['IMAGE_TRANSCODER_LOG_VERBOSE']) {
		config.logging.verbose = process.env['IMAGE_TRANSCODER_LOG_VERBOSE'] === 'true';
	}
	if (process.env['IMAGE_TRANSCODER_LOG_FILE']) {
		config.logging.file = process.env['IMAGE_TRANSCODER_LOG_FILE'];
	}
	if (process.env['IMAGE_TRANSCODER_LOG_MAX_FILE_SIZE_MB']) {
		const maxFileSizeMb = Number.parseInt(process.env['IMAGE_TRANSCODER_LOG_MAX_FILE_SIZE_MB'], 10);
		if (!Number.isNaN(maxFileSizeMb)) {
			config.logging.maxFileSizeMb = maxFileSizeMb;
		}
	}
	if (process.env['IMAGE_TRANSCODER_LOG_MAX_FILES']) {
		const maxFiles = Number.parseInt(process.env['IMAGE_TRANSCODER_LOG_MAX_FILES'], 10);
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
export function loadConfig(configPath?: string): ImageTranscoderConfig {
	loadDotEnv();
	const defaultPath = resolve(getRiffRoot(), 'config.yaml');
	const finalPath = configPath ?? defaultPath;
	const explicitPathProvided = configPath !== undefined;

	let config: ImageTranscoderConfig;

	if (!existsSync(finalPath)) {
		if (explicitPathProvided) {
			throw new ConfigError(`Config file not found: ${finalPath}`);
		}
		config = ImageTranscoderConfigSchema.parse({});
	} else {
		try {
			const content = readFileSync(finalPath, 'utf-8');
			const raw = yamlParse(content) || {};
			config = ImageTranscoderConfigSchema.parse(raw);
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
