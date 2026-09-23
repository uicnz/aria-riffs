/**
 * Zod schema definitions for image-transcoder configuration
 *
 * This is the SINGLE SOURCE OF TRUTH for config structure and defaults.
 * All config types are inferred from these schemas.
 */

import { z } from 'zod';

const AriaRiffMetadataSchema = z
	.object({
		name: z.literal('image-transcoder'),
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

export const PathsSchema = z.object({
	input: PathInputSchema.default(PathInputSchema.parse({})),
	output: PathOutputSchema.default(PathOutputSchema.parse({})),
});

export const TranscodingSchema = z.object({
	maxFileSizeBytes: z.number().default(5242880), // 5MB in bytes
	quality: z.number().min(1).max(100).default(85),
});

export const ProcessingSchema = z.object({
	recursive: z.boolean().default(true),
});

export const LoggingConfigSchema = z.object({
	level: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
	verbose: z.boolean().default(false),
	file: z.string().default('.aria/logs/image-transcoder.log'),
	maxFileSizeMb: z.number().default(10),
	maxFiles: z.number().default(7),
});

// =============================================================================
// ROOT SCHEMA
// =============================================================================

export const ImageTranscoderRiffSchema = z.object({
	paths: PathsSchema.default(PathsSchema.parse({})),
	transcoding: TranscodingSchema.default(TranscodingSchema.parse({})),
	processing: ProcessingSchema.default(ProcessingSchema.parse({})),
});

export const ImageTranscoderConfigSchema = z
	.object({
		'aria-riff': AriaRiffMetadataSchema.optional(),
		'image-transcoder': ImageTranscoderRiffSchema.default(ImageTranscoderRiffSchema.parse({})),
		logging: LoggingConfigSchema.default(LoggingConfigSchema.parse({})),
	})
	.strict();

// =============================================================================
// TYPES - Inferred from Zod (single source of truth)
// =============================================================================

export type PathsConfig = z.infer<typeof PathsSchema>;
export type ProcessingConfig = z.infer<typeof ProcessingSchema>;
export type TranscodingConfig = z.infer<typeof TranscodingSchema>;
export type LoggingConfig = z.infer<typeof LoggingConfigSchema>;
export type ImageTranscoderRiffConfig = z.infer<typeof ImageTranscoderRiffSchema>;
export type TranscoderConfig = z.infer<typeof ImageTranscoderConfigSchema>;

// Alias for consistency with naming convention
export type ImageTranscoderConfig = TranscoderConfig;
