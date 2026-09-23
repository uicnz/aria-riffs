/**
 * Configuration management for image-renamer riff
 * 3-tier config: Defaults (Zod) -> YAML file -> Environment variables
 */

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { parse as yamlParse } from 'yaml';
import { loadDotEnv } from './load-dotenv.js';
import { type ImageRenamerConfig, ImageRenamerConfigSchema } from './schema.js';

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

function applyEnvOverrides(config: ImageRenamerConfig): ImageRenamerConfig {
	const riff = config['image-renamer'];

	// LLM Provider selection
	const envProvider = process.env['IMAGE_RENAMER_LLM_PROVIDER']?.toLowerCase();
	if (envProvider === 'ollama' || envProvider === 'anthropic' || envProvider === 'gemini') {
		riff.llm.provider = envProvider;
	}

	// Ollama overrides
	if (process.env['IMAGE_RENAMER_OLLAMA_ENDPOINT']) {
		riff.llm.ollama.endpoint = process.env['IMAGE_RENAMER_OLLAMA_ENDPOINT'];
	}
	if (process.env['IMAGE_RENAMER_OLLAMA_MODEL']) {
		riff.llm.ollama.model = process.env['IMAGE_RENAMER_OLLAMA_MODEL'];
	}
	if (process.env['IMAGE_RENAMER_OLLAMA_TIMEOUT']) {
		const timeout = parseInt(process.env['IMAGE_RENAMER_OLLAMA_TIMEOUT'], 10);
		if (!Number.isNaN(timeout)) {
			riff.llm.ollama.timeout = timeout;
		}
	}
	if (process.env['IMAGE_RENAMER_OLLAMA_RETRY_ATTEMPTS']) {
		const retryAttempts = parseInt(process.env['IMAGE_RENAMER_OLLAMA_RETRY_ATTEMPTS'], 10);
		if (!Number.isNaN(retryAttempts)) {
			riff.llm.ollama.retryAttempts = retryAttempts;
		}
	}
	if (process.env['IMAGE_RENAMER_OLLAMA_RETRY_DELAY']) {
		const retryDelay = parseFloat(process.env['IMAGE_RENAMER_OLLAMA_RETRY_DELAY']);
		if (!Number.isNaN(retryDelay)) {
			riff.llm.ollama.retryDelay = retryDelay;
		}
	}
	if (process.env['IMAGE_RENAMER_OLLAMA_PROMPT']) {
		riff.llm.ollama.prompt = process.env['IMAGE_RENAMER_OLLAMA_PROMPT'];
	}

	// Anthropic overrides
	if (process.env['ANTHROPIC_API_KEY']) {
		riff.llm.anthropic.apiKey = process.env['ANTHROPIC_API_KEY'];
	}
	if (process.env['IMAGE_RENAMER_ANTHROPIC_MODEL']) {
		riff.llm.anthropic.model = process.env['IMAGE_RENAMER_ANTHROPIC_MODEL'];
	}
	if (process.env['IMAGE_RENAMER_ANTHROPIC_TIMEOUT']) {
		const timeout = parseInt(process.env['IMAGE_RENAMER_ANTHROPIC_TIMEOUT'], 10);
		if (!Number.isNaN(timeout)) {
			riff.llm.anthropic.timeout = timeout;
		}
	}
	if (process.env['IMAGE_RENAMER_ANTHROPIC_MAX_TOKENS']) {
		const maxTokens = parseInt(process.env['IMAGE_RENAMER_ANTHROPIC_MAX_TOKENS'], 10);
		if (!Number.isNaN(maxTokens)) {
			riff.llm.anthropic.maxTokens = maxTokens;
		}
	}
	if (process.env['IMAGE_RENAMER_ANTHROPIC_BASE_URL']) {
		riff.llm.anthropic.baseUrl = process.env['IMAGE_RENAMER_ANTHROPIC_BASE_URL'];
	}
	if (process.env['IMAGE_RENAMER_ANTHROPIC_PROMPT']) {
		riff.llm.anthropic.prompt = process.env['IMAGE_RENAMER_ANTHROPIC_PROMPT'];
	}

	// Gemini overrides
	if (process.env['GOOGLE_API_KEY']) {
		riff.llm.gemini.apiKey = process.env['GOOGLE_API_KEY'];
	}
	if (process.env['IMAGE_RENAMER_GOOGLE_MODEL']) {
		riff.llm.gemini.model = process.env['IMAGE_RENAMER_GOOGLE_MODEL'];
	}
	if (process.env['IMAGE_RENAMER_GOOGLE_TIMEOUT']) {
		const timeout = parseInt(process.env['IMAGE_RENAMER_GOOGLE_TIMEOUT'], 10);
		if (!Number.isNaN(timeout)) {
			riff.llm.gemini.timeout = timeout;
		}
	}
	if (process.env['IMAGE_RENAMER_GOOGLE_MAX_TOKENS']) {
		const maxTokens = parseInt(process.env['IMAGE_RENAMER_GOOGLE_MAX_TOKENS'], 10);
		if (!Number.isNaN(maxTokens)) {
			riff.llm.gemini.maxTokens = maxTokens;
		}
	}
	if (process.env['IMAGE_RENAMER_GOOGLE_BASE_URL']) {
		riff.llm.gemini.baseUrl = process.env['IMAGE_RENAMER_GOOGLE_BASE_URL'];
	}
	if (process.env['IMAGE_RENAMER_GOOGLE_PROMPT']) {
		riff.llm.gemini.prompt = process.env['IMAGE_RENAMER_GOOGLE_PROMPT'];
	}

	// Filename prompt override
	if (process.env['IMAGE_RENAMER_FILENAME_PROMPT']) {
		riff.filename.prompt = process.env['IMAGE_RENAMER_FILENAME_PROMPT'];
	}

	// Logging overrides
	if (process.env['IMAGE_RENAMER_LOG_LEVEL']) {
		const level = process.env['IMAGE_RENAMER_LOG_LEVEL'].toLowerCase();
		if (['trace', 'debug', 'info', 'warn', 'error', 'fatal'].includes(level)) {
			config.logging.level = level as typeof config.logging.level;
		}
	}
	if (process.env['IMAGE_RENAMER_LOG_VERBOSE']) {
		config.logging.verbose = process.env['IMAGE_RENAMER_LOG_VERBOSE'] === 'true';
	}
	if (process.env['IMAGE_RENAMER_LOG_FILE']) {
		config.logging.file = process.env['IMAGE_RENAMER_LOG_FILE'];
	}
	if (process.env['IMAGE_RENAMER_LOG_MAX_FILE_SIZE_MB']) {
		const maxFileSizeMb = parseInt(process.env['IMAGE_RENAMER_LOG_MAX_FILE_SIZE_MB'], 10);
		if (!Number.isNaN(maxFileSizeMb)) {
			config.logging.maxFileSizeMb = maxFileSizeMb;
		}
	}
	if (process.env['IMAGE_RENAMER_LOG_MAX_FILES']) {
		const maxFiles = parseInt(process.env['IMAGE_RENAMER_LOG_MAX_FILES'], 10);
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
export function loadConfig(configPath?: string): ImageRenamerConfig {
	loadDotEnv();
	const defaultPath = resolve(getRiffRoot(), 'config.yaml');
	const finalPath = configPath ?? defaultPath;
	const explicitPathProvided = configPath !== undefined;

	let config: ImageRenamerConfig;

	if (!existsSync(finalPath)) {
		if (explicitPathProvided) {
			throw new ConfigError(`Config file not found: ${finalPath}`);
		}
		// Use defaults from Zod schema
		config = ImageRenamerConfigSchema.parse({});
	} else {
		try {
			const fileContent = readFileSync(finalPath, 'utf8');
			const rawConfig = yamlParse(fileContent) || {};
			config = ImageRenamerConfigSchema.parse(rawConfig);
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
