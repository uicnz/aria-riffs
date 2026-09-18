import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { parse as yamlParse } from 'yaml';
import { loadDotEnv } from './load-dotenv.js';
import {
	type DocConverterConfig,
	DocConverterConfigSchema,
	DocConverterRiffSchema,
	type LoggingConfig,
} from './schema.js';
import type { ProcessOptions } from './types.js';

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
// DEFAULTS
// =============================================================================

const RIFF_DEFAULTS = DocConverterRiffSchema.parse({});

export const DEFAULTS: ProcessOptions = {
	type: RIFF_DEFAULTS.type,
	cleanFirst: RIFF_DEFAULTS.cleanFirst,
	lint: false,
	lintFix: false,
	lintConfigPath: null,
	configPath: null,
	inPlace: RIFF_DEFAULTS.inPlace,
	dirsRecurse: RIFF_DEFAULTS.dirsRecurse,
	dirsPreserve: RIFF_DEFAULTS.dirsPreserve,
	dirsSanitize: RIFF_DEFAULTS.dirsSanitize,
	gitkeep: RIFF_DEFAULTS.gitkeep,
};

export function buildOptions(partial: Partial<ProcessOptions>): ProcessOptions {
	return {
		type: partial.type ?? DEFAULTS.type,
		cleanFirst: partial.cleanFirst ?? DEFAULTS.cleanFirst,
		lint: partial.lint ?? DEFAULTS.lint,
		lintFix: partial.lintFix ?? DEFAULTS.lintFix,
		lintConfigPath: partial.lintConfigPath ?? DEFAULTS.lintConfigPath,
		configPath: partial.configPath ?? DEFAULTS.configPath,
		inPlace: partial.inPlace ?? DEFAULTS.inPlace,
		dirsRecurse: partial.dirsRecurse ?? DEFAULTS.dirsRecurse,
		dirsPreserve: partial.dirsPreserve ?? DEFAULTS.dirsPreserve,
		dirsSanitize: partial.dirsSanitize ?? DEFAULTS.dirsSanitize,
		gitkeep: partial.gitkeep ?? DEFAULTS.gitkeep,
	};
}

// =============================================================================
// ENVIRONMENT OVERRIDES
// =============================================================================

function applyEnvOverrides(config: DocConverterConfig): DocConverterConfig {
	const riff = config['doc-converter'];

	const envType = process.env['DOC_CONVERTER_TYPE']?.toLowerCase();
	if (envType === 'docx' || envType === 'pptx' || envType === 'xlsx' || envType === 'auto') {
		riff.type = envType;
	}

	if (process.env['DOC_CONVERTER_INPUT_DIRECTORY']) {
		riff.paths.input.dir = process.env['DOC_CONVERTER_INPUT_DIRECTORY'];
	}
	if (process.env['DOC_CONVERTER_OUTPUT_DIRECTORY']) {
		riff.paths.output.dir = process.env['DOC_CONVERTER_OUTPUT_DIRECTORY'];
	}
	if (process.env['DOC_CONVERTER_CLEAN_FIRST']) {
		riff.cleanFirst = process.env['DOC_CONVERTER_CLEAN_FIRST'] === 'true';
	}
	if (process.env['DOC_CONVERTER_IN_PLACE']) {
		riff.inPlace = process.env['DOC_CONVERTER_IN_PLACE'] === 'true';
	}
	if (process.env['DOC_CONVERTER_DIRS_RECURSE']) {
		riff.dirsRecurse = process.env['DOC_CONVERTER_DIRS_RECURSE'] === 'true';
	}
	if (process.env['DOC_CONVERTER_DIRS_PRESERVE']) {
		riff.dirsPreserve = process.env['DOC_CONVERTER_DIRS_PRESERVE'] === 'true';
	}
	if (process.env['DOC_CONVERTER_DIRS_SANITIZE']) {
		riff.dirsSanitize = process.env['DOC_CONVERTER_DIRS_SANITIZE'] === 'true';
	}
	if (process.env['DOC_CONVERTER_GITKEEP']) {
		riff.gitkeep = process.env['DOC_CONVERTER_GITKEEP'] === 'true';
	}

	if (process.env['DOC_CONVERTER_MARKDOWNLINT_ENABLED']) {
		config.markdownlint.enabled = process.env['DOC_CONVERTER_MARKDOWNLINT_ENABLED'] === 'true';
	}
	if (process.env['DOC_CONVERTER_MARKDOWNLINT_FIX']) {
		config.markdownlint.fix = process.env['DOC_CONVERTER_MARKDOWNLINT_FIX'] === 'true';
	}
	if (process.env['DOC_CONVERTER_MARKDOWNLINT_CONFIG_PATH']) {
		config.markdownlint.configPath = process.env['DOC_CONVERTER_MARKDOWNLINT_CONFIG_PATH'];
	}

	if (process.env['DOC_CONVERTER_ARIA_ENABLED']) {
		config.ariaRules.enabled = process.env['DOC_CONVERTER_ARIA_ENABLED'] === 'true';
	}
	if (process.env['DOC_CONVERTER_MARKDOWNLINT_RULES_ENABLED']) {
		config.markdownlintRules.enabled = process.env['DOC_CONVERTER_MARKDOWNLINT_RULES_ENABLED'] === 'true';
	}

	if (process.env['DOC_CONVERTER_LOG_LEVEL']) {
		config.logging.level = process.env['DOC_CONVERTER_LOG_LEVEL'] as LoggingConfig['level'];
	}
	if (process.env['DOC_CONVERTER_LOG_VERBOSE']) {
		config.logging.verbose = process.env['DOC_CONVERTER_LOG_VERBOSE'] === 'true';
	}
	if (process.env['DOC_CONVERTER_LOG_FILE']) {
		config.logging.file = process.env['DOC_CONVERTER_LOG_FILE'];
	}
	if (process.env['DOC_CONVERTER_LOG_MAX_FILE_SIZE_MB']) {
		const maxFileSizeMb = Number.parseInt(process.env['DOC_CONVERTER_LOG_MAX_FILE_SIZE_MB'], 10);
		if (!Number.isNaN(maxFileSizeMb)) {
			config.logging.maxFileSizeMb = maxFileSizeMb;
		}
	}
	if (process.env['DOC_CONVERTER_LOG_MAX_FILES']) {
		const maxFiles = Number.parseInt(process.env['DOC_CONVERTER_LOG_MAX_FILES'], 10);
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
 * 2. YAML config file overrides (co-located at config.yaml in riff directory)
 * 3. Environment variable overrides
 */
export function loadConfig(configPath?: string): DocConverterConfig {
	loadDotEnv();
	const defaultPath = resolve(getRiffRoot(), 'config.yaml');
	const finalPath = configPath ?? defaultPath;
	const explicitPathProvided = configPath !== undefined;

	let config: DocConverterConfig;

	if (!existsSync(finalPath)) {
		if (explicitPathProvided) {
			throw new ConfigError(`Config file not found: ${finalPath}`);
		}
		config = DocConverterConfigSchema.parse({});
	} else {
		try {
			const fileContent = readFileSync(finalPath, 'utf8');
			const rawConfig = yamlParse(fileContent) || {};
			config = DocConverterConfigSchema.parse(rawConfig);
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
