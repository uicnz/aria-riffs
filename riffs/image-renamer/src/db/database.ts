/**
 * SQLite database manager for image file path updates
 */

import * as path from 'node:path';
import * as fsExtra from 'fs-extra';
import Database from 'libsql';
import type { ImageRenamerConfig } from '../lib/schema.js';
import type { WasModified } from '../lib/types.js';

export class DatabaseError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'DatabaseError';
	}
}

export class DatabaseManager {
	private dbPath: string;
	private tableName: string;
	private journalMode: string;
	private db: Database.Database | null = null;

	constructor(config: ImageRenamerConfig, dbPath?: string) {
		const riffConfig = config['image-renamer'];
		this.dbPath = dbPath || riffConfig.paths.database.file;
		this.tableName = riffConfig.database.tableName;
		this.journalMode = riffConfig.database.journalMode;
		if (!path.isAbsolute(this.dbPath)) {
			this.dbPath = path.resolve(this.dbPath);
		}
	}

	private async initializeDatabase(): Promise<void> {
		try {
			await fsExtra.ensureDir(path.dirname(this.dbPath));

			this.db = new Database(this.dbPath);
			this.db.pragma(`journal_mode = ${this.journalMode}`);

			this.db.exec(`
        CREATE TABLE IF NOT EXISTS ${this.tableName} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          file_path TEXT NOT NULL UNIQUE,
          description TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

			this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_file_path ON ${this.tableName}(file_path)
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

	async saveDescription(filePath: string, description: string): Promise<void> {
		try {
			const db = await this.getConnection();
			const normalizedPath = path.resolve(filePath);

			const stmt = db.prepare(`
        INSERT INTO ${this.tableName} (file_path, description)
        VALUES (?, ?)
        ON CONFLICT(file_path) DO UPDATE SET
          description = excluded.description,
          updated_at = CURRENT_TIMESTAMP
      `);

			stmt.run(normalizedPath, description);
		} catch (error) {
			throw new DatabaseError(`Failed to save description: ${error}`);
		}
	}

	async getDescription(filePath: string): Promise<string | null> {
		try {
			const db = await this.getConnection();
			const normalizedPath = path.resolve(filePath);

			const stmt = db.prepare(`
        SELECT description FROM ${this.tableName}
        WHERE file_path = ?
      `);

			const row = stmt.get(normalizedPath) as { description: string } | undefined;
			return row?.description || null;
		} catch (error) {
			throw new DatabaseError(`Failed to get description: ${error}`);
		}
	}

	async updateFilePath(oldPath: string, newPath: string): Promise<WasModified> {
		try {
			const db = await this.getConnection();
			const normalizedOldPath = path.resolve(oldPath);
			const normalizedNewPath = path.resolve(newPath);

			const stmt = db.prepare(`
        UPDATE ${this.tableName}
        SET file_path = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE file_path = ?
      `);

			const result = stmt.run(normalizedNewPath, normalizedOldPath);
			return result.changes > 0 ? 'Modified' : 'NotModified';
		} catch (error) {
			throw new DatabaseError(`Failed to update file path: ${error}`);
		}
	}

	close(): void {
		if (this.db) {
			this.db.close();
			this.db = null;
		}
	}

	get databasePath(): string {
		return this.dbPath;
	}
}
