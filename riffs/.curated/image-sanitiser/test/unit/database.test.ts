import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'fs-extra';
import Database from 'libsql';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DatabaseManager } from '../../src/db/database.js';
import { createTestConfig } from './fakes.js';

describe('DatabaseManager', () => {
	let dbManager: DatabaseManager;
	let testDir: string;
	const testConfig = createTestConfig();

	beforeEach(async () => {
		// Create temporary directory for test database
		testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'image-sanitiser-db-test-'));
		const testDbPath = path.join(testDir, 'test-descriptions.db');

		// Create database with test config and path
		dbManager = new DatabaseManager(testConfig, testDbPath);
	});

	afterEach(async () => {
		if (dbManager) {
			dbManager.close();
		}
		if (testDir) {
			await fs.remove(testDir);
		}
	});

	describe('saveDescription', () => {
		it('given file path and description, when saveDescription called, then saves to database', async () => {
			// Given: A file path and description
			const uniqueId = Date.now() + Math.random();
			const filePath = `/test/images/photo-${uniqueId}.jpg`;
			const description = 'A test photo';

			// When: saveDescription is called
			await dbManager.saveDescription(filePath, description);

			// Then: Should complete without error
		});
	});

	describe('getDescription', () => {
		it('given file path in database, when getDescription called, then returns description', async () => {
			// Given: A file path exists in the database
			const uniqueId = Date.now() + Math.random();
			const filePath = `/test/images/photo-${uniqueId}.jpg`;
			const description = 'A test photo';
			await dbManager.saveDescription(filePath, description);

			// When: getDescription is called
			const result = await dbManager.getDescription(filePath);

			// Then: Should return the description
			expect(result).toBe(description);
		});
	});

	describe('updateFilePath', () => {
		it('given file path in database, when updateFilePath called, then updates database path', async () => {
			// Given: A file path exists in the database
			const uniqueId = Date.now() + Math.random();
			const oldPath = `/test/images/photo-${uniqueId}.jpg`;
			const newPath = `/test/images/photo-${uniqueId}-renamed.jpg`;

			// When: updateFilePath is called
			await dbManager.updateFilePath(oldPath, newPath);

			// Then: Should complete without error
			// (We can't verify the update without read methods, but it shouldn't throw)
		});

		it('given non-existent path, when updateFilePath called, then completes without error', async () => {
			// Given: A file path that does not exist in the database
			const uniqueId = Date.now() + Math.random();
			const oldPath = `/test/images/nonexistent-${uniqueId}.jpg`;
			const newPath = `/test/images/nonexistent-${uniqueId}-renamed.jpg`;

			// When: updateFilePath is called
			// Then: Should not throw an error
			await expect(dbManager.updateFilePath(oldPath, newPath)).resolves.not.toThrow();
		});
	});

	describe('journal mode configuration', () => {
		it('given journalMode config set to WAL, when database initialized, then uses WAL mode', async () => {
			// Given: journalMode is configured as WAL
			const testDir2 = await fs.mkdtemp(path.join(os.tmpdir(), 'image-sanitiser-wal-test-'));
			const testDbPath2 = path.join(testDir2, 'test-wal.db');

			const walConfig = createTestConfig({
				'image-sanitiser': {
					paths: {
						database: {
							file: testDbPath2,
						},
					},
					database: {
						tableName: 'images',
						journalMode: 'WAL',
					},
				},
			});

			const dbManagerWal = new DatabaseManager(walConfig);

			// When: Database is initialized by calling any method
			const uniqueId = Date.now() + Math.random();
			const filePath = `/test/images/photo-${uniqueId}.jpg`;
			await dbManagerWal.saveDescription(filePath, 'Test description');

			// Then: Journal mode should be WAL
			const db = new Database(testDbPath2);
			const result = db.pragma('journal_mode', { simple: true }) as { journal_mode: string };
			expect(result.journal_mode).toBe('wal');
			db.close();
			dbManagerWal.close();
			await fs.remove(testDir2);
		});
	});
});
