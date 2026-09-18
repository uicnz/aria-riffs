/**
 * Configuration management for doc-indexer riff
 * 3-tier config: Defaults (Zod) -> YAML file -> Environment variables
 */

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { parse as yamlParse } from 'yaml';
import { loadDotEnv } from './load-dotenv.js';
import { type DocIndexerConfig, DocIndexerConfigSchema, type LoggingConfig } from './schema.js';

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

function applyEnvOverrides(config: DocIndexerConfig): DocIndexerConfig {
	const riff = config['doc-indexer'];

	if (process.env['DOC_INDEXER_DATABASE_PATH']) {
		riff.paths.database.file = process.env['DOC_INDEXER_DATABASE_PATH'];
	}
	if (process.env['DOC_INDEXER_OUTPUT_DIRECTORY']) {
		riff.paths.output.dir = process.env['DOC_INDEXER_OUTPUT_DIRECTORY'];
	}
	if (process.env['DOC_INDEXER_GRAPH_FILE']) {
		riff.paths.template.graph = process.env['DOC_INDEXER_GRAPH_FILE'];
	}
	if (process.env['DOC_INDEXER_DOCUMENTS_FILE']) {
		riff.paths.template.documents = process.env['DOC_INDEXER_DOCUMENTS_FILE'];
	}
	if (process.env['DOC_INDEXER_VIEWER_FILE']) {
		riff.paths.template.viewer = process.env['DOC_INDEXER_VIEWER_FILE'];
	}
	if (process.env['DOC_INDEXER_DEFAULT_INDEX_DIRECTORY']) {
		riff.paths.input.documents = process.env['DOC_INDEXER_DEFAULT_INDEX_DIRECTORY'];
	}
	if (process.env['DOC_INDEXER_FULL_RFP_PATH']) {
		riff.paths.input.fullRfp = process.env['DOC_INDEXER_FULL_RFP_PATH'];
	}

	if (process.env['DOC_INDEXER_MODEL']) {
		riff.model = process.env['DOC_INDEXER_MODEL'];
	}
	if (process.env['DOC_INDEXER_DIMENSIONS']) {
		const dimensions = parseInt(process.env['DOC_INDEXER_DIMENSIONS'], 10);
		if (!Number.isNaN(dimensions)) {
			riff.dimensions = dimensions;
		}
	}
	if (process.env['DOC_INDEXER_MAX_EMBED_CHARS']) {
		const maxEmbedChars = parseInt(process.env['DOC_INDEXER_MAX_EMBED_CHARS'], 10);
		if (!Number.isNaN(maxEmbedChars)) {
			riff.maxEmbedChars = maxEmbedChars;
		}
	}
	if (process.env['DOC_INDEXER_SECTIONS']) {
		const sections = process.env['DOC_INDEXER_SECTIONS'];
		if (sections === 'response' || sections === 'request' || sections === 'both' || sections === 'full') {
			riff.sections = sections;
		}
	}
	if (process.env['DOC_INDEXER_WEIGHT_RESPONSE']) {
		const weightResponse = parseFloat(process.env['DOC_INDEXER_WEIGHT_RESPONSE']);
		if (!Number.isNaN(weightResponse)) {
			riff.weightResponse = weightResponse;
		}
	}
	if (process.env['DOC_INDEXER_USE_FTS']) {
		riff.useFts = process.env['DOC_INDEXER_USE_FTS'] === 'true';
	}
	if (process.env['DOC_INDEXER_HYBRID']) {
		riff.hybrid = process.env['DOC_INDEXER_HYBRID'] === 'true';
	}
	if (process.env['DOC_INDEXER_ALPHA']) {
		const alpha = parseFloat(process.env['DOC_INDEXER_ALPHA']);
		if (!Number.isNaN(alpha)) {
			riff.alpha = alpha;
		}
	}
	if (process.env['DOC_INDEXER_SHOW_METADATA']) {
		riff.showMetadata = process.env['DOC_INDEXER_SHOW_METADATA'] === 'true';
	}
	if (process.env['DOC_INDEXER_HIGHLIGHT']) {
		riff.highlight = process.env['DOC_INDEXER_HIGHLIGHT'] === 'true';
	}
	if (process.env['DOC_INDEXER_HIGHLIGHT_COLOR']) {
		riff.highlightColor = process.env['DOC_INDEXER_HIGHLIGHT_COLOR'];
	}
	if (process.env['DOC_INDEXER_THEME']) {
		riff.tui.theme = process.env['DOC_INDEXER_THEME'];
	}

	if (process.env['DOC_INDEXER_LOG_LEVEL']) {
		config.logging.level = process.env['DOC_INDEXER_LOG_LEVEL'] as LoggingConfig['level'];
	}
	if (process.env['DOC_INDEXER_LOG_VERBOSE']) {
		config.logging.verbose = process.env['DOC_INDEXER_LOG_VERBOSE'] === 'true';
	}
	if (process.env['DOC_INDEXER_LOG_FILE']) {
		config.logging.file = process.env['DOC_INDEXER_LOG_FILE'];
	}
	if (process.env['DOC_INDEXER_LOG_MAX_FILE_SIZE_MB']) {
		const maxFileSizeMb = parseInt(process.env['DOC_INDEXER_LOG_MAX_FILE_SIZE_MB'], 10);
		if (!Number.isNaN(maxFileSizeMb)) {
			config.logging.maxFileSizeMb = maxFileSizeMb;
		}
	}
	if (process.env['DOC_INDEXER_LOG_MAX_FILES']) {
		const maxFiles = parseInt(process.env['DOC_INDEXER_LOG_MAX_FILES'], 10);
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
export function loadConfig(configPath?: string): DocIndexerConfig {
	loadDotEnv();
	const defaultPath = resolve(getRiffRoot(), 'config.yaml');
	const finalPath = configPath ?? defaultPath;
	const explicitPathProvided = configPath !== undefined;

	let config: DocIndexerConfig;

	if (!existsSync(finalPath)) {
		if (explicitPathProvided) {
			throw new ConfigError(`Config file not found: ${finalPath}`);
		}
		config = DocIndexerConfigSchema.parse({});
	} else {
		try {
			const fileContent = readFileSync(finalPath, 'utf8');
			const rawConfig = yamlParse(fileContent) || {};
			config = DocIndexerConfigSchema.parse(rawConfig);
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
