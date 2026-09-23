import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'fs-extra';
import Database from 'libsql';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DatabaseManager } from '../../src/db/database.js';
import type { ImageRenamerConfig } from '../../src/lib/schema.js';

// Create a test config factory
function createTestConfig(dbPath: string, journalMode = 'DELETE'): ImageRenamerConfig {
	return {
		'image-renamer': {
			paths: {
				input: { dir: null },
				database: { file: dbPath },
			},
			llm: {
				provider: 'ollama',
				ollama: {
					endpoint: 'http://localhost:11434/',
					model: 'gemma4:12b',
					timeout: 30,
					retryAttempts: 3,
					retryDelay: 1.0,
					prompt: 'Describe this image in 4-5 words',
				},
				anthropic: {
					apiKey: '',
					model: 'claude-sonnet-5',
					timeout: 30,
					maxTokens: 1024,
					baseUrl: 'https://api.anthropic.com/v1',
					prompt: 'Generate a concise filename',
				},
				gemini: {
					apiKey: '',
					model: 'gemini-3.8-flash',
					timeout: 30,
					maxTokens: 1024,
					baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
					prompt: 'Generate a concise filename',
				},
			},
			images: {
				supportedExtensions: ['.png', '.jpg', '.jpeg', '.gif', '.bmp'],
				maxFileSizeMb: 50,
				verifyBeforeProcessing: true,
			},
			filename: {
				prompt: 'Describe this image',
				patternCleanup: true,
				maxLength: 100,
				removePunctuation: true,
				replaceSpacesWith: '_',
				caseConversion: 'lower',
			},
			fileOperations: {
				safeMoveRetries: 3,
				moveDelaySeconds: 0.5,
				backupOriginals: false,
				confirmOverwrites: true,
			},
			watcher: {
				recursive: false,
				debounceSeconds: 1.0,
				fileSettleTime: 1.0,
			},
			processing: {
				progressBar: true,
				batchSize: 10,
				concurrentOperations: false,
				dryRun: false,
				recursive: false,
			},
			database: {
				tableName: 'images',
				journalMode,
			},
		},
		logging: {
			level: 'info',
			verbose: false,
			file: '.aria/logs/test/image-renamer-database.log',
			maxFileSizeMb: 10,
			maxFiles: 7,
		},
	};
}

describe('DatabaseManager', () => {
	let dbManager: DatabaseManager;
	let testDir: string;
	let testConfig: ImageRenamerConfig;

	beforeEach(async () => {
		// Create temporary directory for test database
		testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'image-renamer-db-test-'));
		const testDbPath = path.join(testDir, 'test-descriptions.db');

		// Create config with test path
		testConfig = createTestConfig(testDbPath);

		// Create database with config
		dbManager = new DatabaseManager(testConfig);
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
			const description = 'A test photo';
			await dbManager.saveDescription(oldPath, description);

			// When: updateFilePath is called
			await dbManager.updateFilePath(oldPath, newPath);

			// Then: New path should have the description
			const result = await dbManager.getDescription(newPath);
			expect(result).toBe(description);

			// And: Old path should not exist
			const oldResult = await dbManager.getDescription(oldPath);
			expect(oldResult).toBeNull();
		});

		it('given file path in database, when updateFilePath called, then returns Modified', async () => {
			// Given: A file path exists in the database
			const uniqueId = Date.now() + Math.random();
			const oldPath = `/test/images/photo-${uniqueId}.jpg`;
			const newPath = `/test/images/photo-${uniqueId}-renamed.jpg`;
			const description = 'A test photo';
			await dbManager.saveDescription(oldPath, description);

			// When: updateFilePath is called
			const result = await dbManager.updateFilePath(oldPath, newPath);

			// Then: Should return 'Modified'
			expect(result).toBe('Modified');
		});

		it('given file path not in database, when updateFilePath called, then returns NotModified', async () => {
			// Given: A file path does NOT exist in the database
			const uniqueId = Date.now() + Math.random();
			const oldPath = `/test/images/photo-${uniqueId}.jpg`;
			const newPath = `/test/images/photo-${uniqueId}-renamed.jpg`;

			// When: updateFilePath is called
			const result = await dbManager.updateFilePath(oldPath, newPath);

			// Then: Should return 'NotModified'
			expect(result).toBe('NotModified');
		});
	});

	describe('journal mode configuration', () => {
		it('given journalMode config set to WAL, when database initialized, then uses WAL mode', async () => {
			// Given: journalMode is configured as WAL
			const testDir2 = await fs.mkdtemp(path.join(os.tmpdir(), 'image-renamer-wal-test-'));
			const testDbPath2 = path.join(testDir2, 'test-wal.db');
			const walConfig = createTestConfig(testDbPath2, 'WAL');

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
