/**
 * Type definitions for vector-indexer
 * All shared interfaces and types
 */

// Import config types for internal use
import type { ChunkingStrategyName as _ChunkingStrategyName } from './config.js';

// Re-export config types from config.ts (single source of truth)
export type {
	AriaCalloutFields,
	AriaHeadingEnrichedConfig,
	ChunkingConfig,
	ChunkingStrategyName,
	DatabaseConfig,
	DockerConfig,
	EmbeddingConfig,
	GenericHierarchicalConfig,
	HierarchicalChunkingConfig,
	LlamaCppConfig,
	LlamaServerConfig,
	LoggingConfig,
	MetadataExtractionConfig,
	MetadataPattern,
	OllamaConfig,
	PathsConfig,
	PathsDatabaseConfig,
	PathsInputConfig,
	PathsOutputConfig,
	ProcessingConfig,
	QdrantConfig,
	RerankerConfig,
	SearchConfig,
	ServicesConfig,
	SparseConfig,
	VectorIndexerConfig,
} from './config.js';

// Use alias for internal use in this file
type ChunkingStrategyName = _ChunkingStrategyName;

// Document and chunk types
export interface Document {
	id: string;
	path: string;
	content: string;
	metadata: Record<string, unknown>;
}

export interface Chunk {
	id: string;
	documentId: string;
	level: number;
	heading: string;
	content: string;
	context: string[];
	tokens: number;
	metadata: Record<string, unknown>;
}

export interface MarkdownSection {
	level: number;
	heading: string;
	content: string;
	tokens: number;
	subsections: MarkdownSection[];
	parent?: MarkdownSection;
}

// Vector types
export interface SparseVector {
	indices: number[];
	values: number[];
}

export interface Point {
	id: string;
	vector: number[];
	sparseVector?: SparseVector;
	payload: Record<string, unknown>;
}

// Search types
export interface SearchOptions {
	collection: string;
	topK: number;
	finalK: number;
	denseWeight: number;
	sparseWeight: number;
	rerank: boolean;
	rerankerModel?: string;
	filter?: Record<string, unknown>;
}

export interface SearchResult {
	id: string;
	score: number;
	content: string;
	metadata: Record<string, unknown>;
}

export interface RerankResult {
	index: number;
	score: number;
	content: string;
	metadata: Record<string, unknown>;
}

// Index types
export interface IndexOptions {
	collection: string;
	directory: string;
	dimensions?: number;
	chunkSize?: number;
	configPath?: string;
	/** Skip Qdrant operations and embedding generation for testing UI */
	dryRun?: boolean;
	/** Called after file scan completes, before processing begins */
	onScanComplete?: (fileCount: number) => void;
	/** Called after each file is processed */
	onFileProgress?: (current: number, total: number, filePath: string) => void;
}

export interface IndexStats {
	documentsProcessed: number;
	chunksCreated: number;
	totalTokens: number;
	errors: string[];
	duration: number;
	successRate: number;
}

// Collection types
export interface CollectionConfig {
	name: string;
	dimensions: number;
	sparse: boolean;
	distance: 'Cosine' | 'Euclid' | 'Dot';
}

export interface CollectionInfo {
	name: string;
	pointsCount: number;
	vectorsCount: number;
	status: string;
}

// Collection metadata stored as special point in Qdrant
export interface CollectionMetadata {
	_isMetadata: true; // Marker to filter from search results
	strategyName: ChunkingStrategyName;
	strategyConfig: Record<string, unknown>; // JSON snapshot of strategy config
	createdAt: string; // ISO timestamp
	lastIndexedAt?: string; // ISO timestamp
	documentCount: number;
	chunkCount: number;
}

// Provider types

// Provider interfaces for abstraction
export interface IEmbeddingProvider {
	embed(text: string, options?: EmbeddingOptions): Promise<EmbeddingResult>;
	embedBatch(texts: string[], options?: EmbeddingOptions): Promise<EmbeddingResult[]>;
	checkModelAvailable?(model: string): Promise<boolean>;
	selectBestModel?(): Promise<string>;
}

export interface IRerankerProvider {
	rerank(
		query: string,
		documents: Array<{ content: string; metadata: Record<string, unknown> }>,
		options?: RerankOptions
	): Promise<RerankResult[]>;
	selectBestModel?(): Promise<string>;
}

export interface EmbeddingOptions {
	model?: string;
	dimensions?: number;
	instruction?: string;
}

export interface EmbeddingResult {
	embedding: number[];
	tokens: number;
}

export interface RerankOptions {
	model?: string;
	topK: number;
}

export interface HybridQuery {
	denseVector: number[];
	sparseVector: SparseVector;
	denseWeight: number;
	sparseWeight: number;
	limit: number;
	filter?: Record<string, unknown>;
}

// File scanning types
export interface ScanOptions {
	patterns: string[];
	ignore: string[];
	maxFileSize?: number;
}

export interface ScannedFile {
	path: string;
	relativePath: string;
	content: string;
	size: number;
	modifiedAt: Date;
}

// Shutdown types
export interface ShutdownOptions {
	all?: boolean;
	docker?: boolean;
	llama?: boolean;
	service?: string;
	force?: boolean; // Override shutdownOnExit config
}
