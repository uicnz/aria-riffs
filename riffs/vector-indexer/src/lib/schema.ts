/**
 * Zod schema definitions for vector-indexer configuration
 *
 * This is the SINGLE SOURCE OF TRUTH for config structure and defaults.
 * Uses camelCase for all property names to match the project standard.
 */

import { z } from 'zod';

const AriaRiffMetadataSchema = z
	.object({
		name: z.literal('vector-indexer'),
		description: z.string().min(1),
		category: z.enum(['documents', 'images', 'knowledge', 'development', 'utilities']),
	})
	.strict();

// =============================================================================
// NESTED SCHEMAS - Service providers
// =============================================================================

export const OllamaSchema = z.object({
	host: z.string().default('http://localhost:11434'),
	timeout: z.number().default(120000),
});

export const LlamaCppSchema = z.object({
	host: z.string().default('http://localhost:8080'),
	timeout: z.number().default(120000),
	modelPath: z.string().default(''),
});

export const QdrantSchema = z.object({
	host: z.string().default('localhost'),
	port: z.number().default(6333),
	apiKey: z.string().nullable().default(null),
	timeout: z.number().default(30000),
});

// =============================================================================
// NESTED SCHEMAS - Paths and storage
// =============================================================================

export const PathsInputSchema = z.object({
	documents: z.string().default('exports'),
	compose: z.string().default('riffs/vector-indexer/docker/docker-compose.yml'),
});

export const PathsOutputSchema = z.object({
	dir: z.string().default('.aria/exports/vector-indexer'),
	qdrant: z.string().default('.aria/db/vector-indexer'),
	pids: z.string().default('~/.aria/vector-indexer/pids'),
});

export const PathsDatabaseSchema = z.object({
	file: z.string().default('.aria/db/vector-indexer/metadata.sqlite'),
});

export const PathsSchema = z.object({
	input: PathsInputSchema.optional().default({
		documents: 'exports',
		compose: 'riffs/vector-indexer/docker/docker-compose.yml',
	}),
	output: PathsOutputSchema.optional().default({
		dir: '.aria/exports/vector-indexer',
		qdrant: '.aria/db/vector-indexer',
		pids: '~/.aria/vector-indexer/pids',
	}),
	database: PathsDatabaseSchema.optional().default({
		file: '.aria/db/vector-indexer/metadata.sqlite',
	}),
});

// =============================================================================
// NESTED SCHEMAS - Chunking strategies
// =============================================================================

export const MetadataPatternSchema = z.object({
	regex: z.string(),
	name: z.string(),
	captureGroup: z.number().default(1),
	required: z.boolean().default(false),
});

export const AriaCalloutFieldsSchema = z.object({
	identifier: MetadataPatternSchema,
	description: MetadataPatternSchema,
	priority: MetadataPatternSchema,
	category: MetadataPatternSchema,
	department: MetadataPatternSchema,
	leader: MetadataPatternSchema,
	customise: MetadataPatternSchema,
});

export const GenericHierarchicalSchema = z.object({
	primaryLevel: z.number().default(2),
	maxLevels: z.array(z.number()).default([2, 3, 4]),
	maxTokens: z.number().default(512),
	minTokens: z.number().default(50),
	wholeDocumentThreshold: z.number().default(512),
	fallback: z.literal('paragraph').default('paragraph'),
	preserve: z.array(z.string()).default(['```', '~~~']),
	includeContext: z.boolean().default(true),
});

export const AriaHeadingEnrichedSchema = z.object({
	calloutPattern: z.string(),
	fields: AriaCalloutFieldsSchema,
	enrichmentTemplate: z.string(),
	maxTokens: z.number().default(512),
	minTokens: z.number().default(50),
	wholeDocumentThreshold: z.number().default(512),
	includeContext: z.boolean().default(true),
});

export const MetadataExtractionSchema = z.object({
	enabled: z.boolean().default(true),
	patterns: z.array(MetadataPatternSchema).default([]),
});

