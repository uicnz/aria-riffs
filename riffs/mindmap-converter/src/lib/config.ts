/**
 * Configuration management for mindmap-converter
 *
 * Three-tier configuration system:
 * 1. Defaults (in Zod schema) - lowest priority
 * 2. YAML config file - overrides defaults
 * 3. Environment variables - highest priority
 */

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import yaml from 'yaml';
import { loadDotEnv } from './load-dotenv.js';
import { type MindmapConverterConfig, MindmapConverterConfigSchema } from './schema.js';
import type { MarkdownOptions } from './types.js';

// Re-export types for convenience
export type { MindmapConverterConfig } from './schema.js';

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

/**
 * Default Markdown conversion options
 */
export const DEFAULT_MARKDOWN_OPTIONS: MarkdownOptions = {
	maxHeadingLevel: 6,
	useBulletPoints: true,
	preserveHierarchy: true,
};

/**
 * Supported file extensions and their formats
 */
export const FILE_EXTENSIONS = {
	opml: ['.opml'],
	mm: ['.mm'],
} as const;

/**
 * XML parser options for fast-xml-parser
 */
export const XML_PARSER_OPTIONS = {
	ignoreAttributes: false,
	attributeNamePrefix: '',
	textNodeName: '#text',
	parseAttributeValue: false,
	trimValues: true,
} as const;

/**
 * Output file extension
 */
export const OUTPUT_EXTENSION = '.md';

/**
 * Riff metadata
 */
export const RIFF_INFO = {
	name: 'mindmap-converter',
	version: '1.0.0',
	description: 'Convert OPML and FreeMind mindmap files to Markdown',
} as const;

// =============================================================================
// ENVIRONMENT OVERRIDES
// =============================================================================

