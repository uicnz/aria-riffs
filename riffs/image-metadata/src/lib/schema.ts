/**
 * Zod schema definitions for image-metadata configuration
 * Single source of truth for config structure and defaults
 *
 * Structure follows the canonical Aria config pattern:
 * - 'image-metadata:' wrapper for riff-specific config (TUI-visible)
 * - 'logging:' top-level peer section
 * - 'llmProviders:' top-level peer section for deep provider config
 */

import { z } from 'zod';

const AriaRiffMetadataSchema = z
	.object({
		name: z.literal('image-metadata'),
		description: z.string().min(1),
		category: z.enum(['documents', 'images', 'knowledge', 'development', 'utilities']),
	})
	.strict();

// =============================================================================
// LLM PROVIDER SCHEMAS (for peer section - deep config outside TUI)
// =============================================================================

const OllamaProviderSchema = z.object({
	endpoint: z.string().default('http://localhost:11434/'),
	model: z.string().default('gemma4:12b'),
	timeout: z.number().min(1).default(30),
	keepAlive: z.number().min(0).default(5),
	prompt: z.string().default('Describe this image in detail for use as XMP metadata description.'),
});

const AnthropicProviderSchema = z.object({
	apiKey: z.string().default(''),
	model: z.string().default('claude-sonnet-5'),
	timeout: z.number().min(1).default(30),
	maxTokens: z.number().min(1).default(1024),
	baseUrl: z.string().default('https://api.anthropic.com/v1'),
	prompt: z.string().default('Describe this image in detail for use as XMP metadata description.'),
});

const GeminiProviderSchema = z.object({
	apiKey: z.string().default(''),
	model: z.string().default('gemini-3.8-flash'),
	timeout: z.number().min(1).default(30),
	maxTokens: z.number().min(1).default(1024),
	baseUrl: z.string().default('https://generativelanguage.googleapis.com/v1beta'),
	prompt: z.string().default('Describe this image in detail for use as XMP metadata description.'),
});

const LLMProvidersSchema = z.object({
	ollama: OllamaProviderSchema.default(OllamaProviderSchema.parse({})),
	anthropic: AnthropicProviderSchema.default(AnthropicProviderSchema.parse({})),
	gemini: GeminiProviderSchema.default(GeminiProviderSchema.parse({})),
});

// =============================================================================
// RIFF-SPECIFIC SCHEMAS (under image-metadata: wrapper)
// =============================================================================

const LLMSelectorSchema = z.object({
	provider: z.enum(['ollama', 'anthropic', 'gemini']).default('ollama'),
});

const PathInputSchema = z.object({
	dir: z.string().default('.aria/assets/images'),
});

const PathDatabaseSchema = z.object({
	file: z.string().default('.aria/db/image-metadata/image-metadata.sqlite'),
});

const PathsConfigSchema = z.object({
	input: PathInputSchema.default(PathInputSchema.parse({})),
	database: PathDatabaseSchema.default(PathDatabaseSchema.parse({})),
});

const DatabaseConfigSchema = z.object({
	backupCount: z.number().min(0).default(3),
	journalMode: z.string().default('DELETE'),
});

const ImagesConfigSchema = z.object({
	supportedExtensions: z.array(z.string()).default(['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp']),
	maxFileSizeMb: z.number().min(1).default(50),
});

const MetadataConfigSchema = z.object({
	retryAttempts: z.number().min(0).default(3),
	retryDelay: z.number().min(0).default(1.0),
});

const ProcessingConfigSchema = z.object({
	batchSize: z.number().min(1).default(10),
	progressBar: z.boolean().default(true),
});

// Riff wrapper schema (TUI-visible, max 3 levels: wrapper > section > field)
export const ImageMetadataRiffSchema = z.object({
	paths: PathsConfigSchema.default(PathsConfigSchema.parse({})),
	llm: LLMSelectorSchema.default(LLMSelectorSchema.parse({})),
	database: DatabaseConfigSchema.default(DatabaseConfigSchema.parse({})),
	images: ImagesConfigSchema.default(ImagesConfigSchema.parse({})),
	metadata: MetadataConfigSchema.default(MetadataConfigSchema.parse({})),
	processing: ProcessingConfigSchema.default(ProcessingConfigSchema.parse({})),
});

// =============================================================================
// LOGGING SCHEMA (top-level peer section)
// =============================================================================

export const LoggingConfigSchema = z.object({
	level: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
	verbose: z.boolean().default(false),
	file: z.string().default('.aria/logs/image-metadata.log'),
	maxFileSizeMb: z.number().min(1).default(10),
	maxFiles: z.number().min(1).default(7),
});

// =============================================================================
// ROOT CONFIG SCHEMA
// =============================================================================

export const ImageMetadataConfigSchema = z
	.object({
		'aria-riff': AriaRiffMetadataSchema.optional(),
		'image-metadata': ImageMetadataRiffSchema.default(ImageMetadataRiffSchema.parse({})),
		logging: LoggingConfigSchema.default(LoggingConfigSchema.parse({})),
		llmProviders: LLMProvidersSchema.default(LLMProvidersSchema.parse({})),
	})
	.strict();

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type ImageMetadataConfig = z.infer<typeof ImageMetadataConfigSchema>;
export type ImageMetadataRiffConfig = z.infer<typeof ImageMetadataRiffSchema>;
export type LLMProviders = z.infer<typeof LLMProvidersSchema>;
export type OllamaProviderConfig = z.infer<typeof OllamaProviderSchema>;
export type AnthropicProviderConfig = z.infer<typeof AnthropicProviderSchema>;
export type GeminiProviderConfig = z.infer<typeof GeminiProviderSchema>;
export type DatabaseConfig = z.infer<typeof DatabaseConfigSchema>;
export type ImagesConfig = z.infer<typeof ImagesConfigSchema>;
export type MetadataConfig = z.infer<typeof MetadataConfigSchema>;
export type LoggingConfig = z.infer<typeof LoggingConfigSchema>;
export type ProcessingConfig = z.infer<typeof ProcessingConfigSchema>;
