/**
 * Configuration loading and validation for vector-indexer
 *
 * Three-tier configuration system:
 * 1. Defaults (in Zod schema) - lowest priority
 * 2. YAML config file - overrides defaults
 * 3. Environment variables - highest priority
 */

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import type { z } from 'zod';
import { loadDotEnv } from './load-dotenv.js';
import {
	type AriaCalloutFieldsSchema,
	type ChunkingSchema,
	LoggingConfigSchema,
	type LoggingConfig as LoggingConfigType,
	type MetadataPatternSchema,
	type VectorIndexerRiffConfig,
	VectorIndexerRiffSchema,
} from './schema.js';

/**
 * Get the riff's root directory (where config.yaml lives).
 * Walks up from the current file's directory looking for config.yaml.
 * Works in both source (src/lib/) and bundled (dist/) contexts.
 */
function getRiffRoot(): string {
	let dir = import.meta.dirname;
	for (let i = 0; i < 5; i++) {
		if (existsSync(resolve(dir, 'config.yaml'))) return dir;
		const parent = resolve(dir, '..');
		if (parent === dir) break;
		dir = parent;
	}
	return resolve(import.meta.dirname, '../..');
}

// =============================================================================
// TILDE EXPANSION
// =============================================================================

/** Expand leading `~/` to the user's home directory */
function expandTilde(p: string): string {
	return p.startsWith('~/') ? resolve(homedir(), p.slice(2)) : p;
}

/** Recursively expand tilde paths in all string values of an object */
function expandTildePaths<T>(obj: T): T {
	if (typeof obj === 'string') return expandTilde(obj) as T;
	if (Array.isArray(obj)) return obj.map(expandTildePaths) as T;
	if (obj && typeof obj === 'object') {
		const result = { ...obj } as Record<string, unknown>;
		for (const key of Object.keys(result)) {
			result[key] = expandTildePaths(result[key]);
		}
		return result as T;
	}
	return obj;
}

// =============================================================================
// CONFIG ERROR
// =============================================================================

export class ConfigError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ConfigError';
	}
}

// =============================================================================
// CAMELCASE CONFIG TYPE - What the rest of the app uses
// =============================================================================

// These interfaces match the original types.ts definitions but are derived from YAML
export interface VectorIndexerConfig {
	ollama: OllamaConfig;
	llamaCppEmbeddings: LlamaCppConfig;
	llamaCppReranker: LlamaCppConfig;
	qdrant: QdrantConfig;
	paths: PathsConfig;
	embedding: EmbeddingConfig;
	sparse: SparseConfig;
	reranker: RerankerConfig;
	search: SearchConfig;
	logging: LoggingConfig;
	database: DatabaseConfig;
	processing: ProcessingConfig;
	services: ServicesConfig;
}

export interface OllamaConfig {
	host: string;
	timeout: number;
}

export interface LlamaCppConfig {
	host: string;
	timeout: number;
	modelPath: string;
}

export interface QdrantConfig {
	host: string;
	port: number;
	apiKey: string | null;
	timeout: number;
}

export interface PathsInputConfig {
	documents: string;
	compose: string;
}

export interface PathsOutputConfig {
	dir: string;
	qdrant: string;
	pids: string;
}

export interface PathsDatabaseConfig {
	file: string;
}

export interface PathsConfig {
	input: PathsInputConfig;
	output: PathsOutputConfig;
	database: PathsDatabaseConfig;
}

export interface EmbeddingConfig {
	provider: 'ollama' | 'llama-cpp';
	model: string;
	fallbackModel: string;
	dimensions: number;
	instruction: string;
	batchSize: number;
	memoryThresholdGb: number;
	chunking: ChunkingConfig;
}

export type ChunkingStrategyName =
	| 'generic.hierarchical'
	| 'generic.fixed-window'
	| 'generic.paragraph'
	| 'aria.heading-enriched';

export interface ChunkingConfig {
	strategy: ChunkingStrategyName;
	'generic.hierarchical': GenericHierarchicalConfig;
	'aria.heading-enriched'?: AriaHeadingEnrichedConfig;
	metadataExtraction: MetadataExtractionConfig;
}

export type GenericHierarchicalConfig = HierarchicalChunkingConfig;

export interface HierarchicalChunkingConfig {
	primaryLevel: number;
	maxLevels: number[];
	maxTokens: number;
	minTokens: number;
	wholeDocumentThreshold: number;
	fallback: 'paragraph';
	preserve: string[];
	includeContext: boolean;
}

export interface AriaHeadingEnrichedConfig {
	calloutPattern: string;
	fields: AriaCalloutFields;
	enrichmentTemplate: string;
	maxTokens: number;
	minTokens: number;
	wholeDocumentThreshold: number;
	includeContext: boolean;
}