export const ChunkingSchema = z.object({
	strategy: z
		.enum(['generic.hierarchical', 'generic.fixed-window', 'generic.paragraph', 'aria.heading-enriched'])
		.default('generic.hierarchical'),
	'generic.hierarchical': GenericHierarchicalSchema.optional().default({
		primaryLevel: 2,
		maxLevels: [2, 3, 4],
		maxTokens: 512,
		minTokens: 50,
		wholeDocumentThreshold: 512,
		fallback: 'paragraph',
		preserve: ['```', '~~~'],
		includeContext: true,
	}),
	'aria.heading-enriched': AriaHeadingEnrichedSchema.optional(),
	metadataExtraction: MetadataExtractionSchema.optional().default({
		enabled: true,
		patterns: [],
	}),
});

// =============================================================================
// NESTED SCHEMAS - Embedding and search
// =============================================================================

export const EmbeddingSchema = z.object({
	provider: z.enum(['ollama', 'llama-cpp']).default('ollama'),
	model: z.string().default('qwen3-embedding:8b'),
	fallbackModel: z.string().default('qwen3-embedding:4b'),
	dimensions: z.number().default(1024),
	instruction: z.string().default('Represent this document for semantic search'),
	batchSize: z.number().default(10),
	memoryThresholdGb: z.number().default(16),
	chunking: ChunkingSchema.optional().default({
		strategy: 'generic.hierarchical',
		'generic.hierarchical': {
			primaryLevel: 2,
			maxLevels: [2, 3, 4],
			maxTokens: 512,
			minTokens: 50,
			wholeDocumentThreshold: 512,
			fallback: 'paragraph',
			preserve: ['```', '~~~'],
			includeContext: true,
		},
		metadataExtraction: {
			enabled: true,
			patterns: [],
		},
	}),
});

export const SparseSchema = z.object({
	enabled: z.boolean().default(true),
	k1: z.number().default(1.5),
	b: z.number().default(0.75),
});

export const RerankerSchema = z.object({
	provider: z.enum(['ollama', 'llama-cpp']).default('ollama'),
	model: z.string().default('dengcao/Qwen3-Reranker-4B'),
	highMemoryModel: z.string().default('dengcao/Qwen3-Reranker-8B'),
	enabled: z.boolean().default(true),
	topK: z.number().default(100),
	finalK: z.number().default(20),
	autoSelectModel: z.boolean().default(true),
	memoryThresholdGb: z.number().default(32),
});

export const SearchSchema = z.object({
	denseWeight: z.number().default(0.7),
	sparseWeight: z.number().default(0.3),
});

// =============================================================================
// NESTED SCHEMAS - Logging and processing
// =============================================================================

export const LoggingConfigSchema = z.object({
	level: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
	verbose: z.boolean().default(false),
	file: z.string().default('.aria/logs/vector-indexer.log'),
	maxFileSizeMb: z.number().default(10),
	maxFiles: z.number().default(7),
});

export const DatabaseSchema = z.object({
	journalMode: z.string().default('WAL'),
	backupCount: z.number().default(3),
});

export const ProcessingSchema = z.object({
	batchSize: z.number().default(10),
	progressBar: z.boolean().default(true),
	parallelWorkers: z.number().default(4),
});

// =============================================================================
// NESTED SCHEMAS - Services
// =============================================================================

export const DockerSchema = z.object({
	containerName: z.string().default('aria-qdrant'),
});

export const LlamaServerSchema = z.object({
	hostBinding: z.string().default('0.0.0.0'),
	gpuLayers: z.number().default(99),
	disableLogging: z.boolean().default(true),
});

export const ServicesSchema = z.object({
	autoStart: z.boolean().default(true),
	shutdownOnExit: z.boolean().default(false),
	startupTimeoutSeconds: z.number().default(60),
	healthCheckIntervalMs: z.number().default(1000),
	docker: DockerSchema.optional().default({
		containerName: 'aria-qdrant',
	}),
	llamaServer: LlamaServerSchema.optional().default({
		hostBinding: '0.0.0.0',
		gpuLayers: 99,
		disableLogging: true,
	}),
});

// =============================================================================
// RIFF SCHEMA - Matches YAML structure under 'vector-indexer' key
// =============================================================================

