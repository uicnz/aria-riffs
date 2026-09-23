/**
 * Zod schema definitions for hr-policy configuration
 *
 * This is the SINGLE SOURCE OF TRUTH for config structure and defaults.
 * Uses camelCase for all property names to match the project standard.
 */

import { z } from 'zod';

const AriaRiffMetadataSchema = z
	.object({
		name: z.literal('hr-policy'),
		description: z.string().min(1),
		category: z.enum(['documents', 'images', 'knowledge', 'development', 'utilities']),
	})
	.strict();

// =============================================================================
// EMBEDDING PROVIDER SCHEMAS
// =============================================================================

export const OpenAIEmbeddingSchema = z.object({
	apiKey: z.string().default(''),
	model: z.string().default('text-embedding-3-large'),
	dimensions: z.number().default(3072),
	timeout: z.number().default(30),
	baseUrl: z.string().optional(),
});

export const GeminiEmbeddingSchema = z.object({
	apiKey: z.string().default(''),
	model: z.string().default('gemini-embedding-2'),
	dimensions: z.number().default(768),
	timeout: z.number().default(30),
	baseUrl: z.string().default('https://generativelanguage.googleapis.com/v1'),
});

export const OllamaEmbeddingSchema = z.object({
	endpoint: z.string().default('http://localhost:11434/'),
	model: z.string().default('embeddinggemma:latest'),
	dimensions: z.number().default(768),
	timeout: z.number().default(60),
	keepAlive: z.number().default(300),
});

export const EmbeddingsSchema = z.object({
	provider: z.enum(['openai', 'gemini', 'ollama']).default('openai'),
	maxChars: z.number().default(35000),
	batchSize: z.number().default(64),
	openai: OpenAIEmbeddingSchema.optional().default({
		apiKey: '',
		model: 'text-embedding-3-large',
		dimensions: 3072,
		timeout: 30,
	}),
	gemini: GeminiEmbeddingSchema.optional().default({
		apiKey: '',
		model: 'gemini-embedding-2',
		dimensions: 768,
		timeout: 30,
		baseUrl: 'https://generativelanguage.googleapis.com/v1',
	}),
	ollama: OllamaEmbeddingSchema.optional().default({
		endpoint: 'http://localhost:11434/',
		model: 'embeddinggemma:latest',
		dimensions: 768,
		timeout: 60,
		keepAlive: 300,
	}),
});

// =============================================================================
// PATHS SCHEMA
// =============================================================================

const PathInputSchema = z.object({
	policies: z.string().default('sources/cello/hr-policies/'),
	sections: z.string().default('.aria/exports/cello/hr-policies/'),
});

const PathOutputSchema = z.object({
	sections: z.string().default('.aria/exports/cello/hr-policies/'),
	dir: z.string().default('.aria/db/hr-policy'),
});

const PathDatabaseSchema = z.object({
	decomposer: z.string().default('.aria/db/hr-policy/hr-policy.db'),
	indexer: z.string().default('.aria/db/hr-policy/hr-policy.sqlite'),
});

export const PathsSchema = z.object({
	input: PathInputSchema.default(PathInputSchema.parse({})),
	output: PathOutputSchema.default(PathOutputSchema.parse({})),
	database: PathDatabaseSchema.default(PathDatabaseSchema.parse({})),
});

// =============================================================================
// DATABASE SCHEMA
// =============================================================================

export const DatabaseSchema = z.object({});

// =============================================================================
// LOGGING SCHEMA
// =============================================================================

export const LoggingConfigSchema = z.object({
	level: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
	verbose: z.boolean().default(false),
	file: z.string().default('.aria/logs/hr-policy.log'),
	maxFileSizeMb: z.number().default(10),
	maxFiles: z.number().default(7),
});

// =============================================================================
// DECOMPOSER SCHEMA
// =============================================================================

export const DecomposerSchema = z.object({
	primaryPattern: z.string().default('^## .+'),
	fallbackPattern: z.string().default('^### .+'),
	filePatterns: z.array(z.string()).default(['*.md', '**/*.md']),
});

// =============================================================================
// INDEXER SCHEMA
// =============================================================================

export const IndexerSchema = z.object({
	sections: z.enum(['response', 'request', 'both', 'full']).default('both'),
	weightResponse: z.number().default(1.8),
	useFts: z.boolean().default(true),
	hybrid: z.boolean().default(true),
	alpha: z.number().default(0.1),
	pathWeight: z.number().default(0.15),
	showMetadata: z.boolean().default(true),
	highlight: z.boolean().default(true),
	snippetContextLines: z.number().default(10),
	maxSnippetLength: z.number().default(2000),
	highlightColor: z.string().default('white'),
});

// =============================================================================
// RIFF SCHEMA - Riff config under wrapper
// =============================================================================

export const HrPolicyRiffSchema = z.object({
	paths: PathsSchema.default(PathsSchema.parse({})),
	embeddings: EmbeddingsSchema.optional().default({
		provider: 'openai',
		maxChars: 35000,
		batchSize: 64,
		openai: {
			apiKey: '',
			model: 'text-embedding-3-large',
			dimensions: 3072,
			timeout: 30,
		},
		gemini: {
			apiKey: '',
			model: 'gemini-embedding-2',
			dimensions: 768,
			timeout: 30,
			baseUrl: 'https://generativelanguage.googleapis.com/v1',
		},
		ollama: {
			endpoint: 'http://localhost:11434/',
			model: 'embeddinggemma:latest',
			dimensions: 768,
			timeout: 60,
			keepAlive: 300,
		},
	}),
	database: DatabaseSchema.optional().default({}),
	decomposer: DecomposerSchema.optional().default({
		primaryPattern: '^## .+',
		fallbackPattern: '^### .+',
		filePatterns: ['*.md', '**/*.md'],
	}),
	indexer: IndexerSchema.optional().default({
		sections: 'both',
		weightResponse: 1.8,
		useFts: true,
		hybrid: true,
		alpha: 0.1,
		pathWeight: 0.15,
		showMetadata: true,
		highlight: true,
		snippetContextLines: 10,
		maxSnippetLength: 2000,
		highlightColor: 'white',
	}),
});

// =============================================================================
// ROOT SCHEMA - Full YAML structure with wrapper and logging peer
// =============================================================================

export const HrPolicyConfigSchema = z
	.object({
		'aria-riff': AriaRiffMetadataSchema.optional(),
		'hr-policy': HrPolicyRiffSchema,
		logging: LoggingConfigSchema.default(LoggingConfigSchema.parse({})),
	})
	.strict();

// =============================================================================
// TYPES
// =============================================================================

export type HrPolicyConfig = z.infer<typeof HrPolicyConfigSchema>;
export type HrPolicyRiffConfig = z.infer<typeof HrPolicyRiffSchema>;
export type EmbeddingsConfig = z.infer<typeof EmbeddingsSchema>;
export type OpenAIEmbeddingConfig = z.infer<typeof OpenAIEmbeddingSchema>;
export type GeminiEmbeddingConfig = z.infer<typeof GeminiEmbeddingSchema>;
export type OllamaEmbeddingConfig = z.infer<typeof OllamaEmbeddingSchema>;
export type DatabaseConfig = z.infer<typeof DatabaseSchema>;
export type LoggingConfig = z.infer<typeof LoggingConfigSchema>;
export type DecomposerConfig = z.infer<typeof DecomposerSchema>;
export type IndexerConfig = z.infer<typeof IndexerSchema>;
export type PathsConfig = z.infer<typeof PathsSchema>;