export interface AriaCalloutFields {
	identifier: MetadataPattern;
	description: MetadataPattern;
	priority: MetadataPattern;
	category: MetadataPattern;
	department: MetadataPattern;
	leader: MetadataPattern;
	customise: MetadataPattern;
}

export interface MetadataExtractionConfig {
	enabled: boolean;
	patterns: MetadataPattern[];
}

export interface MetadataPattern {
	regex: string;
	name: string;
	captureGroup: number;
	required?: boolean;
}

export interface SparseConfig {
	enabled: boolean;
	k1: number;
	b: number;
}

export interface RerankerConfig {
	provider: 'ollama' | 'llama-cpp';
	model: string;
	highMemoryModel: string;
	enabled: boolean;
	topK: number;
	finalK: number;
	autoSelectModel: boolean;
	memoryThresholdGb: number;
}

export interface SearchConfig {
	denseWeight: number;
	sparseWeight: number;
}

export interface LoggingConfig {
	level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
	verbose: boolean;
	file: string;
	maxFileSizeMb: number;
	maxFiles: number;
}

export interface DatabaseConfig {
	journalMode: string;
	backupCount: number;
}

export interface ProcessingConfig {
	batchSize: number;
	progressBar: boolean;
	parallelWorkers: number;
}

export interface ServicesConfig {
	autoStart: boolean;
	shutdownOnExit: boolean;
	startupTimeoutSeconds: number;
	healthCheckIntervalMs: number;
	docker: DockerConfig;
	llamaServer: LlamaServerConfig;
}

export interface DockerConfig {
	containerName: string;
}

export interface LlamaServerConfig {
	hostBinding: string;
	gpuLayers: number;
	disableLogging: boolean;
}

// =============================================================================
// TRANSFORMER - Convert snake_case YAML to camelCase config
// =============================================================================

function transformToConfig(yaml: VectorIndexerRiffConfig, logging: LoggingConfigType): VectorIndexerConfig {
	return {
		ollama: yaml.ollama,
		llamaCppEmbeddings: {
			host: yaml.llamaCppEmbeddings.host,
			timeout: yaml.llamaCppEmbeddings.timeout,
			modelPath: yaml.llamaCppEmbeddings.modelPath,
		},
		llamaCppReranker: {
			host: yaml.llamaCppReranker.host,
			timeout: yaml.llamaCppReranker.timeout,
			modelPath: yaml.llamaCppReranker.modelPath,
		},
		qdrant: {
			host: yaml.qdrant.host,
			port: yaml.qdrant.port,
			apiKey: yaml.qdrant.apiKey,
			timeout: yaml.qdrant.timeout,
		},
		paths: {
			input: {
				documents: yaml.paths.input.documents,
				compose: yaml.paths.input.compose,
			},
			output: {
				dir: yaml.paths.output.dir,
				qdrant: yaml.paths.output.qdrant,
				pids: yaml.paths.output.pids,
			},
			database: {
				file: yaml.paths.database.file,
			},
		},
		embedding: {
			provider: yaml.embedding.provider,
			model: yaml.embedding.model,
			fallbackModel: yaml.embedding.fallbackModel,
			dimensions: yaml.embedding.dimensions,
			instruction: yaml.embedding.instruction,
			batchSize: yaml.embedding.batchSize,
			memoryThresholdGb: yaml.embedding.memoryThresholdGb,
			chunking: transformChunking(yaml.embedding.chunking),
		},
		sparse: yaml.sparse,
		reranker: {
			provider: yaml.reranker.provider,
			model: yaml.reranker.model,
			highMemoryModel: yaml.reranker.highMemoryModel,
			enabled: yaml.reranker.enabled,
			topK: yaml.reranker.topK,
			finalK: yaml.reranker.finalK,
			autoSelectModel: yaml.reranker.autoSelectModel,
			memoryThresholdGb: yaml.reranker.memoryThresholdGb,
		},
		search: {
			denseWeight: yaml.search.denseWeight,
			sparseWeight: yaml.search.sparseWeight,
		},
		logging: {
			level: logging.level,
			verbose: logging.verbose,
			file: logging.file,
			maxFileSizeMb: logging.maxFileSizeMb,
			maxFiles: logging.maxFiles,
		},
		database: {
			journalMode: yaml.database.journalMode,
			backupCount: yaml.database.backupCount,
		},
		processing: {
			batchSize: yaml.processing.batchSize,
			progressBar: yaml.processing.progressBar,
			parallelWorkers: yaml.processing.parallelWorkers,
		},
		services: {
			autoStart: yaml.services.autoStart,
			shutdownOnExit: yaml.services.shutdownOnExit,
			startupTimeoutSeconds: yaml.services.startupTimeoutSeconds,
			healthCheckIntervalMs: yaml.services.healthCheckIntervalMs,
			docker: {
				containerName: yaml.services.docker.containerName,
			},
			llamaServer: {
				hostBinding: yaml.services.llamaServer.hostBinding,
				gpuLayers: yaml.services.llamaServer.gpuLayers,
				disableLogging: yaml.services.llamaServer.disableLogging,
			},
		},
	};
}

