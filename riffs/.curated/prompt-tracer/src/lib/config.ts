/**
 * Configuration management for prompt-tracer riff
 * Uses 3-tier configuration: Zod defaults -> YAML file -> Environment variables
 */

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { load as yamlLoad } from 'js-yaml';
import { loadDotEnv } from './load-dotenv.js';
import { type PromptTracerConfig, PromptTracerConfigSchema } from './schema.js';

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

function applyEnvOverrides(config: PromptTracerConfig): PromptTracerConfig {
	const riff = config['prompt-tracer'];

	// Logging overrides
	if (process.env['PROMPT_TRACER_LOG_LEVEL']) {
		const level = process.env['PROMPT_TRACER_LOG_LEVEL'].toLowerCase();
		if (['trace', 'debug', 'info', 'warn', 'error', 'fatal'].includes(level)) {
			config.logging.level = level as typeof config.logging.level;
		}
	}
	if (process.env['PROMPT_TRACER_LOG_VERBOSE']) {
		config.logging.verbose = process.env['PROMPT_TRACER_LOG_VERBOSE'] === 'true';
	}
	if (process.env['PROMPT_TRACER_LOG_FILE']) {
		config.logging.file = process.env['PROMPT_TRACER_LOG_FILE'];
	}
	if (process.env['PROMPT_TRACER_LOG_MAX_FILE_SIZE_MB']) {
		const maxFileSizeMb = Number(process.env['PROMPT_TRACER_LOG_MAX_FILE_SIZE_MB']);
		if (!Number.isNaN(maxFileSizeMb)) {
			config.logging.maxFileSizeMb = maxFileSizeMb;
		}
	}
	if (process.env['PROMPT_TRACER_LOG_MAX_FILES']) {
		const maxFiles = Number(process.env['PROMPT_TRACER_LOG_MAX_FILES']);
		if (!Number.isNaN(maxFiles)) {
			config.logging.maxFiles = maxFiles;
		}
	}

	// Output overrides
	if (process.env['PROMPT_TRACER_OUTPUT_DIRECTORY']) {
		riff.paths.output.reports = process.env['PROMPT_TRACER_OUTPUT_DIRECTORY'];
	}

	// Processing overrides
	if (process.env['PROMPT_TRACER_TRACE_DIRECTORY']) {
		riff.paths.output.traces = process.env['PROMPT_TRACER_TRACE_DIRECTORY'];
	}

	return config;
}

// =============================================================================
// LOAD CONFIG
// =============================================================================

/**
 * Load configuration with 3-tier priority:
 * 1. Zod schema defaults (lowest)
 * 2. YAML config file (if exists)
 * 3. Environment variables (highest)
 *
 * @param configPath - Optional explicit path to config file
 * @returns Validated configuration object
 * @throws ConfigError if explicit path doesn't exist or validation fails
 */
export function loadConfig(configPath?: string): PromptTracerConfig {
	loadDotEnv();
	const defaultPath = resolve(getRiffRoot(), 'config.yaml');
	const finalPath = configPath ?? defaultPath;
	const explicitPathProvided = configPath !== undefined;

	let config: PromptTracerConfig;

	if (!existsSync(finalPath)) {
		if (explicitPathProvided) {
			throw new ConfigError(`Config file not found: ${finalPath}`);
		}
		config = PromptTracerConfigSchema.parse({});
	} else {
		try {
			const content = readFileSync(finalPath, 'utf-8');
			const raw = yamlLoad(content);
			config = PromptTracerConfigSchema.parse(raw);
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

// Re-export types from schema for convenience
export type {
	LoggingConfig,
	PathsConfig,
	PromptTracerConfig,
	PromptTracerRiffConfig,
} from './schema.js';
