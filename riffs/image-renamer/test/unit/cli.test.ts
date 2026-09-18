import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createProgram } from '../../src/cli.js';

// Mock DatabaseManager with hoisted pattern to survive vi.clearAllMocks()
const { MockedDatabaseManager } = vi.hoisted(() => {
	const MockedConstructor = vi.fn(function (this: unknown) {
		return {
			updateFilePath: vi.fn(),
			close: vi.fn(),
		};
	});
	return {
		MockedDatabaseManager: MockedConstructor,
	};
});

vi.mock('../../src/db/database.js', () => ({
	DatabaseManager: MockedDatabaseManager,
}));

// Mock ImageRenamer with hoisted pattern to survive vi.clearAllMocks()
const { MockedImageRenamer } = vi.hoisted(() => {
	const MockedConstructor = vi.fn(function (this: unknown) {
		return {
			testConnection: vi.fn().mockResolvedValue(true),
			renameSingleImage: vi.fn().mockResolvedValue(true),
		};
	});
	return {
		MockedImageRenamer: MockedConstructor,
	};
});

vi.mock('../../src/core/rename-images.js', () => ({
	ImageRenamer: MockedImageRenamer,
}));

// Mock FilenameGenerator with hoisted pattern (matches rename-images.test.ts pattern)
const { MockedFilenameGenerator } = vi.hoisted(() => {
	const mockInstance = {
		generateFilename: vi.fn(),
		testConnection: vi.fn(),
		checkConnectionWithDiagnostics: vi.fn(),
		listModels: vi.fn(),
		modelName: 'test-model',
		endpointUrl: 'http://test-endpoint',
	};
	const MockedConstructor = vi.fn(function (this: unknown) {
		return mockInstance;
	});
	return {
		MockedFilenameGenerator: MockedConstructor,
	};
});

vi.mock('../../src/core/filename-generator.js', () => ({
	FilenameGenerator: MockedFilenameGenerator,
}));

vi.mock('fs-extra', () => ({
	pathExists: vi.fn().mockResolvedValue(true),
}));

vi.mock('fs', () => ({
	promises: {
		stat: vi.fn().mockResolvedValue({ isFile: () => true, isDirectory: () => false }),
	},
}));

// Mock config with loadConfig
vi.mock('../../src/lib/config.js', () => ({
	loadConfig: vi.fn().mockReturnValue({
		'image-renamer': {
			paths: {
				input: { dir: null },
				database: { file: '.aria/db/image-renamer/image-renamer.sqlite' },
			},
			llm: {
				provider: 'ollama',
				ollama: {
					endpoint: 'http://localhost:11434/',
					model: 'gemma4:12b',
					timeout: 30,
					retryAttempts: 3,
					retryDelay: 1.0,
					prompt: 'Test prompt',
				},
				anthropic: {
					apiKey: '',
					model: 'claude-sonnet-5',
					timeout: 30,
					maxTokens: 1024,
					baseUrl: 'https://api.anthropic.com/v1',
					prompt: 'Test prompt',
				},
				gemini: {
					apiKey: '',
					model: 'gemini-3.8-flash',
					timeout: 30,
					maxTokens: 1024,
					baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
					prompt: 'Test prompt',
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
				journalMode: 'DELETE',
			},
		},
		logging: {
			level: 'info',
			verbose: false,
			file: '.aria/logs/test/image-renamer-cli.log',
			maxFileSizeMb: 10,
			maxFiles: 7,
		},
	}),
}));

// Mock createLogger
vi.mock('../../src/lib/logger.js', () => ({
	createLogger: vi.fn().mockReturnValue({
		info: vi.fn(),
		debug: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		fatal: vi.fn(),
		trace: vi.fn(),
		silent: vi.fn(),
		level: 'info',
		child: vi.fn(),
	}),
}));

describe('CLI', () => {
	let processExitSpy: any;

	beforeEach(() => {
		vi.clearAllMocks();
		// Mock process.exit to prevent test from exiting
		processExitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
	});

	afterEach(() => {
		processExitSpy.mockRestore();
	});

	describe('setDatabaseManager', () => {
		it('given database manager, when setDatabaseManager called, then stores database manager', () => {
			// Given: A mock database manager
			const mockDbManager = {
				updateFilePath: async () => {},
				close: () => {},
			};

			// When: setDatabaseManager is called on a fresh program instance
			const program = createProgram();
			(
				program as unknown as { setDatabaseManager: (mgr: unknown) => void; databaseManager: unknown }
			).setDatabaseManager(mockDbManager);

			// Then: Database manager should be stored
			expect((program as unknown as { databaseManager: unknown }).databaseManager).toBe(mockDbManager);
		});
	});

	describe('rename action', () => {
		it('given rename command, when executed, then creates DatabaseManager and passes to ImageRenamer', async () => {
			// Given: rename command with test image path
			const testPath = '/test/image.jpg';
			const program = createProgram();

			// When: rename action is executed
			await program.parseAsync(['node', 'cli.js', 'rename', testPath, '--dry-run']);

			// Then: DatabaseManager should be created
			expect(MockedDatabaseManager).toHaveBeenCalled();

			// And: ImageRenamer should be created with logger, LLM client, DatabaseManager and config
			expect(MockedImageRenamer).toHaveBeenCalledWith(
				expect.any(Object), // logger
				expect.anything(), // llmClient
				expect.any(Object), // dbManager instance
				expect.any(Object) // config
			);
		});
	});
});
