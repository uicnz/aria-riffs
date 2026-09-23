/**
 * Zod schema definitions for image-alttext configuration
 *
 * This is the SINGLE SOURCE OF TRUTH for config structure and defaults.
 */

import { z } from 'zod';

const AriaRiffMetadataSchema = z
	.object({
		name: z.literal('image-alttext'),
		description: z.string().min(1),
		category: z.enum(['documents', 'images', 'knowledge', 'development', 'utilities']),
	})
	.strict();

// =============================================================================
// NESTED SCHEMAS
// =============================================================================

export const LoggingConfigSchema = z.object({
	level: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
	verbose: z.boolean().default(false),
	file: z.string().default('.aria/logs/image-alttext.log'),
	maxFileSizeMb: z.number().default(10),
	maxFiles: z.number().default(7),
});

// =============================================================================
// RIFF WRAPPER SCHEMA
// =============================================================================

const PathInputSchema = z.object({
	dir: z.string().nullable().default(null),
});

const PathOutputSchema = z.object({
	dir: z.string().nullable().default(null),
});

const PathsSchema = z.object({
	input: PathInputSchema.default(PathInputSchema.parse({})),
	output: PathOutputSchema.default(PathOutputSchema.parse({})),
});

export const ImageAlttextRiffSchema = z.object({
	paths: PathsSchema.default(PathsSchema.parse({})),
	verbose: z.boolean().default(false),
	dryRun: z.boolean().default(false),
});

// =============================================================================
// ROOT SCHEMA
// =============================================================================

export const ImageAlttextConfigSchema = z
	.object({
		'aria-riff': AriaRiffMetadataSchema.optional(),
		'image-alttext': ImageAlttextRiffSchema.default(ImageAlttextRiffSchema.parse({})),
		logging: LoggingConfigSchema.default(LoggingConfigSchema.parse({})),
	})
	.strict();

// =============================================================================
// TYPES
// =============================================================================

export type ImageAlttextConfig = z.infer<typeof ImageAlttextConfigSchema>;
export type ImageAlttextRiffConfig = z.infer<typeof ImageAlttextRiffSchema>;
export type LoggingConfig = z.infer<typeof LoggingConfigSchema>;