function applyEnvOverrides(config: MindmapConverterConfig): MindmapConverterConfig {
	const riff = config['mindmap-converter'];

	// Conversion overrides
	if (process.env['MINDMAP_CONVERTER_DEFAULT_FORMAT']) {
		const format = process.env['MINDMAP_CONVERTER_DEFAULT_FORMAT'];
		const validFormats = [
			'headers',
			'bullets',
			'numbered',
			'mixed',
			'outline',
			'tasks',
			'tree',
			'mermaid-mindmap',
			'mermaid-flowchart',
		];
		if (validFormats.includes(format)) {
			riff.conversion.defaultFormat = format as typeof riff.conversion.defaultFormat;
		}
	}

	if (process.env['MINDMAP_CONVERTER_MAX_HEADING_LEVEL']) {
		const level = parseInt(process.env['MINDMAP_CONVERTER_MAX_HEADING_LEVEL'], 10);
		if (level >= 1 && level <= 6) {
			riff.conversion.maxHeadingLevel = level;
		}
	}

	if (process.env['MINDMAP_CONVERTER_USE_BULLET_POINTS'] !== undefined) {
		riff.conversion.useBulletPoints = process.env['MINDMAP_CONVERTER_USE_BULLET_POINTS'] === 'true';
	}

	if (process.env['MINDMAP_CONVERTER_PRESERVE_HIERARCHY'] !== undefined) {
		riff.conversion.preserveHierarchy = process.env['MINDMAP_CONVERTER_PRESERVE_HIERARCHY'] === 'true';
	}

	// Output overrides
	if (process.env['MINDMAP_CONVERTER_FILE_EXTENSION']) {
		riff.output.fileExtension = process.env['MINDMAP_CONVERTER_FILE_EXTENSION'];
	}

	if (process.env['MINDMAP_CONVERTER_OVERWRITE_EXISTING'] !== undefined) {
		riff.output.overwriteExisting = process.env['MINDMAP_CONVERTER_OVERWRITE_EXISTING'] === 'true';
	}

	if (process.env['MINDMAP_CONVERTER_AUTO_DETECT'] !== undefined) {
		riff.output.autoDetectFormat = process.env['MINDMAP_CONVERTER_AUTO_DETECT'] === 'true';
	}

	// Validation overrides
	if (process.env['MINDMAP_CONVERTER_STRICT_MODE'] !== undefined) {
		riff.validation.strictMode = process.env['MINDMAP_CONVERTER_STRICT_MODE'] === 'true';
	}

	if (process.env['MINDMAP_CONVERTER_REQUIRE_TITLE'] !== undefined) {
		riff.validation.requireTitle = process.env['MINDMAP_CONVERTER_REQUIRE_TITLE'] === 'true';
	}

	// Logging overrides
	if (process.env['MINDMAP_CONVERTER_LOG_LEVEL']) {
		const level = process.env['MINDMAP_CONVERTER_LOG_LEVEL'].toLowerCase();
		if (['trace', 'debug', 'info', 'warn', 'error', 'fatal'].includes(level)) {
			config.logging.level = level as typeof config.logging.level;
		}
	}

	if (process.env['MINDMAP_CONVERTER_VERBOSE'] !== undefined) {
		config.logging.verbose = process.env['MINDMAP_CONVERTER_VERBOSE'] === 'true';
	}

	if (process.env['MINDMAP_CONVERTER_LOG_FILE']) {
		config.logging.file = process.env['MINDMAP_CONVERTER_LOG_FILE'];
	}

	if (process.env['MINDMAP_CONVERTER_MAX_FILE_SIZE']) {
		config.logging.maxFileSizeMb = parseInt(process.env['MINDMAP_CONVERTER_MAX_FILE_SIZE'], 10);
	}

	if (process.env['MINDMAP_CONVERTER_MAX_FILES']) {
		config.logging.maxFiles = parseInt(process.env['MINDMAP_CONVERTER_MAX_FILES'], 10);
	}

	// Database overrides
	if (process.env['MINDMAP_CONVERTER_DB_PATH']) {
		riff.paths.database.file = process.env['MINDMAP_CONVERTER_DB_PATH'];
	}

	if (process.env['MINDMAP_CONVERTER_DB_TABLE']) {
		riff.database.tableName = process.env['MINDMAP_CONVERTER_DB_TABLE'];
	}

	if (process.env['MINDMAP_CONVERTER_DB_JOURNAL_MODE']) {
		const mode = process.env['MINDMAP_CONVERTER_DB_JOURNAL_MODE'].toUpperCase();
		if (['DELETE', 'WAL', 'TRUNCATE', 'PERSIST', 'MEMORY', 'OFF'].includes(mode)) {
			riff.database.journalMode = mode as typeof riff.database.journalMode;
		}
	}

	// Batch processing overrides
	if (process.env['MINDMAP_CONVERTER_BATCH_DEFAULT_DIR']) {
		riff.paths.input.dir = process.env['MINDMAP_CONVERTER_BATCH_DEFAULT_DIR'];
	}

	if (process.env['MINDMAP_CONVERTER_BATCH_OUTPUT_DIR']) {
		riff.paths.output.dir = process.env['MINDMAP_CONVERTER_BATCH_OUTPUT_DIR'];
	}

	if (process.env['MINDMAP_CONVERTER_BATCH_SIZE']) {
		riff.batch.batchSize = parseInt(process.env['MINDMAP_CONVERTER_BATCH_SIZE'], 10);
	}

	if (process.env['MINDMAP_CONVERTER_SAVE_INTERVAL']) {
		riff.batch.saveInterval = parseInt(process.env['MINDMAP_CONVERTER_SAVE_INTERVAL'], 10);
	}

	if (process.env['MINDMAP_CONVERTER_PRESERVE_STRUCTURE'] !== undefined) {
		riff.batch.preserveStructure = process.env['MINDMAP_CONVERTER_PRESERVE_STRUCTURE'] === 'true';
	}

	// JSONL export overrides
	if (process.env['MINDMAP_CONVERTER_JSONL_FILE']) {
		riff.paths.output.master = process.env['MINDMAP_CONVERTER_JSONL_FILE'];
	}

	if (process.env['MINDMAP_CONVERTER_JSONL_APPEND'] !== undefined) {
		riff.jsonl.appendMode = process.env['MINDMAP_CONVERTER_JSONL_APPEND'] === 'true';
	}

	return config;
}

// =============================================================================
// LOADER - Tiered config: Defaults -> YAML -> Env vars
// =============================================================================

/**
 * Load and validate configuration from YAML file
 *
 * Three-tier priority:
 * 1. Defaults from Zod schema
 * 2. YAML config file overrides
 * 3. Environment variable overrides
 */
export function loadConfig(configPath?: string): MindmapConverterConfig {
	loadDotEnv();
	const defaultPath = resolve(getRiffRoot(), 'config.yaml');
	const finalPath = configPath ?? defaultPath;
	const explicitPathProvided = configPath !== undefined;

	let config: MindmapConverterConfig;

	if (!existsSync(finalPath)) {
		if (explicitPathProvided) {
			throw new ConfigError(`Config file not found: ${finalPath}`);
		}
		// No config file - use defaults only
		config = MindmapConverterConfigSchema.parse({});
	} else {
		try {
			const fileContents = readFileSync(finalPath, 'utf8');
			const loadedConfig = yaml.parse(fileContents);

			// Validate and merge with defaults using Zod
			config = MindmapConverterConfigSchema.parse(loadedConfig);
		} catch (error) {
			if (error instanceof Error && error.name === 'ZodError') {
				throw new ConfigError(`Invalid config file: ${error.message}`);
			}
			throw new ConfigError(`Failed to load config: ${error}`);
		}
	}

	// Apply environment variable overrides
	config = expandTildePaths(config);
	return applyEnvOverrides(config);
}

// =============================================================================
// CONFIG PATH EXPORT
// =============================================================================

export const configPath = resolve(getRiffRoot(), 'config.yaml');
