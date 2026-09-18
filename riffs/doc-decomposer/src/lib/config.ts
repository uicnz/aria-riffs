/**
 * Configuration management for doc-decomposer riff
 * 3-tier config: Defaults (Zod) -> YAML file -> Environment variables
 */

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { parse as yamlParse } from 'yaml';
import { loadDotEnv } from './load-dotenv.js';
import {
	type DocDecomposerConfig,
	DocDecomposerConfigSchema,
	type LoggingConfig,
	type RegexPatterns,
} from './schema.js';

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
// STATIC CONSTANTS (not configurable)
// =============================================================================

/**
 * Directory names that typically contain assets
 */
export const ASSET_DIRECTORY_NAMES = ['images', 'assets', 'media', 'img', 'docs', 'diagrams'] as const;

/**
 * Mapping of file extensions to MIME types
 */
export const MIME_TYPES: Record<string, string> = {
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.gif': 'image/gif',
	'.svg': 'image/svg+xml',
	'.pdf': 'application/pdf',
	'.doc': 'application/msword',
	'.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	'.xls': 'application/vnd.ms-excel',
	'.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	'.ppt': 'application/vnd.ms-powerpoint',
	'.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
	'.vsdx': 'application/vnd.visio',
	'.vsd': 'application/vnd.visio',
	'.zip': 'application/zip',
	'.md': 'text/markdown',
	'.txt': 'text/plain',
} as const;

// =============================================================================
// ENVIRONMENT OVERRIDES
// =============================================================================

function applyEnvOverrides(config: DocDecomposerConfig): DocDecomposerConfig {
	const riff = config['doc-decomposer'];

	// Logging overrides
	if (process.env['DOC_DECOMPOSER_LOG_LEVEL']) {
		const level = process.env['DOC_DECOMPOSER_LOG_LEVEL'].toLowerCase();
		if (['trace', 'debug', 'info', 'warn', 'error', 'fatal'].includes(level)) {
			config.logging.level = level as LoggingConfig['level'];
		}
	}
	if (process.env['DOC_DECOMPOSER_LOG_VERBOSE']) {
		config.logging.verbose = process.env['DOC_DECOMPOSER_LOG_VERBOSE'] === 'true';
	}
	if (process.env['DOC_DECOMPOSER_LOG_FILE']) {
		config.logging.file = process.env['DOC_DECOMPOSER_LOG_FILE'];
	}
	if (process.env['DOC_DECOMPOSER_LOG_MAX_FILE_SIZE_MB']) {
		const maxFileSizeMb = parseInt(process.env['DOC_DECOMPOSER_LOG_MAX_FILE_SIZE_MB'], 10);
		if (!Number.isNaN(maxFileSizeMb)) {
			config.logging.maxFileSizeMb = maxFileSizeMb;
		}
	}
	if (process.env['DOC_DECOMPOSER_LOG_MAX_FILES']) {
		const maxFiles = parseInt(process.env['DOC_DECOMPOSER_LOG_MAX_FILES'], 10);
		if (!Number.isNaN(maxFiles)) {
			config.logging.maxFiles = maxFiles;
		}
	}

	// Path overrides
	if (process.env['DOC_DECOMPOSER_OUTPUT_DIR']) {
		riff.paths.output.dir = process.env['DOC_DECOMPOSER_OUTPUT_DIR'];
	}
	if (process.env['DOC_DECOMPOSER_DESCRIPTIONS_DIR']) {
		riff.paths.template.descriptions = process.env['DOC_DECOMPOSER_DESCRIPTIONS_DIR'];
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
export function loadConfig(configPath?: string): DocDecomposerConfig {
	loadDotEnv();
	const defaultPath = resolve(getRiffRoot(), 'config.yaml');
	const finalPath = configPath ?? defaultPath;
	const explicitPathProvided = configPath !== undefined;

	let config: DocDecomposerConfig;

	if (!existsSync(finalPath)) {
		if (explicitPathProvided) {
			throw new ConfigError(`Config file not found: ${finalPath}`);
		}
		config = DocDecomposerConfigSchema.parse({});
	} else {
		try {
			const fileContent = readFileSync(finalPath, 'utf8');
			const rawConfig = yamlParse(fileContent) || {};
			config = DocDecomposerConfigSchema.parse(rawConfig);
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
// COMPILE REGEX PATTERNS
// =============================================================================

/**
 * Compile regex patterns from config strings
 * @throws ConfigError if patterns section is missing or invalid
 */
export function compileRegexPatterns(config: DocDecomposerConfig): RegexPatterns {
	const riff = config['doc-decomposer'];

	if (!riff.patterns) {
		throw new ConfigError('Missing patterns configuration. Please ensure config file contains a patterns section.');
	}

	const p = riff.patterns;

	return {
		IMPORTANT_BLOCK: new RegExp(p.importantBlock, p.importantBlockFlags),
		METADATA_SECTION: new RegExp(p.metadataSection, p.metadataSectionFlags),
		HEADING: new RegExp(p.heading, p.headingFlags),
		IMAGE_REF: new RegExp(p.imageRef, p.imageRefFlags),
		PRIORITY: new RegExp(p.priority, p.priorityFlags),
		CATEGORY: new RegExp(p.category, p.categoryFlags),
		DEPARTMENT: new RegExp(p.department, p.departmentFlags),
		LEADER: new RegExp(p.leader, p.leaderFlags),
		CUSTOMISE: new RegExp(p.customise, p.customiseFlags),
	};
}

// =============================================================================
// MODULE-LEVEL CONSTANTS
// =============================================================================

// Load config once at module initialization
const _config = loadConfig();
const _riff = _config['doc-decomposer'];

/**
 * Valid category names (from config)
 */
export const CATEGORIES: string[] = _riff.categories.map(c => c.name);

/**
 * Category descriptions (from config)
 */
export const CATEGORY_DESCRIPTIONS: Record<string, string> = Object.fromEntries(
	_riff.categories.map(c => [c.name, c.description])
);

/**
 * Valid priority names (from config)
 */
export const PRIORITIES: string[] = _riff.priorities.map(p => p.name);

/**
 * Department descriptions (from config)
 */
export const DEPARTMENT_DESCRIPTIONS: Record<string, string> = Object.fromEntries(
	_riff.departments.map(d => [d.name, d.description])
);

/**
 * Regular expressions for parsing (compiled from config)
 */
export const REGEX_PATTERNS: RegexPatterns = _riff.patterns ? compileRegexPatterns(_config) : ({} as RegexPatterns);

/**
 * Configuration paths
 */
export const CONFIG_PATHS = {
	METADATA_FILE: _riff.paths.input.metadata,
	RFP_FILE: _riff.paths.input.rfp,
	OUTPUT_DIR: _riff.paths.output.dir,
	DESCRIPTIONS_DIR: _riff.paths.template.descriptions,
	ASSETS_DIR: _riff.paths.template.assets,
	FULL_RFP_DIR: _riff.paths.template.fullRfp,
} as const;

/**
 * Response templates configuration
 */
export const RESPONSE_TEMPLATES = {
	companyName: _riff.responseTemplates.companyName,
	complianceStatement: _riff.responseTemplates.complianceStatement,
} as const;

// Re-export types from schema
export type {
	CategoryDefinition,
	DocDecomposerConfig,
	LoggingConfig,
	RegexPatterns,
	ResponseTemplatesConfig,
} from './schema.js';
