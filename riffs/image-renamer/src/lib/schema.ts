/**
 * Zod schema definitions for image-renamer configuration
 * Single source of truth for config structure and defaults
 */

import { z } from 'zod';

const AriaRiffMetadataSchema = z
	.object({
		name: z.literal('image-renamer'),
		description: z.string().min(1),
		category: z.enum(['documents', 'images', 'knowledge', 'development', 'utilities']),
	})
	.strict();

// =============================================================================
// LLM PROVIDER SCHEMAS
// =============================================================================

const OllamaConfigSchema = z.object({
	endpoint: z.string().default('http://localhost:11434/'),
	model: z.string().default('llava-llama3'),
	timeout: z.number().min(1).default(30),
	retryAttempts: z.number().min(0).default(3),
	retryDelay: z.number().min(0).default(1.0),
	prompt: z.string().default('Describe this image in 4-5 words. Just give me the words, no preamble or punctuation.'),
});

const AnthropicConfigSchema = z.object({
	apiKey: z.string().default(''),
	model: z.string().default('claude-sonnet-4-20250514'),
	timeout: z.number().min(1).default(30),
	maxTokens: z.number().min(1).default(1024),
	baseUrl: z.string().default('https://api.anthropic.com/v1'),
	prompt: z.string().default('Generate a concise, descriptive filename for this image in 4-5 words'),
});

const GeminiConfigSchema = z.object({
	apiKey: z.string().default(''),
	model: z.string().default('gemini-2.5-flash'),
	timeout: z.number().min(1).default(30),
	maxTokens: z.number().min(1).default(1024),
	baseUrl: z.string().default('https://generativelanguage.googleapis.com/v1beta'),
	prompt: z.string().default('Generate a concise, descriptive filename for this image in 4-5 words'),
});

const LLMConfigSchema = z.object({
	provider: z.enum(['ollama', 'anthropic', 'gemini']).default('ollama'),
	ollama: OllamaConfigSchema.default(OllamaConfigSchema.parse({})),
	anthropic: AnthropicConfigSchema.default(AnthropicConfigSchema.parse({})),
	gemini: GeminiConfigSchema.default(GeminiConfigSchema.parse({})),
});

// =============================================================================
// OTHER CONFIG SCHEMAS
// =============================================================================

const PathInputSchema = z.object({
	dir: z.string().nullable().default(null),
});

const PathDatabaseSchema = z.object({
	file: z.string().default('.aria/db/image-renamer/image-renamer.sqlite'),
});

const PathsConfigSchema = z.object({
	input: PathInputSchema.default(PathInputSchema.parse({})),
	database: PathDatabaseSchema.default(PathDatabaseSchema.parse({})),
});

const ImagesConfigSchema = z.object({
	supportedExtensions: z.array(z.string()).default(['.png', '.jpg', '.jpeg', '.gif', '.bmp']),
	maxFileSizeMb: z.number().min(1).default(50),
	verifyBeforeProcessing: z.boolean().default(true),
});

const FilenameConfigSchema = z.object({
	prompt: z.string().default('Describe this image in 4-5 words'),
	patternCleanup: z.boolean().default(true),
	maxLength: z.number().min(1).default(100),
	removePunctuation: z.boolean().default(true),
	replaceSpacesWith: z.string().default('-'),
	caseConversion: z.string().default('lower'),
});

const FileOperationsConfigSchema = z.object({
	safeMoveRetries: z.number().min(0).default(3),
	moveDelaySeconds: z.number().min(0).default(0.5),
	backupOriginals: z.boolean().default(false),
	confirmOverwrites: z.boolean().default(true),
});

const WatcherConfigSchema = z.object({
	recursive: z.boolean().default(false),
	debounceSeconds: z.number().min(0).default(1.0),
	fileSettleTime: z.number().min(0).default(1.0),
});

export const LoggingConfigSchema = z.object({
	level: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
	verbose: z.boolean().default(false),
	file: z.string().default('.aria/logs/image-renamer.log'),
	maxFileSizeMb: z.number().min(1).default(10),
	maxFiles: z.number().min(1).default(7),
});

const ProcessingConfigSchema = z.object({
	progressBar: z.boolean().default(true),
	batchSize: z.number().min(1).default(10),
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

export const ImageRenamerRiffSchema = z.object({
	paths: PathsConfigSchema.default(PathsConfigSchema.parse({})),
	llm: LLMConfigSchema.default(LLMConfigSchema.parse({})),
	images: ImagesConfigSchema.default(ImagesConfigSchema.parse({})),
	filename: FilenameConfigSchema.default(FilenameConfigSchema.parse({})),
	fileOperations: FileOperationsConfigSchema.default(FileOperationsConfigSchema.parse({})),
	watcher: WatcherConfigSchema.default(WatcherConfigSchema.parse({})),
	processing: ProcessingConfigSchema.default(ProcessingConfigSchema.parse({})),
	database: DatabaseConfigSchema.default(DatabaseConfigSchema.parse({})),
});

export const ImageRenamerConfigSchema = z
	.object({
		'aria-riff': AriaRiffMetadataSchema.optional(),
		'image-renamer': ImageRenamerRiffSchema.default(ImageRenamerRiffSchema.parse({})),
		logging: LoggingConfigSchema.default(LoggingConfigSchema.parse({})),
	})
	.strict();

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type ImageRenamerConfig = z.infer<typeof ImageRenamerConfigSchema>;
export type ImageRenamerRiffConfig = z.infer<typeof ImageRenamerRiffSchema>;
export type LLMConfig = z.infer<typeof LLMConfigSchema>;
export type OllamaConfig = z.infer<typeof OllamaConfigSchema>;
export type AnthropicConfig = z.infer<typeof AnthropicConfigSchema>;
export type GeminiConfig = z.infer<typeof GeminiConfigSchema>;
export type PathsConfig = z.infer<typeof PathsConfigSchema>;
export type ImagesConfig = z.infer<typeof ImagesConfigSchema>;
export type FilenameConfig = z.infer<typeof FilenameConfigSchema>;
export type FileOperationsConfig = z.infer<typeof FileOperationsConfigSchema>;
export type WatcherConfig = z.infer<typeof WatcherConfigSchema>;
export type LoggingConfig = z.infer<typeof LoggingConfigSchema>;
export type ProcessingConfig = z.infer<typeof ProcessingConfigSchema>;
export type DatabaseConfig = z.infer<typeof DatabaseConfigSchema>;
