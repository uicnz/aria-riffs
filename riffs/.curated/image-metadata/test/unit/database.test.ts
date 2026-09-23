import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'fs-extra';
import Database from 'libsql';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Store test config values that can be updated between tests
let testDbPath = '';
let journalMode = 'DELETE';

// Use vi.hoisted to create mock that reads from the variables above
const { mockLoadConfig } = vi.hoisted(() => {
	const createConfig = () => ({
		'image-metadata': {
			paths: { input: { dir: './images' }, database: { file: '' } },
			llm: { provider: 'ollama' as const },
			database: { backupCount: 3, journalMode: 'DELETE' },
			images: { supportedExtensions: ['.png', '.jpg'], maxFileSizeMb: 50 },
			metadata: { retryAttempts: 3, retryDelay: 1.0 },
			processing: { batchSize: 10, progressBar: true },
		},
		logging: {
			level: 'info',
			verbose: false,
			file: '.aria/logs/test/image-metadata-database.log',
			maxFileSizeMb: 10,
			maxFiles: 7,
		},
		llmProviders: {
			ollama: { endpoint: '', model: '', timeout: 30, keepAlive: 5, prompt: '' },
			anthropic: { apiKey: '', model: '', timeout: 30, maxTokens: 1024, baseUrl: '', prompt: '' },
			gemini: { apiKey: '', model: '', timeout: 30, maxTokens: 1024, baseUrl: '', prompt: '' },
		},
	});

	return {
		mockLoadConfig: vi.fn(() => createConfig()),
	};
});

vi.mock('../../src/lib/config', () => ({
	loadConfig: mockLoadConfig,
}));

// Helper to create config
function createTestConfig(dbPath: string, jMode = 'DELETE') {
	return {
		'image-metadata': {
			paths: { input: { dir: './images' }, database: { file: dbPath } },
			llm: { provider: 'ollama' as const },
			database: { backupCount: 3, journalMode: jMode },
			images: { supportedExtensions: ['.png', '.jpg'], maxFileSizeMb: 50 },
			metadata: { retryAttempts: 3, retryDelay: 1.0 },
			processing: { batchSize: 10, progressBar: true },
		},
		logging: {
			level: 'info',
			verbose: false,
			file: '.aria/logs/test/image-metadata-database.log',
			maxFileSizeMb: 10,
			maxFiles: 7,
		},
		llmProviders: {
			ollama: { endpoint: '', model: '', timeout: 30, keepAlive: 5, prompt: '' },
			anthropic: { apiKey: '', model: '', timeout: 30, maxTokens: 1024, baseUrl: '', prompt: '' },
			gemini: { apiKey: '', model: '', timeout: 30, maxTokens: 1024, baseUrl: '', prompt: '' },
		},
	};
}

describe('DatabaseManager', () => {
	let testDir: string;

	beforeEach(async () => {
		// Create temporary directory for test database
		testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'image-metadata-db-test-'));
		testDbPath = path.join(testDir, 'test-descriptions.db');
		journalMode = 'DELETE';

		// Reset modules to get fresh imports with new mock values
		vi.resetModules();

		// Update mock to return config with test paths
		mockLoadConfig.mockReturnValue(createTestConfig(testDbPath, journalMode));
	});

	afterEach(async () => {
		if (testDir) {
			await fs.remove(testDir);
		}
		vi.restoreAllMocks();
	});

	describe('journal mode configuration', () => {
		it('given journal_mode config set to WAL, when database initialized, then uses WAL mode', async () => {
			// Given: journal_mode is configured as WAL
			journalMode = 'WAL';
			mockLoadConfig.mockReturnValue(createTestConfig(testDbPath, 'WAL'));

			// Dynamically import to get fresh module with new config
			const { DatabaseManager } = await import('../../src/db/database.js');
			const dbManagerWal = new DatabaseManager();

			// When: Database is initialized by calling any method
			const uniqueId = Date.now() + Math.random();
			const filePath = `/test/images/photo-${uniqueId}.jpg`;
			await dbManagerWal.saveDescription(filePath, 'Test description');

			// Then: Journal mode should be WAL
			const db = new Database(testDbPath);
			const result = db.pragma('journal_mode', { simple: true }) as { journal_mode: string };
			expect(result.journal_mode).toBe('wal');
			db.close();
			dbManagerWal.close();
		});
	});
});
