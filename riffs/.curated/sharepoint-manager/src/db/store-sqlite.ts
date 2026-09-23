/**
 * SQLite database operations for SharePoint data
 */

import fs from 'node:fs';
import path from 'node:path';
import Database from 'libsql';
import type { FileRecord } from '../lib/types.js';

/**
 * SQLite database handler for SharePoint records
 */
export class SharePointDatabase {
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

		// Create table if it doesn't exist
		this.db.exec(`
            CREATE TABLE IF NOT EXISTS sharepoint_files (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                path TEXT NOT NULL,
                full_path TEXT NOT NULL UNIQUE,
                file_extension TEXT NOT NULL,
                download_link TEXT NOT NULL,
                directory_view_link TEXT NOT NULL,
                web_view_link TEXT DEFAULT '',
                web_view_status TEXT DEFAULT 'pending',
                error_message TEXT,
                resource_id TEXT,
                extraction_method TEXT,
                parent_resource_id TEXT,
                etag TEXT,
                size_mb REAL NOT NULL,
                modified TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_web_view_status ON sharepoint_files(web_view_status);
            CREATE INDEX IF NOT EXISTS idx_full_path ON sharepoint_files(full_path);
            CREATE INDEX IF NOT EXISTS idx_name ON sharepoint_files(name);
            CREATE INDEX IF NOT EXISTS idx_file_extension ON sharepoint_files(file_extension);
            CREATE INDEX IF NOT EXISTS idx_resource_id ON sharepoint_files(resource_id);
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
	 * Check if database exists
	 */
	exists(): boolean {
		return fs.existsSync(this.dbPath);
	}

	/**
	 * Insert or update a single record
	 */
	upsertRecord(record: FileRecord): void {
		if (!this.db) {
			throw new Error('Database not initialized. Call initialize() first.');
		}

		const stmt = this.db.prepare(`
            INSERT INTO sharepoint_files (
                name, path, full_path, file_extension, download_link, directory_view_link,
                web_view_link, web_view_status, error_message, resource_id, extraction_method,
                parent_resource_id, etag, size_mb, modified
            ) VALUES (
                @name, @path, @full_path, @file_extension, @download_link, @directory_view_link,
                @web_view_link, @web_view_status, @error_message, @resource_id, @extraction_method,
                @parent_resource_id, @etag, @size_mb, @modified
            )
            ON CONFLICT(full_path) DO UPDATE SET
                name = excluded.name,
                path = excluded.path,
                file_extension = excluded.file_extension,
                download_link = excluded.download_link,
                directory_view_link = excluded.directory_view_link,
                web_view_link = excluded.web_view_link,
                web_view_status = excluded.web_view_status,
                error_message = excluded.error_message,
                resource_id = excluded.resource_id,
                extraction_method = excluded.extraction_method,
                parent_resource_id = excluded.parent_resource_id,
                etag = excluded.etag,
                size_mb = excluded.size_mb,
                modified = excluded.modified,
                updated_at = CURRENT_TIMESTAMP
        `);

		stmt.run(record);
	}

	/**
	 * Insert or update multiple records in a transaction
	 */
	upsertRecords(records: FileRecord[]): void {
		if (!this.db) {
			throw new Error('Database not initialized. Call initialize() first.');
		}

		const db = this.db;
		const upsert = db.transaction((recs: FileRecord[]) => {
			const stmt = db.prepare(`
                INSERT INTO sharepoint_files (
                    name, path, full_path, file_extension, download_link, directory_view_link,
                    web_view_link, web_view_status, error_message, resource_id, extraction_method,
                    parent_resource_id, etag, size_mb, modified
                ) VALUES (
                    @name, @path, @full_path, @file_extension, @download_link, @directory_view_link,
                    @web_view_link, @web_view_status, @error_message, @resource_id, @extraction_method,
                    @parent_resource_id, @etag, @size_mb, @modified
                )
                ON CONFLICT(full_path) DO UPDATE SET
                    name = excluded.name,
                    path = excluded.path,
                    file_extension = excluded.file_extension,
                    download_link = excluded.download_link,
                    directory_view_link = excluded.directory_view_link,
                    web_view_link = excluded.web_view_link,
                    web_view_status = excluded.web_view_status,
                    error_message = excluded.error_message,
                    resource_id = excluded.resource_id,
                    extraction_method = excluded.extraction_method,
                    parent_resource_id = excluded.parent_resource_id,
                    etag = excluded.etag,
                    size_mb = excluded.size_mb,
                    modified = excluded.modified,
                    updated_at = CURRENT_TIMESTAMP
            `);

			for (const record of recs) {
				stmt.run(record);
			}
		});

		upsert(records);
	}

	/**
	 * Load all records from database
	 */
	loadRecords(): FileRecord[] {
		if (!this.db) {
			throw new Error('Database not initialized. Call initialize() first.');
		}

		const stmt = this.db.prepare(`
            SELECT
                name, path, full_path, file_extension, download_link, directory_view_link,
                web_view_link, web_view_status, error_message, resource_id, extraction_method,
                parent_resource_id, etag, size_mb, modified
            FROM sharepoint_files
            ORDER BY full_path
        `);

		return stmt.all() as FileRecord[];
	}

	/**
	 * Get records by status
	 */
	getRecordsByStatus(status: 'pending' | 'completed' | 'failed'): FileRecord[] {
		if (!this.db) {
			throw new Error('Database not initialized. Call initialize() first.');
		}

		const stmt = this.db.prepare(`
            SELECT
                name, path, full_path, file_extension, download_link, directory_view_link,
                web_view_link, web_view_status, error_message, resource_id, extraction_method,
                parent_resource_id, etag, size_mb, modified
            FROM sharepoint_files
            WHERE web_view_status = ?
            ORDER BY full_path
        `);

		return stmt.all(status) as FileRecord[];
	}

	/**
	 * Get records by file extension
	 */
	getRecordsByExtension(extension: string): FileRecord[] {
		if (!this.db) {
			throw new Error('Database not initialized. Call initialize() first.');
		}

		const stmt = this.db.prepare(`
            SELECT
                name, path, full_path, file_extension, download_link, directory_view_link,
                web_view_link, web_view_status, error_message, resource_id, extraction_method,
                parent_resource_id, etag, size_mb, modified
            FROM sharepoint_files
            WHERE file_extension = ?
            ORDER BY full_path
        `);

		return stmt.all(extension.toLowerCase()) as FileRecord[];
	}

	/**
	 * Get file extension statistics
	 */
	getExtensionStats(): Array<{ extension: string; count: number }> {
		if (!this.db) {
			throw new Error('Database not initialized. Call initialize() first.');
		}

		const stmt = this.db.prepare(`
            SELECT
                file_extension as extension,
                COUNT(*) as count
            FROM sharepoint_files
            GROUP BY file_extension
            ORDER BY count DESC
        `);

		return stmt.all() as Array<{ extension: string; count: number }>;
	}

	/**
	 * Update web view link for a specific record
	 */
	updateWebViewLink(fullPath: string, webViewLink: string, status: 'completed' | 'failed'): void {
		if (!this.db) {
			throw new Error('Database not initialized. Call initialize() first.');
		}

		const stmt = this.db.prepare(`
            UPDATE sharepoint_files
            SET web_view_link = ?,
                web_view_status = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE full_path = ?
        `);

		stmt.run(webViewLink, status, fullPath);
	}

	/**
	 * Get status counts
	 */
	getStatusCounts(): { total: number; completed: number; pending: number; failed: number } {
		if (!this.db) {
			throw new Error('Database not initialized. Call initialize() first.');
		}

		const stmt = this.db.prepare(`
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN web_view_status = 'completed' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN web_view_status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN web_view_status = 'failed' THEN 1 ELSE 0 END) as failed
            FROM sharepoint_files
        `);

		const result = stmt.get() as { total: number; completed: number; pending: number; failed: number };
		return result;
	}

	/**
	 * Reset failed records to pending status
	 */
	resetFailedRecords(): number {
		if (!this.db) {
			throw new Error('Database not initialized. Call initialize() first.');
		}

		const stmt = this.db.prepare(`
            UPDATE sharepoint_files
            SET web_view_status = 'pending',
                updated_at = CURRENT_TIMESTAMP
            WHERE web_view_status = 'failed'
        `);

		const result = stmt.run();
		return result.changes;
	}

	/**
	 * Clear all records from database
	 */
	clearAllRecords(): void {
		if (!this.db) {
			throw new Error('Database not initialized. Call initialize() first.');
		}

		this.db.exec('DELETE FROM sharepoint_files');
	}
}

/**
 * Load records from SQLite database
 */
export async function loadRecords(dbPath: string): Promise<FileRecord[]> {
	const db = new SharePointDatabase(dbPath);
	db.initialize();
	const records = db.loadRecords();
	db.close();
	return records;
}

/**
 * Save records to SQLite database
 */
export async function saveRecords(dbPath: string, records: FileRecord[]): Promise<void> {
	const db = new SharePointDatabase(dbPath);
	db.initialize();
	db.upsertRecords(records);
	db.close();
}

/**
 * Check if SQLite database exists
 */
export function sqliteExists(dbPath: string): boolean {
	return fs.existsSync(dbPath);
}
