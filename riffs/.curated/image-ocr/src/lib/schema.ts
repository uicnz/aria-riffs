/**
 * Zod schema definitions for image-ocr configuration
 * Single source of truth for config structure and defaults
 *
 * Structure follows the canonical Aria config pattern:
 * - 'image-ocr:' wrapper for riff-specific config (TUI-visible)
 * - 'logging:' top-level peer section
 */

import { z } from 'zod';

const AriaRiffMetadataSchema = z
	.object({
		name: z.literal('image-ocr'),
		description: z.string().min(1),
		category: z.enum(['documents', 'images', 'knowledge', 'development', 'utilities']),
	})
	.strict();

// =============================================================================
// SECTION SCHEMAS (under image-ocr: wrapper)
// =============================================================================

const OcrConfigSchema = z.object({
	language: z.string().default('eng'),
	confidenceThreshold: z.number().min(0).max(1).default(0.5),
	timeout: z.number().min(1).default(30),
});

const OutputConfigSchema = z.object({
	format: z.string().default('markdown'),
	includeMetadata: z.boolean().default(true),
	preserveLayout: z.boolean().default(false),
});

const FilesConfigSchema = z.object({
	supportedExtensions: z.array(z.string()).default(['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.pdf']),
	maxFileSizeMb: z.number().min(1).default(100),
	outputExtension: z.string().default('.txt'),
});

const ProcessingConfigSchema = z.object({
	batchSize: z.number().min(1).default(5),
	progressBar: z.boolean().default(true),
	concurrentJobs: z.number().min(1).default(2),
});

const PathInputSchema = z.object({
	dir: z.string().default('.aria/assets/image-ocr/images'),
});

const PathOutputSchema = z.object({
	dir: z.string().default('.aria/exports/image-ocr/images'),
});

const PathDatabaseSchema = z.object({
	dir: z.string().default('~/.aria/db/image-ocr/tessdata'),
});

const PathsSchema = z.object({
	input: PathInputSchema.default(PathInputSchema.parse({})),
	output: PathOutputSchema.default(PathOutputSchema.parse({})),
	database: PathDatabaseSchema.default(PathDatabaseSchema.parse({})),
});

// Riff wrapper schema (TUI-visible, max 3 levels: wrapper > section > field)
export const ImageOcrRiffSchema = z.object({
	paths: PathsSchema.default(PathsSchema.parse({})),
	ocr: OcrConfigSchema.default(OcrConfigSchema.parse({})),
	output: OutputConfigSchema.default(OutputConfigSchema.parse({})),
	files: FilesConfigSchema.default(FilesConfigSchema.parse({})),
	processing: ProcessingConfigSchema.default(ProcessingConfigSchema.parse({})),
});

// =============================================================================
// LOGGING SCHEMA (top-level peer section)
// =============================================================================

export const LoggingConfigSchema = z.object({
	level: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
	verbose: z.boolean().default(false),
	file: z.string().default('.aria/logs/image-ocr.log'),
	maxFileSizeMb: z.number().min(1).default(10),
	maxFiles: z.number().min(1).default(7),
});

// =============================================================================
// ROOT CONFIG SCHEMA
// =============================================================================

export const ImageOcrConfigSchema = z
	.object({
		'aria-riff': AriaRiffMetadataSchema.optional(),
		'image-ocr': ImageOcrRiffSchema.default(ImageOcrRiffSchema.parse({})),
		logging: LoggingConfigSchema.default(LoggingConfigSchema.parse({})),
	})
	.strict();

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type ImageOcrConfig = z.infer<typeof ImageOcrConfigSchema>;
export type ImageOcrRiffConfig = z.infer<typeof ImageOcrRiffSchema>;
export type OcrConfig = z.infer<typeof OcrConfigSchema>;
export type OutputConfig = z.infer<typeof OutputConfigSchema>;
export type FilesConfig = z.infer<typeof FilesConfigSchema>;
export type ProcessingConfig = z.infer<typeof ProcessingConfigSchema>;
export type LoggingConfig = z.infer<typeof LoggingConfigSchema>;
