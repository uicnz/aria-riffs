/**
 * Zod schema for prompt-tracer configuration
 * Single source of truth for config structure and defaults
 */

import { z } from 'zod';

const AriaRiffMetadataSchema = z
	.object({
		name: z.literal('prompt-tracer'),
		description: z.string().min(1),
		category: z.enum(['documents', 'images', 'knowledge', 'development', 'utilities']),
	})
	.strict();

// =============================================================================
// LOGGING SECTION (peer config)
// =============================================================================

export const LoggingConfigSchema = z.object({
	level: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
	verbose: z.boolean().default(false),
	file: z.string().default('.aria/logs/prompt-tracer.log'),
	maxFileSizeMb: z.number().default(10),
	maxFiles: z.number().default(7),
});

export type LoggingConfig = z.infer<typeof LoggingConfigSchema>;

// =============================================================================
// PATH SCHEMAS
// =============================================================================

const PathOutputSchema = z.object({
	reports: z.string().default('output/prompt-tracer'),
	traces: z.string().default('.aria/db/prompt-tracer'),
});

const PathsSchema = z.object({
	output: PathOutputSchema.default(PathOutputSchema.parse({})),
});

export type PathsConfig = z.infer<typeof PathsSchema>;

// =============================================================================
// RIFF CONFIG (nested under prompt-tracer:)
// =============================================================================

export const PromptTracerRiffSchema = z.object({
	paths: PathsSchema.default(PathsSchema.parse({})),
	/** Path to the Claude CLI executable. Resolved via: config > which claude > fallback */
	claudeExecutablePath: z.string().optional(),
});

export type PromptTracerRiffConfig = z.infer<typeof PromptTracerRiffSchema>;

// =============================================================================
// ROOT CONFIG SCHEMA
// =============================================================================

export const PromptTracerConfigSchema = z
	.object({
		'aria-riff': AriaRiffMetadataSchema.optional(),
		'prompt-tracer': PromptTracerRiffSchema.default(PromptTracerRiffSchema.parse({})),
		logging: LoggingConfigSchema.default(LoggingConfigSchema.parse({})),
	})
	.strict();

export type PromptTracerConfig = z.infer<typeof PromptTracerConfigSchema>;
