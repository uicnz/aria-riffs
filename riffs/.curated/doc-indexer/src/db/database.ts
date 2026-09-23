import * as fs from 'node:fs';
import path from 'node:path';
import Database from 'libsql';

export class DatabaseManager {
	private dbFile: string;
	private db!: Database.Database;
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

	initSchema(): void {
		this.db.exec(`
            PRAGMA journal_mode=DELETE;
            CREATE TABLE IF NOT EXISTS documents (
                id TEXT PRIMARY KEY,
                content TEXT NOT NULL,
                embedding BLOB NOT NULL,
                metadata_json TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_meta_identifier ON documents((json_extract(metadata_json,'$.identifier')));
            CREATE INDEX IF NOT EXISTS idx_meta_category ON documents((json_extract(metadata_json,'$.category')));
            CREATE INDEX IF NOT EXISTS idx_meta_department ON documents((json_extract(metadata_json,'$.department')));
            ${this.useFts ? "CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(id UNINDEXED, text, tokenize='porter unicode61');" : ''}

            -- Full RFP (FTS-only) storage
            CREATE TABLE IF NOT EXISTS full_docs (
                id TEXT PRIMARY KEY,
                file TEXT NOT NULL,
                content TEXT NOT NULL
            );
            ${this.useFts ? "CREATE VIRTUAL TABLE IF NOT EXISTS full_docs_fts USING fts5(id UNINDEXED, file UNINDEXED, text, tokenize='porter unicode61');" : ''}
        `);
	}

	reset(): void {
		if (this.useFts) {
			this.db.exec('DROP TABLE IF EXISTS documents_fts;');
			this.db.exec('DROP TABLE IF EXISTS full_docs_fts;');
		}
		this.db.exec('DELETE FROM documents;');
		this.db.exec('DELETE FROM full_docs;');
		this.initSchema();
	}

	getDb(): Database.Database {
		return this.db;
	}

	close(): void {
		if (this.db) {
			this.db.close();
		}
	}

	/**
	 * Search FTS index with OR query for broader matching.
	 * Joins terms with OR to find documents containing any term.
	 */
	searchFtsOr(terms: string[]): Array<{ id: string; rank: number }> {
		if (!this.useFts || terms.length === 0) return [];

		// Build OR query: "term1" OR "term2" OR "term3"
		const orQuery = terms.map(t => `"${t}"`).join(' OR ');

		try {
			const stmt = this.db.prepare(`
                SELECT id, bm25(documents_fts) AS rank
                FROM documents_fts
                WHERE documents_fts MATCH ?
                ORDER BY rank
                LIMIT 200
            `);
			return stmt.all(orQuery) as Array<{ id: string; rank: number }>;
		} catch {
			return [];
		}
	}

	/**
	 * Search FTS index with phrase proximity (NEAR).
	 * Finds documents where terms appear close together.
	 */
	searchFtsPhrase(terms: string[], distance: number = 5): Array<{ id: string; rank: number }> {
		if (!this.useFts || terms.length < 2) {
			return terms.length > 0 ? this.searchFtsOr(terms) : [];
		}

		// Build NEAR query: NEAR(term1 term2, 5)
		const nearQuery = `NEAR(${terms.join(' ')}, ${distance})`;

		try {
			const stmt = this.db.prepare(`
                SELECT id, bm25(documents_fts) AS rank
                FROM documents_fts
                WHERE documents_fts MATCH ?
                ORDER BY rank
                LIMIT 200
            `);
			return stmt.all(nearQuery) as Array<{ id: string; rank: number }>;
		} catch {
			// Fall back to OR query if NEAR fails
			return this.searchFtsOr(terms);
		}
	}

	/**
	 * Get all documents for semantic search scoring.
	 */
	getAllDocuments(): Array<{
		id: string;
		content: string;
		embedding: Buffer;
		metadata_json: string;
	}> {
		const stmt = this.db.prepare(`SELECT id, content, embedding, metadata_json FROM documents`);
		return stmt.all() as Array<{
			id: string;
			content: string;
			embedding: Buffer;
			metadata_json: string;
		}>;
	}
}
