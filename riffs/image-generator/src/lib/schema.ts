/**
 * Zod schema definitions for image-generator configuration
 *
 * This is the SINGLE SOURCE OF TRUTH for config structure and defaults.
 * All config types are inferred from these schemas.
 */

import { z } from 'zod';

const AriaRiffMetadataSchema = z
	.object({
		name: z.literal('image-generator'),
		description: z.string().min(1),
		category: z.enum(['documents', 'images', 'knowledge', 'development', 'utilities']),
	})
	.strict();

// =============================================================================
// NESTED SCHEMAS (internal only)
// =============================================================================

const GeminiSchema = z.object({
	defaultModel: z.string().default('gemini-3-pro-image-preview'),
	timeoutMs: z.number().default(60000),
	retryAttempts: z.number().default(3),
});

const DefaultsSchema = z.object({
	aspectRatio: z.string().default('1:1'),
	imageSize: z.string().default('1K'),
	outputFormat: z.string().default('png'),
});

const PathOutputSchema = z.object({
	dir: z.string().default('.aria/exports/image-generator'),
	chatDir: z.string().default('.'),
	history: z.string().default('.image-generator-chat-history.json'),
});

const PathsSchema = z.object({
	output: PathOutputSchema.default(PathOutputSchema.parse({})),
});

const OutputSchema = z.object({
	filenamePattern: z.string().default('{timestamp}_{operation}'),
	timestampFormat: z.string().default('YYYY-MM-DD_HH-mm-ss'),
});

export const LoggingConfigSchema = z.object({
	level: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
	verbose: z.boolean().default(false),
	file: z.string().default('.aria/logs/image-generator.log'),
	maxFileSizeMb: z.number().default(10),
	maxFiles: z.number().default(7),
});

const ChatSchema = z.object({
	autoSave: z.boolean().default(false),
});

// =============================================================================
// RIFF WRAPPER SCHEMA
// =============================================================================

export const ImageGeneratorRiffSchema = z.object({
	gemini: GeminiSchema.default(GeminiSchema.parse({})),
	defaults: DefaultsSchema.default(DefaultsSchema.parse({})),
	output: OutputSchema.default(OutputSchema.parse({})),
	paths: PathsSchema.default(PathsSchema.parse({})),
	chat: ChatSchema.default(ChatSchema.parse({})),
});

// =============================================================================
// ROOT SCHEMA
// =============================================================================

export const ImageGeneratorConfigSchema = z
	.object({
		'aria-riff': AriaRiffMetadataSchema.optional(),
		'image-generator': ImageGeneratorRiffSchema.default(ImageGeneratorRiffSchema.parse({})),
		logging: LoggingConfigSchema.default(LoggingConfigSchema.parse({})),
	})
	.strict();

// =============================================================================
// TYPES - Inferred from Zod (single source of truth)
// =============================================================================

export type ImageGeneratorRiffConfig = z.infer<typeof ImageGeneratorRiffSchema>;
export type ImageGeneratorConfig = z.infer<typeof ImageGeneratorConfigSchema>;
