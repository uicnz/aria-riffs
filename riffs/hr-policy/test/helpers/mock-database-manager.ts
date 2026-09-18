import type { Database, DocumentMetadata, SqliteConnection } from '../../src/lib/types.js';

/**
 * Mock database manager for testing.
 * Provides a minimal implementation that tracks calls without real database I/O.
 * Uses synchronous API matching libsql.
 */
export class MockDatabaseManager implements Database {
	private dbFile: string;
	private useFts: boolean;
	mockDb: MockDatabase;
	connectCalls = 0;
	closeCalls = 0;
	insertDocumentsCalls: Array<{
		ids: string[];
		contents: string[];
		embeddings: number[][];
		metadatas: DocumentMetadata[];
		embedTexts: string[];
	}> = [];

	constructor(dbFile: string, useFts = true) {
		this.dbFile = dbFile;
		this.useFts = useFts;
		this.mockDb = new MockDatabase();
	}

	connect(): void {
		this.connectCalls++;
	}

	initSchema(): void {}

	reset(): void {
		this.mockDb = new MockDatabase();
	}

	withTransaction<T>(fn: (db: SqliteConnection) => T): T {
		return fn(this.mockDb as unknown as SqliteConnection);
	}

	insertDocuments(
		ids: string[],
		contents: string[],
		embeddings: number[][],
		metadatas: DocumentMetadata[],
		embedTexts: string[],
		_vectorToBuffer: (embedding: number[]) => Buffer
	): void {
		this.insertDocumentsCalls.push({
			ids,
			contents,
			embeddings,
			metadatas,
			embedTexts,
		});
	}

	withConnection<T>(fn: (db: SqliteConnection) => T): T {
		this.connect();
		try {
			return fn(this.mockDb as unknown as SqliteConnection);
		} finally {
			this.close();
		}
	}

	close(): void {
		this.closeCalls++;
	}

	[Symbol.dispose](): void {
		this.close();
	}

	getDbFile(): string {
		return this.dbFile;
	}

	isUsingFts(): boolean {
		return this.useFts;
	}
}

/**
 * Mock database implementation.
 * Simulates libsql database interface for testing.
 */
class MockDatabase {
	prepare<T>(_query: string): MockStatement<T> {
		return new MockStatement<T>();
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
 * Mock prepared statement for testing database operations.
 * Simulates libsql statement interface.
 */
class MockStatement<T> {
	all(..._params: unknown[]): T[] {
		// Override in subclasses or use directly for specific testing scenarios
		return [] as T[];
	}

	get(..._params: unknown[]): T | undefined {
		return undefined;
	}

	run(..._params: unknown[]): { changes: number; lastInsertRowid: number } {
		return { changes: 0, lastInsertRowid: 0 };
	}
}