export const VectorIndexerRiffSchema = z.object({
	ollama: OllamaSchema.optional().default({ host: 'http://localhost:11434', timeout: 120000 }),
	llamaCppEmbeddings: LlamaCppSchema.optional().default({
		host: 'http://localhost:8080',
		timeout: 120000,
		modelPath: '',
	}),
	llamaCppReranker: LlamaCppSchema.optional().default({
		host: 'http://localhost:8081',
		timeout: 30000,
		modelPath: '',
	}),
	qdrant: QdrantSchema.optional().default({ host: 'localhost', port: 6333, apiKey: null, timeout: 30000 }),
	paths: PathsSchema.optional().default({
		input: {
			documents: 'exports',
			compose: 'riffs/vector-indexer/docker/docker-compose.yml',
		},
		output: {
			dir: '.aria/exports/vector-indexer',
			qdrant: '.aria/db/vector-indexer',
			pids: '~/.aria/vector-indexer/pids',
		},
		database: {
			file: '.aria/db/vector-indexer/metadata.sqlite',
		},
	}),
	embedding: EmbeddingSchema.optional().default({
		provider: 'ollama',
		model: 'qwen3-embedding:8b',
		fallbackModel: 'qwen3-embedding:4b',
		dimensions: 1024,
		instruction: 'Represent this document for semantic search',
		batchSize: 10,
		memoryThresholdGb: 16,
		chunking: {
			strategy: 'generic.hierarchical',
			'generic.hierarchical': {
				primaryLevel: 2,
				maxLevels: [2, 3, 4],
				maxTokens: 512,
				minTokens: 50,
				wholeDocumentThreshold: 512,
				fallback: 'paragraph',
				preserve: ['```', '~~~'],
				includeContext: true,
			},
			metadataExtraction: { enabled: true, patterns: [] },
		},
	}),
	sparse: SparseSchema.optional().default({ enabled: true, k1: 1.5, b: 0.75 }),
	reranker: RerankerSchema.optional().default({
		provider: 'ollama',
		model: 'dengcao/Qwen3-Reranker-4B',
		highMemoryModel: 'dengcao/Qwen3-Reranker-8B',
		enabled: true,
		topK: 100,
		finalK: 20,
		autoSelectModel: true,
		memoryThresholdGb: 32,
	}),
	search: SearchSchema.optional().default({ denseWeight: 0.7, sparseWeight: 0.3 }),
	database: DatabaseSchema.optional().default({ journalMode: 'WAL', backupCount: 3 }),
	processing: ProcessingSchema.optional().default({ batchSize: 10, progressBar: true, parallelWorkers: 4 }),
	services: ServicesSchema.optional().default({
		autoStart: true,
		shutdownOnExit: false,
		startupTimeoutSeconds: 60,
		healthCheckIntervalMs: 1000,
		docker: { containerName: 'aria-qdrant' },
		llamaServer: { hostBinding: '0.0.0.0', gpuLayers: 99, disableLogging: true },
	}),
});

// =============================================================================
// ROOT SCHEMA - Full YAML file structure with wrapper and peer sections
// =============================================================================

export const VectorIndexerConfigSchema = z
	.object({
		'aria-riff': AriaRiffMetadataSchema.optional(),
		'vector-indexer': VectorIndexerRiffSchema,
		logging: LoggingConfigSchema.default(LoggingConfigSchema.parse({})),
	})
	.strict();

// =============================================================================
// TYPES - Inferred from Zod
// =============================================================================

export type VectorIndexerConfig = z.infer<typeof VectorIndexerConfigSchema>;
export type VectorIndexerRiffConfig = z.infer<typeof VectorIndexerRiffSchema>;
export type OllamaYamlConfig = z.infer<typeof OllamaSchema>;
export type LlamaCppYamlConfig = z.infer<typeof LlamaCppSchema>;
export type QdrantYamlConfig = z.infer<typeof QdrantSchema>;
export type PathsYamlConfig = z.infer<typeof PathsSchema>;
export type EmbeddingYamlConfig = z.infer<typeof EmbeddingSchema>;
export type ChunkingYamlConfig = z.infer<typeof ChunkingSchema>;
export type LoggingConfig = z.infer<typeof LoggingConfigSchema>;
