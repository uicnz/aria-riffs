/**
 * Configuration management for hr-policy riff
 *
 * Three-tier configuration system:
 * 1. Defaults (in Zod schema) - lowest priority
 * 2. YAML config file - overrides defaults
 * 3. Environment variables - highest priority
 */

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { load as yamlLoad } from 'js-yaml';
import type { UnifiedEmbeddingConfig } from '../providers/embedding-client.js';
import { loadDotEnv } from './load-dotenv.js';
import { type HrPolicyConfig, HrPolicyConfigSchema, type LoggingConfig } from './schema.js';
import type { DecomposerConfig, IndexerConfig } from './types.js';

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

function applyEnvOverrides(config: HrPolicyConfig): HrPolicyConfig {
	const riff = config['hr-policy'];

	// Embeddings provider override
	const envProvider = process.env['HR_POLICY_EMBEDDINGS_PROVIDER']?.toLowerCase();
	if (envProvider === 'openai' || envProvider === 'gemini' || envProvider === 'ollama') {
		riff.embeddings.provider = envProvider;
	}

	// OpenAI overrides
	if (process.env['OPENAI_API_KEY']) {
		riff.embeddings.openai.apiKey = process.env['OPENAI_API_KEY'];
	}
	if (process.env['HR_POLICY_OPENAI_EMBEDDING_MODEL']) {
		riff.embeddings.openai.model = process.env['HR_POLICY_OPENAI_EMBEDDING_MODEL'];
	}
	if (process.env['HR_POLICY_OPENAI_EMBEDDING_DIMENSIONS']) {
		const dimensions = parseInt(process.env['HR_POLICY_OPENAI_EMBEDDING_DIMENSIONS'], 10);
		if (!Number.isNaN(dimensions)) {
			riff.embeddings.openai.dimensions = dimensions;
		}
	}

	// Gemini overrides
	if (process.env['GOOGLE_API_KEY']) {
		riff.embeddings.gemini.apiKey = process.env['GOOGLE_API_KEY'];
	}
	if (process.env['HR_POLICY_GOOGLE_EMBEDDING_MODEL']) {
		riff.embeddings.gemini.model = process.env['HR_POLICY_GOOGLE_EMBEDDING_MODEL'];
	}

	// Ollama overrides
	if (process.env['HR_POLICY_OLLAMA_ENDPOINT']) {
		riff.embeddings.ollama.endpoint = process.env['HR_POLICY_OLLAMA_ENDPOINT'];
	}
	if (process.env['HR_POLICY_OLLAMA_EMBEDDING_MODEL']) {
		riff.embeddings.ollama.model = process.env['HR_POLICY_OLLAMA_EMBEDDING_MODEL'];
	}

	// Decomposer overrides
	if (process.env['HR_POLICY_PRIMARY_PATTERN']) {
		riff.decomposer.primaryPattern = process.env['HR_POLICY_PRIMARY_PATTERN'];
	}
	if (process.env['HR_POLICY_FALLBACK_PATTERN']) {
		riff.decomposer.fallbackPattern = process.env['HR_POLICY_FALLBACK_PATTERN'];
	}
	if (process.env['HR_POLICY_INPUT_DIR']) {
		riff.paths.input.policies = process.env['HR_POLICY_INPUT_DIR'];
	}
	if (process.env['HR_POLICY_OUTPUT_DIR']) {
		riff.paths.output.sections = process.env['HR_POLICY_OUTPUT_DIR'];
	}
	if (process.env['HR_POLICY_FILE_PATTERNS']) {
		riff.decomposer.filePatterns = process.env['HR_POLICY_FILE_PATTERNS'].split(',').map(p => p.trim());
	}

	// Logging overrides
	if (process.env['HR_POLICY_LOG_LEVEL']) {
		const level = process.env['HR_POLICY_LOG_LEVEL'].toLowerCase();
		if (['trace', 'debug', 'info', 'warn', 'error', 'fatal'].includes(level)) {
			config.logging.level = level as typeof config.logging.level;
		}
	}
	if (process.env['HR_POLICY_LOG_VERBOSE']) {
		config.logging.verbose = process.env['HR_POLICY_LOG_VERBOSE'] === 'true';
	}
	if (process.env['HR_POLICY_LOG_FILE']) {
		config.logging.file = process.env['HR_POLICY_LOG_FILE'];
	}
	if (process.env['HR_POLICY_LOG_MAX_FILE_SIZE_MB']) {
		const maxFileSizeMb = parseInt(process.env['HR_POLICY_LOG_MAX_FILE_SIZE_MB'], 10);
		if (!Number.isNaN(maxFileSizeMb)) {
			config.logging.maxFileSizeMb = maxFileSizeMb;
		}
	}
	if (process.env['HR_POLICY_LOG_MAX_FILES']) {
		const maxFiles = parseInt(process.env['HR_POLICY_LOG_MAX_FILES'], 10);
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
export function loadConfig(configPath?: string): HrPolicyConfig {
	loadDotEnv();
	const defaultPath = resolve(getRiffRoot(), 'config.yaml');
	const finalPath = configPath ?? defaultPath;
	const explicitPathProvided = configPath !== undefined;

	let config: HrPolicyConfig;

	if (!existsSync(finalPath)) {
		if (explicitPathProvided) {
			throw new ConfigError(`Config file not found: ${finalPath}`);
		}
		config = HrPolicyConfigSchema.parse({});
	} else {
		try {
			const content = readFileSync(finalPath, 'utf-8');
			const raw = yamlLoad(content);
			config = HrPolicyConfigSchema.parse(raw);
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

// =============================================================================
// LOGGING CONFIG
// =============================================================================

/**
 * Default logging configuration
 */
export const DEFAULT_LOGGING = {
	level: 'info',
	verbose: false,
	file: '.aria/logs/hr-policy.log',
	maxFileSizeMb: 10,
	maxFiles: 7,
};

/**
 * Load logging configuration from YAML file with env overrides
 */
export function loadLoggingConfig(configPath?: string): LoggingConfig {
	const config = loadConfig(configPath);

	// Apply environment variable overrides
	const level = process.env['HR_POLICY_LOG_LEVEL'] ?? config.logging.level;
	const verbose = process.env['HR_POLICY_LOG_VERBOSE']
		? process.env['HR_POLICY_LOG_VERBOSE'] === 'true'
		: config.logging.verbose;
	const file = process.env['HR_POLICY_LOG_FILE'] ?? config.logging.file;

	return {
		level: level as LoggingConfig['level'],
		verbose,
		file,
		maxFileSizeMb: config.logging.maxFileSizeMb,
		maxFiles: config.logging.maxFiles,
	};
}

// =============================================================================
// INDEXER CONFIG
// =============================================================================

/**
 * Default paths for the riff
 */
export const DEFAULT_PATHS = {
	input: {
		policies: 'sources/cello/hr-policies/',
		sections: '.aria/exports/cello/hr-policies/',
	},
	output: {
		sections: '.aria/exports/cello/hr-policies/',
		dir: '.aria/db/hr-policy',
	},
	database: {
		decomposer: '.aria/db/hr-policy/hr-policy.db',
		indexer: '.aria/db/hr-policy/hr-policy.sqlite',
	},
};

/**
 * Default indexer config (without embedding-derived fields)
 */
export const DEFAULT_DOC_INDEXER_CONFIG: Omit<IndexerConfig, 'model' | 'dimensions' | 'maxEmbedChars'> = {
	logging: DEFAULT_LOGGING,
	sections: 'both',
	weightResponse: 1.8,
	useFts: true,
	hybrid: true,
	alpha: 0.1,
	pathWeight: 0.15,
	showMetadata: true,
	highlight: true,
	snippetContextLines: 2,
	maxSnippetLength: 150,
};

/**
 * Load indexer configuration from YAML file
 * Model and dimensions are derived from embeddings configuration
 */
export async function loadDocIndexerConfig(configPath?: string): Promise<IndexerConfig> {
	const config = loadConfig(configPath);
	const riff = config['hr-policy'];
	const embeddingConfig = buildEmbeddingConfig(configPath);

	return {
		logging: config.logging,
		model: embeddingConfig.model,
		dimensions: embeddingConfig.dimensions,
		maxEmbedChars: riff.embeddings.maxChars,
		sections: riff.indexer.sections,
		weightResponse: riff.indexer.weightResponse,
		useFts: riff.indexer.useFts,
		hybrid: riff.indexer.hybrid,
		alpha: riff.indexer.alpha,
		pathWeight: riff.indexer.pathWeight,
		showMetadata: riff.indexer.showMetadata,
		highlight: riff.indexer.highlight,
		snippetContextLines: riff.indexer.snippetContextLines,
		maxSnippetLength: riff.indexer.maxSnippetLength,
	};
}

// =============================================================================
// DECOMPOSER CONFIG
// =============================================================================

/**
 * Default decomposer config
 */
export const DEFAULT_DECOMPOSER_CONFIG: DecomposerConfig = {
	primaryPattern: '^## .+',
	fallbackPattern: '^### .+',
	inputDirectory: 'sources/cello/hr-policies/',
	outputDirectory: '.aria/exports/cello/hr-policies/',
	filePatterns: ['*.md', '**/*.md'],
};

/**
 * Load decomposer configuration from YAML file with env overrides
 */
export async function loadDecomposerConfig(configPath?: string): Promise<DecomposerConfig> {
	const config = loadConfig(configPath);
	const riff = config['hr-policy'];

	// Environment variable overrides
	const primaryPattern = process.env['HR_POLICY_PRIMARY_PATTERN'] ?? riff.decomposer.primaryPattern;
	const fallbackPattern = process.env['HR_POLICY_FALLBACK_PATTERN'] ?? riff.decomposer.fallbackPattern;
	const inputDirectory = process.env['HR_POLICY_INPUT_DIR'] ?? riff.paths.input.policies;
	const outputDirectory = process.env['HR_POLICY_OUTPUT_DIR'] ?? riff.paths.output.sections;
	const filePatterns = process.env['HR_POLICY_FILE_PATTERNS']
		? process.env['HR_POLICY_FILE_PATTERNS'].split(',').map(p => p.trim())
		: riff.decomposer.filePatterns;

	return {
		primaryPattern,
		fallbackPattern,
		inputDirectory,
		outputDirectory,
		filePatterns,
	};
}

// =============================================================================
// EMBEDDING CONFIG
// =============================================================================

/**
 * Build embedding configuration from config and env vars
 */
export function buildEmbeddingConfig(configPath?: string): UnifiedEmbeddingConfig {
	const provider = process.env['HR_POLICY_EMBEDDINGS_PROVIDER']?.toLowerCase() || loadEmbeddingsProvider(configPath);

	if (provider === 'openai') {
		return buildOpenAIEmbeddingConfig(configPath);
	} else if (provider === 'gemini') {
		return buildGeminiEmbeddingConfig(configPath);
	} else if (provider === 'ollama') {
		return buildOllamaEmbeddingConfig(configPath);
	}

	throw new ConfigError(`Unknown or unsupported embedding provider: ${provider}`);
}

function loadEmbeddingsProvider(configPath?: string): string {
	try {
		const config = loadConfig(configPath);
		return config['hr-policy'].embeddings.provider;
	} catch {
		return 'openai';
	}
}

function buildOpenAIEmbeddingConfig(configPath?: string): UnifiedEmbeddingConfig {
	try {
		const config = loadConfig(configPath);
		const openaiConfig = config['hr-policy'].embeddings.openai;

		return {
			provider: 'openai',
			api_key: openaiConfig.apiKey || process.env['OPENAI_API_KEY'] || '',
			model: openaiConfig.model || process.env['HR_POLICY_OPENAI_EMBEDDING_MODEL'] || 'text-embedding-3-large',
			dimensions:
				openaiConfig.dimensions || parseInt(process.env['HR_POLICY_OPENAI_EMBEDDING_DIMENSIONS'] || '3072', 10),
			timeout: openaiConfig.timeout || parseInt(process.env['HR_POLICY_OPENAI_TIMEOUT'] || '30', 10),
			base_url: openaiConfig.baseUrl || undefined,
		};
	} catch {
		return {
			provider: 'openai',
			api_key: process.env['OPENAI_API_KEY'] || '',
			model: 'text-embedding-3-large',
			dimensions: 3072,
			timeout: 30,
			base_url: undefined,
		};
	}
}

function buildGeminiEmbeddingConfig(configPath?: string): UnifiedEmbeddingConfig {
	try {
		const config = loadConfig(configPath);
		const geminiConfig = config['hr-policy'].embeddings.gemini;

		return {
			provider: 'gemini',
			api_key: geminiConfig.apiKey || process.env['GOOGLE_API_KEY'] || '',
			model: geminiConfig.model || process.env['HR_POLICY_GOOGLE_EMBEDDING_MODEL'] || 'gemini-embedding-2',
			dimensions:
				geminiConfig.dimensions || parseInt(process.env['HR_POLICY_GOOGLE_EMBEDDING_DIMENSIONS'] || '768', 10),
			timeout: geminiConfig.timeout || parseInt(process.env['HR_POLICY_GOOGLE_TIMEOUT'] || '30', 10),
			base_url: geminiConfig.baseUrl || 'https://generativelanguage.googleapis.com/v1',
		};
	} catch {
		return {
			provider: 'gemini',
			api_key: process.env['GOOGLE_API_KEY'] || '',
			model: 'gemini-embedding-2',
			dimensions: 768,
			timeout: 30,
			base_url: 'https://generativelanguage.googleapis.com/v1',
		};
	}
}

function buildOllamaEmbeddingConfig(configPath?: string): UnifiedEmbeddingConfig {
	try {
		const config = loadConfig(configPath);
		const ollamaConfig = config['hr-policy'].embeddings.ollama;

		return {
			provider: 'ollama',
			endpoint: ollamaConfig.endpoint || process.env['HR_POLICY_OLLAMA_ENDPOINT'] || 'http://localhost:11434',
			model: ollamaConfig.model || process.env['HR_POLICY_OLLAMA_EMBEDDING_MODEL'] || 'embeddinggemma:latest',
			dimensions:
				ollamaConfig.dimensions || parseInt(process.env['HR_POLICY_OLLAMA_EMBEDDING_DIMENSIONS'] || '768', 10),
			timeout: ollamaConfig.timeout || parseInt(process.env['HR_POLICY_OLLAMA_TIMEOUT'] || '60', 10),
			keep_alive:
				ollamaConfig.keepAlive || parseInt(process.env['HR_POLICY_OLLAMA_KEEP_ALIVE'] || '0', 10) || undefined,
		};
	} catch {
		return {
			provider: 'ollama',
			endpoint: process.env['HR_POLICY_OLLAMA_ENDPOINT'] || 'http://localhost:11434',
			model: 'embeddinggemma:latest',
			dimensions: 768,
			timeout: 60,
			keep_alive: undefined,
		};
	}
}
