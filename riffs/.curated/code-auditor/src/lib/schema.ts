/**
 * Zod schema definitions for code-auditor configuration
 *
 * This is the SINGLE SOURCE OF TRUTH for config structure and defaults.
 * All config types are inferred from these schemas.
 */

import { z } from 'zod';

const AriaRiffMetadataSchema = z
	.object({
		name: z.literal('code-auditor'),
		description: z.string().min(1),
		category: z.enum(['documents', 'images', 'knowledge', 'development', 'utilities']),
	})
	.strict();

// =============================================================================
// NESTED SCHEMAS
// =============================================================================

const PathInputSchema = z.object({
	dir: z.string().nullable().default(null),
});

const PathOutputSchema = z.object({
	dir: z.string().nullable().default(null),
});

const PathsConfigSchema = z.object({
	input: PathInputSchema.default(PathInputSchema.parse({})),
	output: PathOutputSchema.default(PathOutputSchema.parse({})),
});

const OutputConfigSchema = z.object({
	jsonOutput: z.boolean().default(false),
});

export const LoggingConfigSchema = z.object({
	level: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
	verbose: z.boolean().default(false),
	file: z.string().default('.aria/logs/code-auditor.log'),
	maxFileSizeMb: z.number().default(10),
	maxFiles: z.number().default(7),
});

// =============================================================================
// RIFF-SPECIFIC SCHEMA (nested under code-auditor: in YAML)
// =============================================================================

export const CodeAuditorRiffSchema = z.object({
	paths: PathsConfigSchema.default(PathsConfigSchema.parse({})),
	output: OutputConfigSchema.default(OutputConfigSchema.parse({})),
});

// =============================================================================
// ROOT SCHEMA (matches YAML structure with riff wrapper)
// =============================================================================

export const CodeAuditorConfigSchema = z
	.object({
		'aria-riff': AriaRiffMetadataSchema.optional(),
		'code-auditor': CodeAuditorRiffSchema.default(CodeAuditorRiffSchema.parse({})),
		logging: LoggingConfigSchema.default(LoggingConfigSchema.parse({})),
	})
	.strict();

// =============================================================================
// TYPES - Inferred from Zod (single source of truth)
// =============================================================================

export type LoggingConfig = z.infer<typeof LoggingConfigSchema>;
export type CodeAuditorRiffConfig = z.infer<typeof CodeAuditorRiffSchema>;
export type CodeAuditorConfig = z.infer<typeof CodeAuditorConfigSchema>;
export type PathsConfig = z.infer<typeof PathsConfigSchema>;
export type OutputConfig = z.infer<typeof OutputConfigSchema>;
