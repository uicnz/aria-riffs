// Core types used across the application

import type LibSqlDatabase from 'libsql';

/**
 * Logger interface
 * Structured logging contract for debug, info, warn, and error levels
 */
export interface Logger {
	debug(context: Record<string, unknown>, message: string): void;
	info(context: Record<string, unknown>, message: string): void;
	warn(context: Record<string, unknown>, message: string): void;
	error(context: Record<string, unknown>, message: string): void;
}

/**
 * SQLite connection type for passing database connections through callbacks.
 * Uses libsql synchronous API for improved performance and reliability.
 */
export type SqliteConnection = LibSqlDatabase.Database;

/**
 * Database manager interface
 * Contract for database operations including transactions, schema management, and document operations.
 * Uses synchronous callbacks with libsql for improved performance.
 * Extends Disposable for proper resource cleanup.
 */
export interface Database extends Disposable {
	connect(): void;
	reset(): void;
	withTransaction<T>(fn: (db: SqliteConnection) => T): T;
	insertDocuments(
		ids: string[],
		contents: string[],
		embeddings: number[][],
		metadatas: DocumentMetadata[],
		embedTexts: string[],
		vectorToBuffer: (embedding: number[]) => Buffer,
		parentIds?: (string | null)[],
		hierarchyPaths?: (string | null)[]
	): void;
	withConnection<T>(fn: (db: SqliteConnection) => T | Promise<T>): T | Promise<T>;
	close(): void;
}

/**
 * Embedding provider interface
 * Contract for embedding operations supporting multiple providers (OpenAI, Gemini, Ollama)
 */
export interface EmbeddingProvider {
	embedAll(texts: string[]): Promise<number[][]>;
	embedSingle(text: string): Promise<number[]>;
	vectorToBuffer(vec: number[]): Buffer;
	bufferToVector(buf: Buffer | Uint8Array | ArrayBuffer): Float32Array;
	cosineSimilarity(a: number[] | Float32Array, b: number[] | Float32Array): number;
	getModelName(): string;
	getDimensions(): number;
	getProvider(): string;
}

/**
 * Document indexer interface
 * Contract for document indexing operations with database access and embedding integration
 */
export interface DocIndexer {
	index(directory: string, reset: boolean): Promise<void>;
	withDatabase<T>(fn: (db: SqliteConnection) => T | Promise<T>): T | Promise<T>;
	getEmbeddingService(): EmbeddingProvider;
	getConfig(): IndexerConfig;
}

/**
 * Search service interface
 * Contract for search operations over indexed documents
 */
export interface SearchService {
	search(query: string, nResults?: number, opts?: SearchOptions, db?: SqliteConnection): Promise<SearchResult[]>;
}

export interface DocumentMetadata {
	id: string;
	title?: string;
	relative_path: string;
	full_path: string;
	source_path?: string; // Original source file path from frontmatter, or document path if no frontmatter
	source_lines?: [number, number]; // Line range [start, end] from frontmatter
	indexed_at: string; // ISO string
	embedding_model: string;
	dimensions: number;
}

// Configuration types
export type SectionsMode = 'response' | 'request' | 'both' | 'full';

export interface IndexerConfig {
	logging?: {
		level?: string; // DEBUG, INFO, WARN, ERROR
		verbose?: boolean;
		file?: string;
		maxFileSizeMb?: number;
		maxFiles?: number;
	}; // Logging configuration
	tui?: {
		theme?: string;
	}; // TUI configuration
	model: string;
	dimensions: number;
	maxEmbedChars: number;
	sections: SectionsMode;
	weightResponse: number; // >1 biases embeddings toward Response
	useFts: boolean; // create/populate FTS5 table at index time
	hybrid: boolean; // default hybrid search behavior
	alpha: number; // lexical weight when hybrid=true (0..1)
	pathWeight: number; // path relevance weight when hybrid=true (0..1), default 0.15
	showMetadata: boolean; // pretty output default
	highlight: boolean; // pretty output default
	snippetContextLines: number; // lines before/after matches in snippet (default: 2)
	maxSnippetLength: number; // max characters to display in snippet (default: 150)
	// NOTE: highlightColor removed - TUI uses semantic theme colors, CLI uses Pino
}

// Frontmatter metadata from decomposed sections
export interface FrontmatterData {
	source_file: string; // Original source file path
	source_section: string; // Section name (e.g., "Health Insurance")
	section_index: number; // Section numbering (0 for intro, 1+ for sections)
	line_range: [number, number]; // Line range in source file [start, end]
	decomposed_at: string; // ISO 8601 timestamp
	original_heading: string; // Original markdown heading with prefix
	boundary_type?: 'primary' | 'fallback' | undefined; // How section was detected
}

// Search result snippet type
export interface SearchResultSnippet {
	text: string; // The extracted snippet text
	startLine: number; // Line number where snippet begins (1-indexed)
	endLine: number; // Line number where snippet ends (1-indexed)
	matchStartCol: number; // Column position of first match (0-indexed)
	matchEndCol: number; // Column position of last match (0-indexed)
	matchIndices: Array<{ start: number; end: number }>; // Positions of all matches within snippet
}

// Search result types
export interface SearchResult {
	id: string;
	score: number;
	sem_score: number;
	lex_score: number;
	path_score: number; // Path relevance score (0-1)
	metadata: DocumentMetadata;
	content: string;
	snippet?: SearchResultSnippet;
	frontmatter?: FrontmatterData; // Extracted from YAML frontmatter in content
}

export interface SearchOptions {
	hybrid?: boolean;
	alpha?: number;
	includeContent?: boolean;
}

// Decomposer types
export type BoundaryType = 'primary' | 'fallback';

export interface SectionMetadata {
	source_file: string;
	source_section: string;
	section_index: number; // Assigned by processSections (initial: -1)
	line_range: [number, number];
	decomposed_at: string;
	original_heading: string;
	boundary_type?: BoundaryType; // Set by decomposeDocument, used by processSections
}

export interface Section {
	heading: string;
	content: string;
	metadata: SectionMetadata;
	filename?: string; // Assigned by processSections (e.g., "00-intro.md", "01-section.md")
}

// Event emitted by decomposeDocument generator
export interface DecomposeEvent {
	section: Section;
	boundaryChange: boolean; // true when transitioning from fallback to primary
	boundaryType?: BoundaryType; // current boundary mode ('primary' or 'fallback')
}

export interface DecomposerConfig {
	primaryPattern: string; // Regex for primary boundaries
	fallbackPattern: string; // Regex for fallback boundaries
	inputDirectory: string; // Input directory for batch processing (from paths.input.policies)
	outputDirectory: string; // Output directory for decomposed sections (from paths.output.sections)
	filePatterns: string[]; // Glob patterns for file matching (e.g., ['*.md', '**/*.md'])
}
