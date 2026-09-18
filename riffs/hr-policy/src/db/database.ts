import * as fs from 'node:fs';
import path from 'node:path';
import Database from 'libsql';
import type { Database as DatabaseInterface, DocumentMetadata, SqliteConnection } from '../lib/types.js';

/**
 * Database manager implementation for document storage and indexing.
 * Uses libsql for synchronous, high-performance SQLite operations.
 * Not part of public API - use through DocIndexer instead.
 * @internal
 */
export class DatabaseManager implements DatabaseInterface {
	private dbFile: string;
	private db!: SqliteConnection;
	private useFts: boolean;

	constructor(dbFile: string, useFts = true) {
		this.dbFile = dbFile;
		this.useFts = useFts;
	}

	connect(): void {
		fs.mkdirSync(path.dirname(this.dbFile), { recursive: true });
		this.db = new Database(this.dbFile);
		this.initSchema();
	}

	private initSchema(): void {
		this.db.exec(`
            PRAGMA journal_mode=DELETE;
            CREATE TABLE IF NOT EXISTS documents (
                id TEXT PRIMARY KEY,
                content TEXT NOT NULL,
                embedding BLOB NOT NULL,
                metadata_json TEXT NOT NULL,
                parent_id TEXT,
                hierarchy_path TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_documents_parent_id ON documents(parent_id);
            ${this.useFts ? "CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(id UNINDEXED, text, hierarchy_path, tokenize='porter unicode61');" : ''}
        `);
	}

	reset(): void {
		if (this.useFts) {
			this.db.exec('DROP TABLE IF EXISTS documents_fts;');
		}
		this.db.exec('DELETE FROM documents;');
		this.initSchema();
	}

	withTransaction<T>(fn: (db: SqliteConnection) => T): T {
		const transaction = this.db.transaction(() => {
			return fn(this.db);
		});
		return transaction();
	}

	insertDocuments(
		ids: string[],
		contents: string[],
		embeddings: number[][],
		metadatas: DocumentMetadata[],
		embedTexts: string[],
		vectorToBuffer: (embedding: number[]) => Buffer,
		parentIds?: (string | null)[],
		hierarchyPaths?: (string | null)[]
	): void {
		const insertDoc = this.db.prepare(
			'INSERT OR REPLACE INTO documents (id, content, embedding, metadata_json, parent_id, hierarchy_path) VALUES (?,?,?,?,?,?)'
		);
		const insertFts = this.useFts
			? this.db.prepare('INSERT OR REPLACE INTO documents_fts (id, text, hierarchy_path) VALUES (?,?,?)')
			: null;

		const insertAll = this.db.transaction(() => {
			for (let i = 0; i < ids.length; i++) {
				const embedding = embeddings[i];
				if (embedding !== undefined) {
					const parentId = parentIds?.[i] ?? null;
					const hierarchyPath = hierarchyPaths?.[i] ?? null;
					insertDoc.run(
						ids[i],
						contents[i],
						vectorToBuffer(embedding),
						JSON.stringify(metadatas[i]),
						parentId,
						hierarchyPath
					);
					if (this.useFts && insertFts) {
						insertFts.run(ids[i], embedTexts[i], hierarchyPath);
					}
				}
			}
		});

		insertAll();
	}

	withConnection<T>(fn: (db: SqliteConnection) => T | Promise<T>): T | Promise<T> {
		this.connect();
		try {
			const result = fn(this.db);
			// Handle async callbacks - wait for Promise to resolve before closing
			if (result instanceof Promise) {
				return result.finally(() => this.close());
			}
			return result;
		} catch (error) {
			this.close();
			throw error;
		}
	}

	close(): void {
		if (this.db) {
			this.db.close();
		}
	}

	[Symbol.dispose](): void {
		this.close();
	}
}
