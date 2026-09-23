/**
 * SQLite database operations for Hr Staffer data
 */

import fs from 'node:fs';
import path from 'node:path';
import Database from 'libsql';
import type { Employee } from '../lib/types.js';

/**
 * SQLite database handler for organizational data
 */
// TODO most of the methods in this class are unused. cli.ts only uses: initialize(), close(), upsertEmployees(), recordImport().
export class HrStafferDatabase {
	private db: Database.Database | null = null;
	private dbPath: string;

	constructor(dbPath: string) {
		this.dbPath = dbPath;
	}

	/**
	 * Initialize database connection and create tables
	 */
	initialize(): void {
		// Ensure directory exists
		const dir = path.dirname(this.dbPath);
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}

		this.db = new Database(this.dbPath);

		// Enable WAL mode for better concurrent access
		this.db.pragma('journal_mode = WAL');

		// Create employees table
		this.db.exec(`
            CREATE TABLE IF NOT EXISTS employees (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                display_name TEXT NOT NULL UNIQUE,
                first_name TEXT NOT NULL,
                last_name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                title TEXT NOT NULL,
                department TEXT NOT NULL,
                manager TEXT NOT NULL,
                mobile TEXT NOT NULL,
                street_address TEXT NOT NULL,
                city TEXT NOT NULL,
                country TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_display_name ON employees(display_name);
            CREATE INDEX IF NOT EXISTS idx_email ON employees(email);
            CREATE INDEX IF NOT EXISTS idx_manager ON employees(manager);
            CREATE INDEX IF NOT EXISTS idx_department ON employees(department);
            CREATE INDEX IF NOT EXISTS idx_title ON employees(title);

            -- Metadata table for tracking imports
            CREATE TABLE IF NOT EXISTS import_metadata (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source_file TEXT NOT NULL,
                import_date TEXT NOT NULL,
                employee_count INTEGER NOT NULL,
                tree_depth INTEGER NOT NULL
            );
        `);
	}

	/**
	 * Close database connection
	 */
	close(): void {
		if (this.db) {
			this.db.close();
			this.db = null;
		}
	}

	/**
	 * Insert or update multiple employee records in a transaction
	 */
	upsertEmployees(employees: Employee[]): void {
		if (!this.db) {
			throw new Error('Database not initialized. Call initialize() first.');
		}

		const db = this.db;
		const upsert = db.transaction((emps: Employee[]) => {
			const stmt = db.prepare(`
                INSERT INTO employees (
                    display_name, first_name, last_name, email, title, department,
                    manager, mobile, street_address, city, country
                ) VALUES (
                    @displayName, @firstName, @lastName, @email, @title, @department,
                    @manager, @mobile, @streetAddress, @city, @country
                )
                ON CONFLICT(display_name) DO UPDATE SET
                    first_name = excluded.first_name,
                    last_name = excluded.last_name,
                    email = excluded.email,
                    title = excluded.title,
                    department = excluded.department,
                    manager = excluded.manager,
                    mobile = excluded.mobile,
                    street_address = excluded.street_address,
                    city = excluded.city,
                    country = excluded.country,
                    updated_at = CURRENT_TIMESTAMP
            `);

			for (const employee of emps) {
				stmt.run(employee);
			}
		});

		upsert(employees);
	}

	/**
	 * Record import metadata
	 */
	recordImport(sourceFile: string, employeeCount: number, treeDepth: number): void {
		if (!this.db) {
			throw new Error('Database not initialized. Call initialize() first.');
		}

		const stmt = this.db.prepare(`
            INSERT INTO import_metadata (source_file, import_date, employee_count, tree_depth)
            VALUES (?, datetime('now'), ?, ?)
        `);

		stmt.run(sourceFile, employeeCount, treeDepth);
	}

	/**
	 * Load all employee records from database.
	 * This is unused by the application but retained for integration tests.
	 */
	loadEmployees(): Employee[] {
		if (!this.db) {
			throw new Error('Database not initialized. Call initialize() first.');
		}

		const stmt = this.db.prepare(`
            SELECT
                display_name as displayName,
                first_name as firstName,
                last_name as lastName,
                email,
                title,
                department,
                manager,
                mobile,
                street_address as streetAddress,
                city,
                country
            FROM employees
            ORDER BY display_name
        `);

		return stmt.all() as Employee[];
	}

	/**
	 * Initialize document tables for indexing.
	 * Creates documents, documents_fts (FTS5), and index_metadata tables.
	 */
	initDocumentTables(options: { useFts?: boolean } = {}): void {
		if (!this.db) {
			throw new Error('Database not initialized. Call initialize() first.');
		}

		const { useFts = true } = options;

		this.db.exec(`
            CREATE TABLE IF NOT EXISTS documents (
                id TEXT PRIMARY KEY,
                content TEXT NOT NULL,
                embedding BLOB NOT NULL,
                metadata_json TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS index_metadata (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source_file TEXT NOT NULL,
                index_date TEXT NOT NULL,
                section_count INTEGER NOT NULL,
                embedding_model TEXT NOT NULL
            );
        `);

		if (useFts) {
			this.db.exec(`
                CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts
                    USING fts5(id UNINDEXED, text, tokenize='porter unicode61');
            `);
		}
	}

	/**
	 * Check if a table exists in the database.
	 */
	tableExists(tableName: string): boolean {
		if (!this.db) {
			throw new Error('Database not initialized. Call initialize() first.');
		}

		const stmt = this.db.prepare(`SELECT name FROM sqlite_master WHERE type IN ('table', 'view') AND name = ?`);
		const result = stmt.get(tableName);
		return result !== undefined;
	}

	/**
	 * Insert a document into the documents table.
	 */
	insertDocument(id: string, content: string, embedding: Float32Array, metadata: Record<string, unknown>): void {
		if (!this.db) {
			throw new Error('Database not initialized. Call initialize() first.');
		}

		const embeddingBuffer = Buffer.from(embedding.buffer);
		const metadataJson = JSON.stringify(metadata);

		const stmt = this.db.prepare(`
            INSERT INTO documents (id, content, embedding, metadata_json)
            VALUES (?, ?, ?, ?)
        `);
		stmt.run(id, content, embeddingBuffer, metadataJson);
	}

	/**
	 * Get a document by ID.
	 */
	getDocument(id: string): { id: string; content: string } | undefined {
		if (!this.db) {
			throw new Error('Database not initialized. Call initialize() first.');
		}

		const stmt = this.db.prepare(`SELECT id, content FROM documents WHERE id = ?`);
		return stmt.get(id) as { id: string; content: string } | undefined;
	}

	/**
	 * Get the count of documents in the database.
	 */
	getDocumentCount(): number {
		if (!this.db) {
			throw new Error('Database not initialized. Call initialize() first.');
		}

		const stmt = this.db.prepare(`SELECT COUNT(*) as count FROM documents`);
		const result = stmt.get() as { count: number };
		return result.count;
	}

	/**
	 * Insert a document into the FTS index.
	 */
	insertDocumentFts(id: string, text: string): void {
		if (!this.db) {
			throw new Error('Database not initialized. Call initialize() first.');
		}

		const stmt = this.db.prepare(`INSERT INTO documents_fts (id, text) VALUES (?, ?)`);
		stmt.run(id, text);
	}

	/**
	 * Search FTS index for matching documents.
	 * Returns documents with BM25 ranking score.
	 * Supports OR queries for broader matching.
	 */
	searchFts(query: string): Array<{ id: string; rank: number }> {
		if (!this.db) {
			throw new Error('Database not initialized. Call initialize() first.');
		}

		const stmt = this.db.prepare(`
            SELECT id, bm25(documents_fts) AS rank
            FROM documents_fts
            WHERE documents_fts MATCH ?
            ORDER BY rank
            LIMIT 200
        `);
		return stmt.all(query) as Array<{ id: string; rank: number }>;
	}

	/**
	 * Search FTS index with OR query for broader matching.
	 * Joins terms with OR to find documents containing any term.
	 */
	searchFtsOr(terms: string[]): Array<{ id: string; rank: number }> {
		if (!this.db) {
			throw new Error('Database not initialized. Call initialize() first.');
		}

		if (terms.length === 0) return [];

		// Build OR query: "term1 OR term2 OR term3"
		const orQuery = terms.map(t => `"${t}"`).join(' OR ');

		const stmt = this.db.prepare(`
            SELECT id, bm25(documents_fts) AS rank
            FROM documents_fts
            WHERE documents_fts MATCH ?
            ORDER BY rank
            LIMIT 200
        `);
		return stmt.all(orQuery) as Array<{ id: string; rank: number }>;
	}

	/**
	 * Search FTS index with phrase proximity (NEAR).
	 * Finds documents where terms appear close together.
	 */
	searchFtsPhrase(terms: string[], distance: number = 5): Array<{ id: string; rank: number }> {
		if (!this.db) {
			throw new Error('Database not initialized. Call initialize() first.');
		}

		if (terms.length < 2) return this.searchFts(terms.join(' '));

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
			// Fall back to regular OR query if NEAR fails
			return this.searchFtsOr(terms);
		}
	}

	/**
	 * Clear all documents from the documents table.
	 * Also clears documents_fts if it exists.
	 */
	resetDocuments(): void {
		if (!this.db) {
			throw new Error('Database not initialized. Call initialize() first.');
		}

		this.db.exec(`DELETE FROM documents`);

		// Clear FTS table if it exists
		if (this.tableExists('documents_fts')) {
			this.db.exec(`DELETE FROM documents_fts`);
		}
	}

	/**
	 * Record index metadata after indexing.
	 */
	recordIndexMetadata(sourceFile: string, sectionCount: number, embeddingModel: string): void {
		if (!this.db) {
			throw new Error('Database not initialized. Call initialize() first.');
		}

		const stmt = this.db.prepare(`
            INSERT INTO index_metadata (source_file, index_date, section_count, embedding_model)
            VALUES (?, datetime('now'), ?, ?)
        `);
		stmt.run(sourceFile, sectionCount, embeddingModel);
	}

	/**
	 * Get the latest index metadata entry.
	 */
	getLatestIndexMetadata():
		| {
				source_file: string;
				index_date: string;
				section_count: number;
				embedding_model: string;
		  }
		| undefined {
		if (!this.db) {
			throw new Error('Database not initialized. Call initialize() first.');
		}

		const stmt = this.db.prepare(`
            SELECT source_file, index_date, section_count, embedding_model
            FROM index_metadata
            ORDER BY id DESC
            LIMIT 1
        `);
		return stmt.get() as
			| {
					source_file: string;
					index_date: string;
					section_count: number;
					embedding_model: string;
			  }
			| undefined;
	}

	/**
	 * Get table column info for testing schema.
	 */
	getTableInfo(tableName: string): Array<{ name: string; type: string }> {
		if (!this.db) {
			throw new Error('Database not initialized. Call initialize() first.');
		}

		const stmt = this.db.prepare(`PRAGMA table_info(${tableName})`);
		return stmt.all() as Array<{ name: string; type: string }>;
	}

	/**
	 * Get all documents with their embeddings and metadata.
	 * Used for semantic search scoring.
	 */
	getAllDocuments(): Array<{
		id: string;
		content: string;
		embedding: Buffer;
		metadata_json: string;
	}> {
		if (!this.db) {
			throw new Error('Database not initialized. Call initialize() first.');
		}

		const stmt = this.db.prepare(`SELECT id, content, embedding, metadata_json FROM documents`);
		return stmt.all() as Array<{
			id: string;
			content: string;
			embedding: Buffer;
			metadata_json: string;
		}>;
	}
}
