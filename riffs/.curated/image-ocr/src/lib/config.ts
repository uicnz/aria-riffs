/**
 * Configuration management for image-ocr riff
 * 3-tier config: Defaults (Zod) -> YAML file -> Environment variables
 */

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { parse as yamlParse } from 'yaml';
import { loadDotEnv } from './load-dotenv.js';
import { type ImageOcrConfig, ImageOcrConfigSchema } from './schema.js';

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

function applyEnvOverrides(config: ImageOcrConfig): ImageOcrConfig {
	const riff = config['image-ocr'];

	// OCR settings
	if (process.env['IMAGE_OCR_LANGUAGE']) {
		riff.ocr.language = process.env['IMAGE_OCR_LANGUAGE'];
	}
	if (process.env['IMAGE_OCR_CONFIDENCE_THRESHOLD']) {
		const threshold = parseFloat(process.env['IMAGE_OCR_CONFIDENCE_THRESHOLD']);
		if (!Number.isNaN(threshold)) {
			riff.ocr.confidenceThreshold = threshold;
		}
	}
	if (process.env['IMAGE_OCR_TIMEOUT']) {
		const timeout = parseInt(process.env['IMAGE_OCR_TIMEOUT'], 10);
		if (!Number.isNaN(timeout)) {
			riff.ocr.timeout = timeout;
		}
	}

	// Output settings
	if (process.env['IMAGE_OCR_OUTPUT_FORMAT']) {
		riff.output.format = process.env['IMAGE_OCR_OUTPUT_FORMAT'];
	}
	if (process.env['IMAGE_OCR_DATABASE_DIR']) {
		riff.paths.database.dir = process.env['IMAGE_OCR_DATABASE_DIR'];
	}

	// Logging overrides (peer section - access via config.logging)
	if (process.env['IMAGE_OCR_LOG_LEVEL']) {
		const level = process.env['IMAGE_OCR_LOG_LEVEL'].toLowerCase();
		if (['trace', 'debug', 'info', 'warn', 'error', 'fatal'].includes(level)) {
			config.logging.level = level as typeof config.logging.level;
		}
	}
	if (process.env['IMAGE_OCR_LOG_VERBOSE']) {
		config.logging.verbose = process.env['IMAGE_OCR_LOG_VERBOSE'] === 'true';
	}
	if (process.env['IMAGE_OCR_LOG_FILE']) {
		config.logging.file = process.env['IMAGE_OCR_LOG_FILE'];
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
export function loadConfig(configPath?: string): ImageOcrConfig {
	loadDotEnv();
	const defaultPath = resolve(getRiffRoot(), 'config.yaml');
	const finalPath = configPath ?? defaultPath;
	const explicitPathProvided = configPath !== undefined;

	let config: ImageOcrConfig;

	if (!existsSync(finalPath)) {
		if (explicitPathProvided) {
			throw new ConfigError(`Config file not found: ${finalPath}`);
		}
		// Use defaults from Zod schema
		config = ImageOcrConfigSchema.parse({
			'image-ocr': {},
			logging: {},
		});
	} else {
		try {
			const fileContent = readFileSync(finalPath, 'utf8');
			const rawConfig = yamlParse(fileContent) || {};
			config = ImageOcrConfigSchema.parse(rawConfig);
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
