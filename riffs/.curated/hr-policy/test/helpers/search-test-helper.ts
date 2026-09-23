import { type DocIndexerConfig, DocIndexerImpl } from '../../src/core/indexer.js';
import { createLogger } from '../../src/lib/logger.js';
import type { DocIndexer, DocumentMetadata, Logger } from '../../src/lib/types.js';
import type { UnifiedEmbeddingConfig } from '../../src/providers/embedding-client.js';
import { MockDatabaseManager } from './mock-database-manager.js';
import { MockEmbeddingService } from './mock-embedding-service.js';

interface TestDocument {
	id: string;
	content: string;
	metadata: DocumentMetadata;
	embedding?: number[];
}

/**
 * Mock database for search testing.
 * Handles document queries and FTS simulations using libsql API style.
 */
class SearchMockDatabase {
	constructor(
		private documents: Map<string, TestDocument>,
		private embeddingService: MockEmbeddingService
	) {}

	prepare(query: string): SearchMockStatement {
		return new SearchMockStatement(query, this.documents, this.embeddingService);
	}

	exec(_sql: string): void {
		// Mock: simulate exec
	}

	close(): void {
		// Mock: simulate close
	}

	transaction<T>(fn: () => T): () => T {
		return fn;
	}
}

/**
 * Mock prepared statement that returns data based on query type.
 */
class SearchMockStatement {
	constructor(
		private query: string,
		private documents: Map<string, TestDocument>,
		private embeddingService: MockEmbeddingService
	) {}

	all(...params: unknown[]): unknown[] {
		// Handle FTS query for hybrid search
		if (this.query.includes('documents_fts')) {
			const queryText = (params[0] as string) ?? '';
			return this.filterDocumentsByQuery(queryText);
		}

		// Handle SELECT id, embedding FROM documents query (Pass 1: Semantic Search)
		if (this.query.includes('SELECT id, embedding FROM documents') && !this.query.includes('metadata_json')) {
			const results = Array.from(this.documents.values());
			return results.map(doc => ({
				id: doc.id,
				embedding: this.embeddingService.vectorToBuffer(doc.embedding ?? []),
			}));
		}

		// Handle SELECT documents query
		if (this.query.includes('SELECT id, embedding, metadata_json, content FROM documents')) {
			let results = Array.from(this.documents.values());

			// Handle WHERE id IN clause
			if (this.query.includes('WHERE id IN')) {
				const candidateIds = params as string[];
				results = results.filter(d => candidateIds.includes(d.id));
			}

			// Convert to database format
			return results
				.map(doc => ({
					id: doc.id,
					embedding: this.embeddingService.vectorToBuffer(doc.embedding ?? []),
					metadata_json: JSON.stringify(doc.metadata),
					content: doc.content,
				}))
				.sort();
		}

		// Handle PRAGMA database_list
		if (this.query.includes('PRAGMA database_list')) {
			return [{ seq: 0, name: 'main', file: '/tmp/test.db' }];
		}

		// Handle sqlite_master queries
		if (this.query.includes('sqlite_master')) {
			if (this.query.includes("name='documents'")) {
				return [{ name: 'documents' }];
			}
			if (this.query.includes("name='documents_fts'")) {
				return [{ name: 'documents_fts' }];
			}
		}

		// Handle table_info
		if (this.query.includes('PRAGMA table_info')) {
			return [
				{ name: 'id', type: 'TEXT' },
				{ name: 'content', type: 'TEXT' },
				{ name: 'embedding', type: 'BLOB' },
				{ name: 'metadata_json', type: 'TEXT' },
			];
		}

		// Handle COUNT queries
		if (this.query.includes('COUNT(*)')) {
			return [{ count: this.documents.size }];
		}

		return [];
	}

	get(...params: unknown[]): unknown | undefined {
		const results = this.all(...params);
		return results[0];
	}

	run(..._params: unknown[]): { changes: number; lastInsertRowid: number } {
		return { changes: 1, lastInsertRowid: 1 };
	}

	private filterDocumentsByQuery(queryText: string): Array<{ id: string; rank: number }> {
		const terms = queryText.toLowerCase().split(/\s+/);
		const results: Array<{ id: string; rank: number }> = [];

		for (const [id, doc] of this.documents) {
			const content = doc.content.toLowerCase();
			let score = 0;

			for (const term of terms) {
				if (content.includes(term)) {
					score += 1;
				}
			}

			if (score > 0) {
				results.push({ id, rank: -score }); // Negative so higher scores rank better
			}
		}

		return results.sort((a, b) => a.rank - b.rank); // Higher (less negative) first
	}
}

/**
 * Search test helper with setup functions for SearchService testing.
 * Provides methods to create configured DocIndexer instances and populate test data.
 */
export class SearchTestHelper {
	private logger: Logger;
	private documents: Map<string, TestDocument> = new Map();
	private embeddingService: MockEmbeddingService;

	constructor() {
		this.logger = createLogger({
			level: 'error',
			verbose: false,
			file: '.aria/logs/test/hr-policy-search.log',
		});
		this.embeddingService = new MockEmbeddingService(384);
	}

	/**
	 * Create a configured DocIndexer with mocked dependencies for search testing.
	 */
	createTestIndexer(configOverrides?: Partial<DocIndexerConfig>): DocIndexer {
		const embeddingConfig: UnifiedEmbeddingConfig = {
			model: 'mock-model',
			provider: 'ollama',
			dimensions: 384,
			endpoint: 'http://localhost:11434',
			keep_alive: undefined,
			timeout: 30000,
		};
		const config: DocIndexerConfig = {
			embeddingConfig,
			maxEmbedChars: 8192,
			sections: 'both',
			weightResponse: 1.0,
			useFts: true,
			hybrid: true,
			alpha: 0.5,
			showMetadata: true,
			highlight: true,
			snippetContextLines: 2,
			maxSnippetLength: 150,
			...configOverrides,
		};

		// Create mock database manager with search-aware database
		const dbManager = new MockDatabaseManager('/tmp/test-search.db', true);
		const searchDb = new SearchMockDatabase(this.documents, this.embeddingService);
		// Replace the mock database with our search-aware implementation
		dbManager.mockDb = searchDb as unknown as typeof dbManager.mockDb;

		// Create indexer with mocked dependencies
		// Mocks are structurally compatible with real dependencies
		const indexer = new DocIndexerImpl(
			this.logger,
			'/tmp/test-search.db',
			config,
			dbManager,
			this.embeddingService
		);

		return indexer;
	}

	/**
	 * Insert a test document into the helper's document store.
	 * Document will be returned by database queries.
	 */
	insertTestDocument(doc: TestDocument): void {
		// Generate embedding if not provided
		if (!doc.embedding) {
			doc.embedding = this.embeddingService.generateEmbedding(doc.content);
		}
		this.documents.set(doc.id, doc);
	}

	/**
	 * Insert multiple test documents.
	 */
	insertTestDocuments(docs: TestDocument[]): void {
		for (const doc of docs) {
			this.insertTestDocument(doc);
		}
	}

	/**
	 * Clear all test documents.
	 */
	clearDocuments(): void {
		this.documents.clear();
	}

	/**
	 * Create a test document with sensible defaults.
	 */
	static createTestDocument(id: string, content: string, metadata?: Partial<DocumentMetadata>): TestDocument {
		return {
			id,
			content,
			metadata: {
				id,
				title: `Test Document ${id}`,
				relative_path: `test/${id}.md`,
				full_path: `/tmp/test/${id}.md`,
				indexed_at: new Date().toISOString(),
				embedding_model: 'mock',
				dimensions: 384,
				...metadata,
			},
		};
	}
}
