/**
 * Zod schema definitions for dir-differ configuration
 *
 * This is the SINGLE SOURCE OF TRUTH for config structure and defaults.
 * All config types are inferred from these schemas.
 */

import { z } from 'zod';

const AriaRiffMetadataSchema = z
	.object({
		name: z.literal('dir-differ'),
		description: z.string().min(1),
		category: z.enum(['documents', 'images', 'knowledge', 'development', 'utilities']),
	})
	.strict();

// =============================================================================
// NESTED SCHEMAS
// =============================================================================

const PathInputSchema = z.object({
	source: z.string().nullable().default(null),
	target: z.string().nullable().default(null),
});

const PathsConfigSchema = z.object({
	input: PathInputSchema.default(PathInputSchema.parse({})),
});

const ProcessingConfigSchema = z.object({
	showContent: z.boolean().default(false),
	summaryOnly: z.boolean().default(false),
});

export const LoggingConfigSchema = z.object({
	level: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
	verbose: z.boolean().default(false),
	file: z.string().default('.aria/logs/dir-differ.log'),
	maxFileSizeMb: z.number().default(10),
	maxFiles: z.number().default(7),
});

// =============================================================================
// RIFF-SPECIFIC SCHEMA (nested under dir-differ: in YAML)
// =============================================================================

export const DirDifferRiffSchema = z.object({
	paths: PathsConfigSchema.default(PathsConfigSchema.parse({})),
	processing: ProcessingConfigSchema.default(ProcessingConfigSchema.parse({})),
});

// =============================================================================
// ROOT SCHEMA (matches YAML structure with riff wrapper)
// =============================================================================

export const DirDifferConfigSchema = z
	.object({
		'aria-riff': AriaRiffMetadataSchema.optional(),
		'dir-differ': DirDifferRiffSchema.default(DirDifferRiffSchema.parse({})),
		logging: LoggingConfigSchema.default(LoggingConfigSchema.parse({})),
	})
	.strict();

// =============================================================================
// TYPES - Inferred from Zod (single source of truth)
// =============================================================================

export type LoggingConfig = z.infer<typeof LoggingConfigSchema>;
export type DirDifferRiffConfig = z.infer<typeof DirDifferRiffSchema>;
export type DirDifferConfig = z.infer<typeof DirDifferConfigSchema>;
export type PathsConfig = z.infer<typeof PathsConfigSchema>;
export type ProcessingConfig = z.infer<typeof ProcessingConfigSchema>;
