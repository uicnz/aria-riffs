/**
 * SQLite database manager for mindmap records
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import Database from 'libsql';
import { type DatabaseConfig, DatabaseError, type MindmapRecord } from '../lib/types.js';

export class DatabaseManager {
	private dbPath: string;
	private tableName: string;
	private journalMode: string;
	private db: Database.Database | null = null;

	constructor(config: DatabaseConfig, dbFilePath?: string) {
		this.dbPath = dbFilePath ?? '';
		this.tableName = config.tableName;
		this.journalMode = config.journalMode;

		if (!path.isAbsolute(this.dbPath)) {
			this.dbPath = path.resolve(this.dbPath);
		}
	}

	private async initializeDatabase(): Promise<void> {
		try {
			// Ensure directory exists
			const dir = path.dirname(this.dbPath);
			await fs.mkdir(dir, { recursive: true });

			this.db = new Database(this.dbPath);
			this.db.pragma(`journal_mode = ${this.journalMode}`);

			// Create mindmaps table
			this.db.exec(`
                CREATE TABLE IF NOT EXISTS ${this.tableName} (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    file_path TEXT NOT NULL UNIQUE,
                    format TEXT NOT NULL,
                    title TEXT,
                    node_count INTEGER NOT NULL,
                    content_json TEXT NOT NULL,
                    converted_path TEXT,
                    status TEXT DEFAULT 'pending',
                    error_message TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

			// Create indexes
			this.db.exec(`
                CREATE INDEX IF NOT EXISTS idx_file_path ON ${this.tableName}(file_path)
            `);

			this.db.exec(`
                CREATE INDEX IF NOT EXISTS idx_status ON ${this.tableName}(status)
            `);

			this.db.exec(`
                CREATE INDEX IF NOT EXISTS idx_format ON ${this.tableName}(format)
            `);

			this.db.exec(`
                CREATE INDEX IF NOT EXISTS idx_title ON ${this.tableName}(title)
            `);
		} catch (error) {
			throw new DatabaseError(`Failed to initialize database: ${error}`);
		}
	}

	private async getConnection(): Promise<Database.Database> {
		if (!this.db) {
			await this.initializeDatabase();
		}
		if (!this.db) {
			throw new DatabaseError('Failed to initialize database connection');
		}
		return this.db;
	}

	/**
	 * Save or update a mindmap record
	 */
	async saveMindmap(record: Omit<MindmapRecord, 'id' | 'created_at' | 'updated_at'>): Promise<void> {
		try {
			const db = await this.getConnection();
			const normalizedPath = path.resolve(record.file_path);

			const stmt = db.prepare(`
                INSERT INTO ${this.tableName} (
                    file_path, format, title, node_count, content_json,
                    converted_path, status, error_message
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(file_path) DO UPDATE SET
                    format = excluded.format,
                    title = excluded.title,
                    node_count = excluded.node_count,
                    content_json = excluded.content_json,
                    converted_path = excluded.converted_path,
                    status = excluded.status,
                    error_message = excluded.error_message,
                    updated_at = CURRENT_TIMESTAMP
            `);

			stmt.run(
				normalizedPath,
				record.format,
				record.title || null,
				record.node_count,
				record.content_json,
				record.converted_path || null,
				record.status,
				record.error_message || null
			);
		} catch (error) {
			throw new DatabaseError(`Failed to save mindmap: ${error}`);
		}
	}

	/**
	 * Get a mindmap record by file path
	 */
	async getMindmap(filePath: string): Promise<MindmapRecord | null> {
		try {
			const db = await this.getConnection();
			const normalizedPath = path.resolve(filePath);

			const stmt = db.prepare(`
                SELECT * FROM ${this.tableName}
                WHERE file_path = ?
            `);

			const row = stmt.get(normalizedPath) as MindmapRecord | undefined;
			return row || null;
		} catch (error) {
			throw new DatabaseError(`Failed to get mindmap: ${error}`);
		}
	}

	/**
	 * Get all mindmap records
	 */
	async getAllMindmaps(): Promise<MindmapRecord[]> {
		try {
			const db = await this.getConnection();

			const stmt = db.prepare(`
                SELECT * FROM ${this.tableName}
                ORDER BY updated_at DESC
            `);

			const rows = stmt.all() as MindmapRecord[];
			return rows;
		} catch (error) {
			throw new DatabaseError(`Failed to get all mindmaps: ${error}`);
		}
	}

	/**
	 * Search mindmaps by title or content
	 */
	async searchMindmaps(query: string): Promise<MindmapRecord[]> {
		try {
			const db = await this.getConnection();

			const stmt = db.prepare(`
                SELECT * FROM ${this.tableName}
                WHERE title LIKE ? OR content_json LIKE ?
                ORDER BY updated_at DESC
            `);

			const searchPattern = `%${query}%`;
			const rows = stmt.all(searchPattern, searchPattern) as MindmapRecord[];
			return rows;
		} catch (error) {
			throw new DatabaseError(`Failed to search mindmaps: ${error}`);
		}
	}

	/**
	 * Get records by status
	 */
	async getMindmapsByStatus(status: 'pending' | 'completed' | 'failed'): Promise<MindmapRecord[]> {
		try {
			const db = await this.getConnection();

			const stmt = db.prepare(`
                SELECT * FROM ${this.tableName}
                WHERE status = ?
                ORDER BY updated_at DESC
            `);

			const rows = stmt.all(status) as MindmapRecord[];
			return rows;
		} catch (error) {
			throw new DatabaseError(`Failed to get mindmaps by status: ${error}`);
		}
	}

	/**
	 * Get database statistics
	 */
	async getStats(): Promise<{
		total: number;
		pending: number;
		completed: number;
		failed: number;
		byFormat: { opml: number; mm: number };
	}> {
		try {
			const db = await this.getConnection();

			const total = db.prepare(`SELECT COUNT(*) as count FROM ${this.tableName}`).get() as { count: number };
			const pending = db
				.prepare(`SELECT COUNT(*) as count FROM ${this.tableName} WHERE status = 'pending'`)
				.get() as { count: number };
			const completed = db
				.prepare(`SELECT COUNT(*) as count FROM ${this.tableName} WHERE status = 'completed'`)
				.get() as { count: number };
			const failed = db
				.prepare(`SELECT COUNT(*) as count FROM ${this.tableName} WHERE status = 'failed'`)
				.get() as { count: number };
			const opml = db.prepare(`SELECT COUNT(*) as count FROM ${this.tableName} WHERE format = 'opml'`).get() as {
				count: number;
			};
			const mm = db.prepare(`SELECT COUNT(*) as count FROM ${this.tableName} WHERE format = 'mm'`).get() as {
				count: number;
			};

			return {
				total: total.count,
				pending: pending.count,
				completed: completed.count,
				failed: failed.count,
				byFormat: {
					opml: opml.count,
					mm: mm.count,
				},
			};
		} catch (error) {
			throw new DatabaseError(`Failed to get stats: ${error}`);
		}
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
	 * Get database path
	 */
	get databasePath(): string {
		return this.dbPath;
	}
}
