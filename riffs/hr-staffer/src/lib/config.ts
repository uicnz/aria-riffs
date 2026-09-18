/**
 * Configuration management for hr-staffer riff
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
import { loadDotEnv } from './load-dotenv.js';
import { type HrStafferConfig, HrStafferConfigSchema, type HrStafferRiffConfig } from './schema.js';

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

function applyEnvOverrides(config: HrStafferConfig): HrStafferConfig {
	const riff = config['hr-staffer'];

	// Embeddings provider override
	if (riff.embeddings) {
		const envProvider = process.env['HR_STAFFER_EMBEDDINGS_PROVIDER']?.toLowerCase();
		if (envProvider === 'openai' || envProvider === 'gemini' || envProvider === 'ollama') {
			riff.embeddings.provider = envProvider;
		}

		// OpenAI overrides
		if (process.env['OPENAI_API_KEY'] && riff.embeddings.openai) {
			riff.embeddings.openai.apiKey = process.env['OPENAI_API_KEY'];
		}
		if (process.env['HR_STAFFER_OPENAI_EMBEDDING_MODEL'] && riff.embeddings.openai) {
			riff.embeddings.openai.model = process.env['HR_STAFFER_OPENAI_EMBEDDING_MODEL'];
		}

		// Gemini overrides
		if (process.env['GOOGLE_API_KEY'] && riff.embeddings.gemini) {
			riff.embeddings.gemini.apiKey = process.env['GOOGLE_API_KEY'];
		}

		// Ollama overrides
		if (process.env['HR_STAFFER_OLLAMA_ENDPOINT'] && riff.embeddings.ollama) {
			riff.embeddings.ollama.endpoint = process.env['HR_STAFFER_OLLAMA_ENDPOINT'];
		}
	}

	// Database path override
	if (process.env['HR_STAFFER_DATABASE_PATH']) {
		riff.paths.database.file = process.env['HR_STAFFER_DATABASE_PATH'];
	}

	// Logging overrides
	if (process.env['HR_STAFFER_LOG_LEVEL']) {
		const level = process.env['HR_STAFFER_LOG_LEVEL'].toLowerCase();
		if (['trace', 'debug', 'info', 'warn', 'error', 'fatal'].includes(level)) {
			config.logging.level = level as typeof config.logging.level;
		}
	}
	if (process.env['HR_STAFFER_LOG_VERBOSE']) {
		config.logging.verbose = process.env['HR_STAFFER_LOG_VERBOSE'] === 'true';
	}
	if (process.env['HR_STAFFER_LOG_FILE']) {
		config.logging.file = process.env['HR_STAFFER_LOG_FILE'];
	}
	if (process.env['HR_STAFFER_LOG_MAX_FILE_SIZE_MB']) {
		const maxFileSizeMb = parseInt(process.env['HR_STAFFER_LOG_MAX_FILE_SIZE_MB'], 10);
		if (!Number.isNaN(maxFileSizeMb)) {
			config.logging.maxFileSizeMb = maxFileSizeMb;
		}
	}
	if (process.env['HR_STAFFER_LOG_MAX_FILES']) {
		const maxFiles = parseInt(process.env['HR_STAFFER_LOG_MAX_FILES'], 10);
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
export function loadConfig(configPath?: string): HrStafferConfig {
	loadDotEnv();
	const defaultPath = resolve(getRiffRoot(), 'config.yaml');
	const finalPath = configPath ?? defaultPath;
	const explicitPathProvided = configPath !== undefined;

	let config: HrStafferConfig;

	if (!existsSync(finalPath)) {
		if (explicitPathProvided) {
			throw new ConfigError(`Config file not found: ${finalPath}`);
		}
		config = HrStafferConfigSchema.parse({});
	} else {
		try {
			const fileContent = readFileSync(finalPath, 'utf8');
			const rawConfig = yaml.load(fileContent) as Record<string, unknown>;
			config = HrStafferConfigSchema.parse(rawConfig);
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
 * Parse and validate YAML content against schema (for testing)
 */
export function parseAndValidateConfig(fileContent: string): HrStafferRiffConfig {
	const parsed = yaml.load(fileContent) as Record<string, unknown>;
	const validationResult = HrStafferConfigSchema.safeParse(parsed);

	if (!validationResult.success) {
		const formatted = validationResult.error.format();
		throw new ConfigError(`Config file validation failed: ${JSON.stringify(formatted)}`);
	}

	return validationResult.data['hr-staffer'];
}