function transformChunking(yaml: z.infer<typeof ChunkingSchema>): ChunkingConfig {
	const genericHierarchical = yaml['generic.hierarchical'];
	const ariaHeadingEnriched = yaml['aria.heading-enriched'];

	return {
		strategy: yaml.strategy,
		'generic.hierarchical': genericHierarchical
			? {
					primaryLevel: genericHierarchical.primaryLevel,
					maxLevels: genericHierarchical.maxLevels,
					maxTokens: genericHierarchical.maxTokens,
					minTokens: genericHierarchical.minTokens,
					wholeDocumentThreshold: genericHierarchical.wholeDocumentThreshold,
					fallback: genericHierarchical.fallback,
					preserve: genericHierarchical.preserve,
					includeContext: genericHierarchical.includeContext,
				}
			: {
					primaryLevel: 2,
					maxLevels: [2, 3, 4],
					maxTokens: 512,
					minTokens: 50,
					wholeDocumentThreshold: 512,
					fallback: 'paragraph',
					preserve: ['```', '~~~'],
					includeContext: true,
				},
		...(ariaHeadingEnriched && {
			'aria.heading-enriched': {
				calloutPattern: ariaHeadingEnriched.calloutPattern,
				fields: transformAriaFields(ariaHeadingEnriched.fields),
				enrichmentTemplate: ariaHeadingEnriched.enrichmentTemplate,
				maxTokens: ariaHeadingEnriched.maxTokens,
				minTokens: ariaHeadingEnriched.minTokens,
				wholeDocumentThreshold: ariaHeadingEnriched.wholeDocumentThreshold,
				includeContext: ariaHeadingEnriched.includeContext,
			},
		}),
		metadataExtraction: {
			enabled: yaml.metadataExtraction?.enabled ?? true,
			patterns: (yaml.metadataExtraction?.patterns ?? []).map(p => ({
				regex: p.regex,
				name: p.name,
				captureGroup: p.captureGroup,
				required: p.required,
			})),
		},
	};
}

function transformAriaFields(fields: z.infer<typeof AriaCalloutFieldsSchema>): AriaCalloutFields {
	const transformField = (f: z.infer<typeof MetadataPatternSchema>): MetadataPattern => ({
		regex: f.regex,
		name: f.name,
		captureGroup: f.captureGroup,
		required: f.required,
	});

	return {
		identifier: transformField(fields.identifier),
		description: transformField(fields.description),
		priority: transformField(fields.priority),
		category: transformField(fields.category),
		department: transformField(fields.department),
		leader: transformField(fields.leader),
		customise: transformField(fields.customise),
	};
}

// =============================================================================
// ENVIRONMENT OVERRIDES
// =============================================================================

