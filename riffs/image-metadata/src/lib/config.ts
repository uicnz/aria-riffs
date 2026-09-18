/**
 * Configuration management for image-metadata
 *
 * Three-tier configuration system:
 * 1. Defaults (in Zod schema) - lowest priority
 * 2. YAML config file - overrides defaults
 * 3. Environment variables - highest priority
 *
 * Structure follows the canonical Aria config pattern:
 * - 'image-metadata:' wrapper for riff-specific config
 * - 'logging:' top-level peer section
 * - 'llmProviders:' top-level peer section for provider details
 */

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import * as yaml from 'js-yaml';
import { loadDotEnv } from './load-dotenv.js';
import { type ImageMetadataConfig, ImageMetadataConfigSchema } from './schema.js';

// Re-export config type
export type { ImageMetadataConfig } from './schema.js';

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

function applyEnvOverrides(config: ImageMetadataConfig): ImageMetadataConfig {
	const riff = config['image-metadata'];

	// Provider selection override (riff-specific, replaces LLM_PROVIDER)
	const envProvider = process.env['IMAGE_METADATA_PROVIDER']?.toLowerCase();
	if (envProvider === 'ollama' || envProvider === 'anthropic' || envProvider === 'gemini') {
		riff.llm.provider = envProvider;
	}

	// Database path override (riff-specific)
	if (process.env['IMAGE_METADATA_DATABASE_PATH']) {
		riff.paths.database.file = process.env['IMAGE_METADATA_DATABASE_PATH'];
	}

	// Ollama overrides (cross-riff provider config)
	if (process.env['IMAGE_METADATA_OLLAMA_ENDPOINT']) {
		config.llmProviders.ollama.endpoint = process.env['IMAGE_METADATA_OLLAMA_ENDPOINT'];
	}
	if (process.env['IMAGE_METADATA_OLLAMA_MODEL']) {
		config.llmProviders.ollama.model = process.env['IMAGE_METADATA_OLLAMA_MODEL'];
	}
	if (process.env['IMAGE_METADATA_OLLAMA_TIMEOUT']) {
		config.llmProviders.ollama.timeout = parseInt(process.env['IMAGE_METADATA_OLLAMA_TIMEOUT'], 10);
	}
	if (process.env['IMAGE_METADATA_OLLAMA_PROMPT']) {
		config.llmProviders.ollama.prompt = process.env['IMAGE_METADATA_OLLAMA_PROMPT'];
	}

	// Anthropic overrides (cross-riff provider config)
	if (process.env['ANTHROPIC_API_KEY']) {
		config.llmProviders.anthropic.apiKey = process.env['ANTHROPIC_API_KEY'];
	}
	if (process.env['IMAGE_METADATA_ANTHROPIC_MODEL']) {
		config.llmProviders.anthropic.model = process.env['IMAGE_METADATA_ANTHROPIC_MODEL'];
	}
	if (process.env['IMAGE_METADATA_ANTHROPIC_TIMEOUT']) {
		config.llmProviders.anthropic.timeout = parseInt(process.env['IMAGE_METADATA_ANTHROPIC_TIMEOUT'], 10);
	}
	if (process.env['IMAGE_METADATA_ANTHROPIC_MAX_TOKENS']) {
		config.llmProviders.anthropic.maxTokens = parseInt(process.env['IMAGE_METADATA_ANTHROPIC_MAX_TOKENS'], 10);
	}
	if (process.env['IMAGE_METADATA_ANTHROPIC_BASE_URL']) {
		config.llmProviders.anthropic.baseUrl = process.env['IMAGE_METADATA_ANTHROPIC_BASE_URL'];
	}
	if (process.env['IMAGE_METADATA_ANTHROPIC_PROMPT']) {
		config.llmProviders.anthropic.prompt = process.env['IMAGE_METADATA_ANTHROPIC_PROMPT'];
	}

	// Gemini overrides (cross-riff provider config)
	if (process.env['GOOGLE_API_KEY']) {
		config.llmProviders.gemini.apiKey = process.env['GOOGLE_API_KEY'];
	}
	if (process.env['IMAGE_METADATA_GOOGLE_MODEL']) {
		config.llmProviders.gemini.model = process.env['IMAGE_METADATA_GOOGLE_MODEL'];
	}
	if (process.env['IMAGE_METADATA_GOOGLE_TIMEOUT']) {
		config.llmProviders.gemini.timeout = parseInt(process.env['IMAGE_METADATA_GOOGLE_TIMEOUT'], 10);
	}
	if (process.env['IMAGE_METADATA_GOOGLE_MAX_TOKENS']) {
		config.llmProviders.gemini.maxTokens = parseInt(process.env['IMAGE_METADATA_GOOGLE_MAX_TOKENS'], 10);
	}
	if (process.env['IMAGE_METADATA_GOOGLE_BASE_URL']) {
		config.llmProviders.gemini.baseUrl = process.env['IMAGE_METADATA_GOOGLE_BASE_URL'];
	}
	if (process.env['IMAGE_METADATA_GOOGLE_PROMPT']) {
		config.llmProviders.gemini.prompt = process.env['IMAGE_METADATA_GOOGLE_PROMPT'];
	}

	// Logging overrides (peer section)
	if (process.env['IMAGE_METADATA_LOG_LEVEL']) {
		const level = process.env['IMAGE_METADATA_LOG_LEVEL'].toLowerCase();
		if (['trace', 'debug', 'info', 'warn', 'error', 'fatal'].includes(level)) {
			config.logging.level = level as typeof config.logging.level;
		}
	}
	if (process.env['IMAGE_METADATA_LOG_VERBOSE']) {
		config.logging.verbose = process.env['IMAGE_METADATA_LOG_VERBOSE'] === 'true';
	}
	if (process.env['IMAGE_METADATA_LOG_FILE']) {
		config.logging.file = process.env['IMAGE_METADATA_LOG_FILE'];
	}

	return config;
}

// =============================================================================
// LOADER - Tiered config: Defaults -> YAML -> Env vars
// =============================================================================

export function loadConfig(configPath?: string): ImageMetadataConfig {
	loadDotEnv();
	const defaultPath = resolve(getRiffRoot(), 'config.yaml');
	const finalPath = configPath ?? defaultPath;
	const explicitPathProvided = configPath !== undefined;

	let config: ImageMetadataConfig;

	if (!existsSync(finalPath)) {
		if (explicitPathProvided) {
			throw new ConfigError(`Config file not found: ${finalPath}`);
		}
		// No config file - use defaults only
		config = ImageMetadataConfigSchema.parse({});
	} else {
		try {
			const content = readFileSync(finalPath, 'utf-8');
			const raw = yaml.load(content);
			config = ImageMetadataConfigSchema.parse(raw);
		} catch (error) {
			// Improve Zod error messages
			if (error && typeof error === 'object' && 'issues' in error) {
				const zodError = error as { issues: Array<{ path: string[]; message: string }> };
				const messages = zodError.issues
					.map(issue => `  - ${issue.path.join('.')}: ${issue.message}`)
					.join('\n');
				throw new ConfigError(`Config validation failed:\n${messages}`);
			}
			throw new ConfigError(`Failed to load configuration from ${finalPath}: ${error}`);
		}
	}

	// Tier 3: Environment variables override everything
	config = expandTildePaths(config);
	return applyEnvOverrides(config);
}

// =============================================================================
// CONFIG PATH EXPORT
// =============================================================================

export const configPath = resolve(getRiffRoot(), 'config.yaml');
