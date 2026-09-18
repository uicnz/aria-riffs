/**
 * Zod schema definitions for image-sanitiser configuration
 * Single source of truth for config structure and defaults
 */

import { z } from 'zod';

const AriaRiffMetadataSchema = z
	.object({
		name: z.literal('image-sanitiser'),
		description: z.string().min(1),
		category: z.enum(['documents', 'images', 'knowledge', 'development', 'utilities']),
	})
	.strict();

// =============================================================================
// CONFIG SECTION SCHEMAS
// =============================================================================

const PathInputSchema = z.object({
	dir: z.string().nullable().default(null),
});

const PathDatabaseSchema = z.object({
	file: z.string().default('.aria/db/image-sanitiser/image-sanitiser.sqlite'),
});

const PathsConfigSchema = z.object({
	input: PathInputSchema.default(PathInputSchema.parse({})),
	database: PathDatabaseSchema.default(PathDatabaseSchema.parse({})),
});

const ImagesConfigSchema = z.object({
	supportedExtensions: z
		.array(z.string())
		.default(['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.tif', '.webp']),
	maxFileSizeMb: z.number().min(1).default(100),
	verifyAfterRename: z.boolean().default(true),
});

const FileOperationsConfigSchema = z.object({
	safeMoveRetries: z.number().min(0).default(3),
	moveDelaySeconds: z.number().min(0).default(0.5),
	backupOriginals: z.boolean().default(false),
	confirmOverwrites: z.boolean().default(true),
});

const DetectionConfigSchema = z.object({
	useSharpMetadata: z.boolean().default(true),
	preferSharpOverMagic: z.boolean().default(false),
	fallbackToMagicBytes: z.boolean().default(true),
	strictMode: z.boolean().default(false),
});

export const LoggingConfigSchema = z.object({
	level: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
	verbose: z.boolean().default(false),
	file: z.string().default('.aria/logs/image-sanitiser.log'),
	maxFileSizeMb: z.number().min(1).default(10),
	maxFiles: z.number().min(1).default(7),
});

const ProcessingConfigSchema = z.object({
	progressBar: z.boolean().default(true),
	batchSize: z.number().min(1).default(50),
	concurrentOperations: z.boolean().default(false),
	dryRun: z.boolean().default(false),
	recursive: z.boolean().default(true),
});

const DatabaseConfigSchema = z.object({
	tableName: z.string().default('images'),
	journalMode: z.string().default('DELETE'),
});

// =============================================================================
// ROOT CONFIG SCHEMA
// =============================================================================

export const ImageSanitiserRiffSchema = z.object({
	paths: PathsConfigSchema.default(PathsConfigSchema.parse({})),
	images: ImagesConfigSchema.default(ImagesConfigSchema.parse({})),
	fileOperations: FileOperationsConfigSchema.default(FileOperationsConfigSchema.parse({})),
	detection: DetectionConfigSchema.default(DetectionConfigSchema.parse({})),
	processing: ProcessingConfigSchema.default(ProcessingConfigSchema.parse({})),
	database: DatabaseConfigSchema.default(DatabaseConfigSchema.parse({})),
});

export const ImageSanitiserConfigSchema = z
	.object({
		'aria-riff': AriaRiffMetadataSchema.optional(),
		'image-sanitiser': ImageSanitiserRiffSchema.default(ImageSanitiserRiffSchema.parse({})),
		logging: LoggingConfigSchema.default(LoggingConfigSchema.parse({})),
	})
	.strict();

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type ImageSanitiserConfig = z.infer<typeof ImageSanitiserConfigSchema>;
export type ImageSanitiserRiffConfig = z.infer<typeof ImageSanitiserRiffSchema>;
export type PathsConfig = z.infer<typeof PathsConfigSchema>;
export type ImagesConfig = z.infer<typeof ImagesConfigSchema>;
export type FileOperationsConfig = z.infer<typeof FileOperationsConfigSchema>;
export type DetectionConfig = z.infer<typeof DetectionConfigSchema>;
export type LoggingConfig = z.infer<typeof LoggingConfigSchema>;
export type ProcessingConfig = z.infer<typeof ProcessingConfigSchema>;
export type DatabaseConfig = z.infer<typeof DatabaseConfigSchema>;
