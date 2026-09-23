/**
 * Zod schema definitions for mindmap-converter configuration
 *
 * This is the SINGLE SOURCE OF TRUTH for config structure and defaults.
 * All config types are inferred from these schemas.
 */

import { z } from 'zod';

const AriaRiffMetadataSchema = z
	.object({
		name: z.literal('mindmap-converter'),
		description: z.string().min(1),
		category: z.enum(['documents', 'images', 'knowledge', 'development', 'utilities']),
	})
	.strict();

// =============================================================================
// PATH SCHEMAS
// =============================================================================

const PathInputSchema = z.object({
	dir: z.string().default('sources/mindmaps'),
});

const PathOutputSchema = z.object({
	dir: z.string().default('.aria/exports/mindmap'),
	master: z.string().default('.aria/exports/mindmap/mindmaps.jsonl'),
});

const PathDatabaseSchema = z.object({
	file: z.string().default('.aria/db/mindmap-converter/mindmap-converter.sqlite'),
});

const PathsSchema = z.object({
	input: PathInputSchema.default(PathInputSchema.parse({})),
	output: PathOutputSchema.default(PathOutputSchema.parse({})),
	database: PathDatabaseSchema.default(PathDatabaseSchema.parse({})),
});

// =============================================================================
// NESTED SCHEMAS
// =============================================================================

export const ConversionConfigSchema = z.object({
	defaultFormat: z
		.enum([
			'headers',
			'bullets',
			'numbered',
			'legal',
			'mixed',
			'outline',
			'tasks',
			'tree',
			'mermaid-mindmap',
			'mermaid-flowchart',
		])
		.default('headers'),
	maxHeadingLevel: z.number().min(1).max(6).default(6),
	useBulletPoints: z.boolean().default(true),
	preserveHierarchy: z.boolean().default(true),
});

export const OutputConfigSchema = z.object({
	fileExtension: z.string().default('.md'),
	overwriteExisting: z.boolean().default(false),
	autoDetectFormat: z.boolean().default(true),
});

export const ValidationConfigSchema = z.object({
	strictMode: z.boolean().default(false),
	requireTitle: z.boolean().default(false),
});

export const LoggingConfigSchema = z.object({
	level: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
	verbose: z.boolean().default(false),
	file: z.string().default('.aria/logs/mindmap-converter.log'),
	maxFileSizeMb: z.number().default(10),
	maxFiles: z.number().default(7),
});

export const DatabaseConfigSchema = z.object({
	tableName: z.string().default('mindmaps'),
	journalMode: z.enum(['DELETE', 'WAL', 'TRUNCATE', 'PERSIST', 'MEMORY', 'OFF']).default('WAL'),
});

export const BatchConfigSchema = z.object({
	batchSize: z.number().default(50),
	saveInterval: z.number().default(10),
	preserveStructure: z.boolean().default(true),
});

export const JsonlConfigSchema = z.object({
	appendMode: z.boolean().default(true),
});

// =============================================================================
// RIFF-SPECIFIC SCHEMA (nested under mindmap-converter: in YAML)
// =============================================================================

export const MindmapConverterRiffSchema = z.object({
	paths: PathsSchema.default(PathsSchema.parse({})),
	conversion: ConversionConfigSchema.default({
		defaultFormat: 'headers',
		maxHeadingLevel: 6,
		useBulletPoints: true,
		preserveHierarchy: true,
	}),
	output: OutputConfigSchema.default({
		fileExtension: '.md',
		overwriteExisting: false,
		autoDetectFormat: true,
	}),
	validation: ValidationConfigSchema.default({
		strictMode: false,
		requireTitle: false,
	}),
	database: DatabaseConfigSchema.default({
		tableName: 'mindmaps',
		journalMode: 'WAL',
	}),
	batch: BatchConfigSchema.default({
		batchSize: 50,
		saveInterval: 10,
		preserveStructure: true,
	}),
	jsonl: JsonlConfigSchema.default({
		appendMode: true,
	}),
});

// =============================================================================
// ROOT SCHEMA (matches YAML structure with riff wrapper)
// =============================================================================

export const MindmapConverterConfigSchema = z
	.object({
		'aria-riff': AriaRiffMetadataSchema.optional(),
		'mindmap-converter': MindmapConverterRiffSchema.default(MindmapConverterRiffSchema.parse({})),
		logging: LoggingConfigSchema.default(LoggingConfigSchema.parse({})),
	})
	.strict();

// =============================================================================
// TYPES - Inferred from Zod (single source of truth)
// =============================================================================

export type ConversionConfig = z.infer<typeof ConversionConfigSchema>;
export type OutputConfig = z.infer<typeof OutputConfigSchema>;
export type ValidationConfig = z.infer<typeof ValidationConfigSchema>;
export type LoggingConfig = z.infer<typeof LoggingConfigSchema>;
export type DatabaseConfig = z.infer<typeof DatabaseConfigSchema>;
export type BatchConfig = z.infer<typeof BatchConfigSchema>;
export type JsonlConfig = z.infer<typeof JsonlConfigSchema>;
export type MindmapConverterRiffConfig = z.infer<typeof MindmapConverterRiffSchema>;
export type MindmapConverterConfig = z.infer<typeof MindmapConverterConfigSchema>;
