/**
 * Configuration management for commit-formatter
 * 3-tier config: Defaults (Zod) -> YAML file -> Environment variables
 */

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import * as yaml from 'js-yaml';
import { loadDotEnv } from './load-dotenv.js';
import { type CommitFormatterConfig, CommitFormatterConfigSchema } from './schema.js';

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

function applyEnvOverrides(config: CommitFormatterConfig): CommitFormatterConfig {
	const riff = config['commit-formatter'];

	// Provider selection override
	if (process.env['COMMIT_FORMATTER_LLM_PROVIDER']) {
		const provider = process.env['COMMIT_FORMATTER_LLM_PROVIDER'].toLowerCase();
		if (provider === 'anthropic' || provider === 'gemini' || provider === 'openai') {
			riff.llm.provider = provider;
		}
	}

	// Anthropic overrides
	if (process.env['ANTHROPIC_API_KEY']) {
		riff.llm.anthropic.apiKey = process.env['ANTHROPIC_API_KEY'];
	}
	if (process.env['COMMIT_FORMATTER_ANTHROPIC_MODEL']) {
		riff.llm.anthropic.model = process.env['COMMIT_FORMATTER_ANTHROPIC_MODEL'];
	}

	// Gemini overrides
	if (process.env['GOOGLE_API_KEY']) {
		riff.llm.gemini.apiKey = process.env['GOOGLE_API_KEY'];
	}
	if (process.env['COMMIT_FORMATTER_GOOGLE_MODEL']) {
		riff.llm.gemini.model = process.env['COMMIT_FORMATTER_GOOGLE_MODEL'];
	}

	// OpenAI overrides
	if (process.env['OPENAI_API_KEY']) {
		riff.llm.openai.apiKey = process.env['OPENAI_API_KEY'];
	}
	if (process.env['COMMIT_FORMATTER_OPENAI_MODEL']) {
		riff.llm.openai.model = process.env['COMMIT_FORMATTER_OPENAI_MODEL'];
	}

	// Logging overrides
	if (process.env['COMMIT_FORMATTER_LOG_LEVEL']) {
		const level = process.env['COMMIT_FORMATTER_LOG_LEVEL'].toLowerCase();
		if (['trace', 'debug', 'info', 'warn', 'error', 'fatal'].includes(level)) {
			config.logging.level = level as typeof config.logging.level;
		}
	}
	if (process.env['COMMIT_FORMATTER_LOG_VERBOSE']) {
		config.logging.verbose = process.env['COMMIT_FORMATTER_LOG_VERBOSE'] === 'true';
	}
	if (process.env['COMMIT_FORMATTER_LOG_FILE']) {
		config.logging.file = process.env['COMMIT_FORMATTER_LOG_FILE'];
	}
	if (process.env['COMMIT_FORMATTER_LOG_MAX_FILE_SIZE_MB']) {
		const maxFileSizeMb = Number.parseInt(process.env['COMMIT_FORMATTER_LOG_MAX_FILE_SIZE_MB'], 10);
		if (!Number.isNaN(maxFileSizeMb)) {
			config.logging.maxFileSizeMb = maxFileSizeMb;
		}
	}
	if (process.env['COMMIT_FORMATTER_LOG_MAX_FILES']) {
		const maxFiles = Number.parseInt(process.env['COMMIT_FORMATTER_LOG_MAX_FILES'], 10);
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
export function loadConfig(configPath?: string): CommitFormatterConfig {
	loadDotEnv();
	const defaultPath = resolve(getRiffRoot(), 'config.yaml');
	const finalPath = configPath ?? defaultPath;
	const explicitPathProvided = configPath !== undefined;

	let config: CommitFormatterConfig;

	if (!existsSync(finalPath)) {
		if (explicitPathProvided) {
			throw new ConfigError(`Config file not found: ${finalPath}`);
		}
		config = CommitFormatterConfigSchema.parse({});
	} else {
		try {
			const content = readFileSync(finalPath, 'utf-8');
			const raw = yaml.load(content);
			config = CommitFormatterConfigSchema.parse(raw);
		} catch (error) {
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

	config = expandTildePaths(config);
	return applyEnvOverrides(config);
}

// =============================================================================
// CONFIG PATH EXPORT
// =============================================================================

export const configPath = resolve(getRiffRoot(), 'config.yaml');