function applyEnvOverrides(config: VectorIndexerConfig): VectorIndexerConfig {
	// Ollama overrides
	if (process.env['VECTOR_INDEXER_OLLAMA_HOST']) {
		config.ollama.host = process.env['VECTOR_INDEXER_OLLAMA_HOST'];
	}
	if (process.env['VECTOR_INDEXER_OLLAMA_TIMEOUT']) {
		const timeout = parseInt(process.env['VECTOR_INDEXER_OLLAMA_TIMEOUT'], 10);
		if (!Number.isNaN(timeout)) config.ollama.timeout = timeout;
	}

	// Qdrant overrides
	if (process.env['VECTOR_INDEXER_QDRANT_HOST']) {
		config.qdrant.host = process.env['VECTOR_INDEXER_QDRANT_HOST'];
	}
	if (process.env['VECTOR_INDEXER_QDRANT_PORT']) {
		const port = parseInt(process.env['VECTOR_INDEXER_QDRANT_PORT'], 10);
		if (!Number.isNaN(port)) config.qdrant.port = port;
	}
	if (process.env['VECTOR_INDEXER_QDRANT_API_KEY']) {
		config.qdrant.apiKey = process.env['VECTOR_INDEXER_QDRANT_API_KEY'];
	}

	// Embedding overrides
	if (process.env['VECTOR_INDEXER_EMBEDDING_PROVIDER']) {
		const provider = process.env['VECTOR_INDEXER_EMBEDDING_PROVIDER'];
		if (provider === 'ollama' || provider === 'llama-cpp') {
			config.embedding.provider = provider;
		}
	}
	if (process.env['VECTOR_INDEXER_EMBEDDING_MODEL']) {
		config.embedding.model = process.env['VECTOR_INDEXER_EMBEDDING_MODEL'];
	}
	if (process.env['VECTOR_INDEXER_EMBEDDING_DIMENSIONS']) {
		const dims = parseInt(process.env['VECTOR_INDEXER_EMBEDDING_DIMENSIONS'], 10);
		if (!Number.isNaN(dims)) config.embedding.dimensions = dims;
	}

	// Reranker overrides
	if (process.env['VECTOR_INDEXER_RERANKER_ENABLED']) {
		config.reranker.enabled = process.env['VECTOR_INDEXER_RERANKER_ENABLED'] === 'true';
	}
	if (process.env['VECTOR_INDEXER_RERANKER_MODEL']) {
		config.reranker.model = process.env['VECTOR_INDEXER_RERANKER_MODEL'];
	}

	// Path overrides
	if (process.env['VECTOR_INDEXER_DB_PATH']) {
		config.paths.database.file = process.env['VECTOR_INDEXER_DB_PATH'];
	}
	if (process.env['VECTOR_INDEXER_QDRANT_STORAGE']) {
		config.paths.output.qdrant = process.env['VECTOR_INDEXER_QDRANT_STORAGE'];
	}

	// Logging overrides
	if (process.env['VECTOR_INDEXER_LOG_LEVEL']) {
		const level = process.env['VECTOR_INDEXER_LOG_LEVEL'].toLowerCase();
		if (['trace', 'debug', 'info', 'warn', 'error', 'fatal'].includes(level)) {
			config.logging.level = level as LoggingConfig['level'];
		}
	}
	if (process.env['VECTOR_INDEXER_LOG_VERBOSE']) {
		config.logging.verbose = process.env['VECTOR_INDEXER_LOG_VERBOSE'] === 'true';
	}
	if (process.env['VECTOR_INDEXER_LOG_FILE']) {
		config.logging.file = process.env['VECTOR_INDEXER_LOG_FILE'];
	}

	// Services overrides
	if (process.env['VECTOR_INDEXER_SERVICES_AUTO_START']) {
		config.services.autoStart = process.env['VECTOR_INDEXER_SERVICES_AUTO_START'] === 'true';
	}
	if (process.env['VECTOR_INDEXER_SERVICES_SHUTDOWN_ON_EXIT']) {
		config.services.shutdownOnExit = process.env['VECTOR_INDEXER_SERVICES_SHUTDOWN_ON_EXIT'] === 'true';
	}

	return config;
}

// =============================================================================
// LOADER - Tiered config: Defaults -> YAML -> Env vars
// =============================================================================

/**
 * Load configuration from YAML file with environment variable overrides
 */
export function loadConfig(configPath?: string): VectorIndexerConfig {
	loadDotEnv();
	const defaultPath = resolve(getRiffRoot(), 'config.yaml');
	const finalPath = configPath ?? defaultPath;
	const explicitPathProvided = configPath !== undefined;

	let yamlConfig: VectorIndexerRiffConfig;
	let loggingConfig: LoggingConfigType;

	if (!existsSync(finalPath)) {
		if (explicitPathProvided) {
			throw new ConfigError(`Config file not found: ${finalPath}`);
		}
		// Use defaults only
		yamlConfig = VectorIndexerRiffSchema.parse({});
		loggingConfig = LoggingConfigSchema.parse({});
	} else {
		try {
			const content = readFileSync(finalPath, 'utf-8');
			const parsed = parse(content);

			// Extract config from 'vector-indexer' root key
			const rawConfig = parsed['vector-indexer'];
			if (!rawConfig) {
				throw new ConfigError('Configuration must have a "vector-indexer" root key');
			}

			yamlConfig = VectorIndexerRiffSchema.parse(rawConfig);
			// Parse logging from peer section (or use defaults)
			loggingConfig = LoggingConfigSchema.parse(parsed['logging'] ?? {});
		} catch (error) {
			throw new ConfigError(
				`Failed to load config from ${finalPath}: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}

	// Transform snake_case to camelCase
	let config = transformToConfig(yamlConfig, loggingConfig);

	// Apply tilde expansion and environment variable overrides
	config = expandTildePaths(config);
	return applyEnvOverrides(config);
}

// =============================================================================
// CONFIG PATH EXPORT
// =============================================================================

export const configPath = resolve(getRiffRoot(), 'config.yaml');

/**
 * Get default configuration (for testing and fallback)
 */
export function getDefaultConfig(): VectorIndexerConfig {
	const yamlConfig = VectorIndexerRiffSchema.parse({});
	const loggingConfig = LoggingConfigSchema.parse({});
	return transformToConfig(yamlConfig, loggingConfig);
}
