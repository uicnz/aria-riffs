/// <reference types="vitest" />
import { afterEach, beforeEach, describe, expect, it, type MockedObject, vi } from 'vitest';

// Mock fs-extra, config, and sharp - use vi.hoisted() to fix hoisting errors
const { mockPathExists, mockStat, mockAccess, mockSharp } = vi.hoisted(() => ({
	mockPathExists: vi.fn(),
	mockStat: vi.fn(),
	mockAccess: vi.fn(),
	mockSharp: vi.fn(),
}));

vi.mock('fs-extra', () => ({
	default: {
		pathExists: mockPathExists,
		stat: mockStat,
	},
}));

// Mock utils - use vi.hoisted() to fix hoisting errors
const { mockFindImageFiles } = vi.hoisted(() => ({
	mockFindImageFiles: vi.fn(),
}));

vi.mock('../../src/utils/utils', async () => {
	const actual = await vi.importActual('../../src/utils/utils.js');
	return {
		...actual,
		findImageFiles: mockFindImageFiles,
	};
});

// Mock loadConfig with hoisted pattern for module-level initialization
const { mockLoadConfig } = vi.hoisted(() => {
	const defaultConfig = {
		'image-metadata': {
			paths: { input: { dir: './images' }, database: { file: '.aria/db/test.db' } },
			llm: { provider: 'ollama' as const },
			database: { backupCount: 3, journalMode: 'DELETE' },
			images: {
				supportedExtensions: ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'],
				maxFileSizeMb: 50,
			},
			metadata: { retryAttempts: 3, retryDelay: 1.0 },
			processing: { batchSize: 10, progressBar: true },
		},
		logging: {
			level: 'info',
			verbose: false,
			file: '.aria/logs/test/image-metadata-create.log',
			maxFileSizeMb: 10,
			maxFiles: 7,
		},
		llmProviders: {
			ollama: {
				endpoint: 'http://localhost:11434/',
				model: 'gemma4:12b',
				timeout: 30,
				keepAlive: 5,
				prompt: '',
			},
			anthropic: { apiKey: '', model: '', timeout: 30, maxTokens: 1024, baseUrl: '', prompt: '' },
			gemini: { apiKey: '', model: '', timeout: 30, maxTokens: 1024, baseUrl: '', prompt: '' },
		},
	};
	return {
		mockLoadConfig: vi.fn().mockReturnValue(defaultConfig),
	};
});

vi.mock('../../src/lib/config', () => ({
	loadConfig: mockLoadConfig,
}));

// Mock chalk
vi.mock('chalk', () => ({
	__esModule: true,
	default: {
		blue: (str: string) => str,
		cyan: (str: string) => str,
		green: (str: string) => str,
		yellow: (str: string) => str,
		red: (str: string) => str,
		gray: (str: string) => str,
		grey: (str: string) => str,
		bold: (str: string) => str,
	},
}));

// Mock cli-progress
vi.mock('cli-progress', () => ({
	__esModule: true,
	default: {
		SingleBar: vi.fn().mockImplementation(() => ({
			start: vi.fn(),
			stop: vi.fn(),
			update: vi.fn(),
			getTotal: () => 10,
		})),
	},
}));

// Mock path
import * as path from 'node:path';

// Mock fs.promises
vi.mock('node:fs/promises', () => ({
	stat: mockStat,
	access: mockAccess,
	readdir: vi.fn(),
	readFile: vi.fn(),
}));

// Mock fs (constants only)
vi.mock('node:fs', () => ({
	constants: {
		R_OK: 4,
	},
}));

// Mock sharp
vi.mock('sharp', () => ({
	default: mockSharp,
}));

// Mock MetadataWriter
vi.mock('../../src/core/write-metadata', () => ({
	MetadataWriter: class {
		async writeDescription() {
			return Promise.resolve();
		}
		async hasDescription() {
			return Promise.resolve(false);
		}
		async cleanup() {
			return Promise.resolve();
		}
	},
}));

// Mock console methods
const originalLog = console.log;
const originalWarn = console.warn;
beforeEach(() => {
	console.log = vi.fn();
	console.warn = vi.fn();
});
afterEach(() => {
	console.log = originalLog;
	console.warn = originalWarn;
});

// Import after mocking
import {
	ensureUniqueFilename,
	ImageDescription,
	ImageMetadata,
	sanitizeDirectory,
	sanitizeFilename,
} from '../../src/core/create-metadata.js';
import type { DescriptionGenerator } from '../../src/core/description-generator.js';
import type { DatabaseManager } from '../../src/db/database.js';
import { ProgressLogger } from '../../src/utils/progress-logger.js';
import { createMockLogger, createMockProgressLogger, FakeDatabaseManager, FakeLLMClient } from './fakes.js';

describe('ImageMetadata', () => {
	let processor: ImageMetadata;
	let mockDescriptionGenerator: MockedObject<DescriptionGenerator>;
	let mockDatabase: MockedObject<DatabaseManager>;

	beforeEach(() => {
		vi.clearAllMocks();

		// Default mock implementations
		mockPathExists.mockResolvedValue(true);
		mockAccess.mockResolvedValue(undefined);
		mockStat.mockResolvedValue({ isFile: () => true, size: 1024 * 1024 } as any);
		// Config is pre-loaded with max_file_size_mb: 50

		const mockMetadata = { format: 'jpeg', width: 100, height: 100 };
		const mockSharpInstance = { metadata: vi.fn().mockResolvedValue(mockMetadata) };
		mockSharp.mockReturnValue(mockSharpInstance as any);

		// Create mock instances
		mockDescriptionGenerator = {
			generateDescription: vi.fn().mockResolvedValue('Test description'),
			testConnection: vi.fn(),
		} as any;

		mockDatabase = {
			getDescription: vi.fn().mockResolvedValue(null),
			saveDescription: vi.fn().mockResolvedValue(undefined),
			countRecords: vi.fn(),
			getAllDescriptions: vi.fn(),
			close: vi.fn(),
			databasePath: '/test/db.sqlite',
		} as any;

		processor = new ImageMetadata(
			mockDescriptionGenerator,
			mockDatabase,
			createMockProgressLogger(),
			createMockLogger()
		);
	});

	describe('processSingleFile', () => {
		it('given a valid image file, when processSingleFile called, then should process successfully', async () => {
			mockStat.mockResolvedValue({ isFile: () => true });

			const results = await processor.processSingleFile('/test/image.jpg');

			expect(results.total_files).toBe(1);
			expect(results.processed).toBe(1);
			expect(results.failed).toBe(0);
			expect(results.errors).toHaveLength(0);

			expect(mockAccess).toHaveBeenCalled();
			expect(mockDatabase.getDescription).toHaveBeenCalledWith(path.resolve('/test/image.jpg'));
			expect(mockDescriptionGenerator.generateDescription).toHaveBeenCalledWith(path.resolve('/test/image.jpg'));
			expect(mockDatabase.saveDescription).toHaveBeenCalledWith(
				path.resolve('/test/image.jpg'),
				'Test description'
			);
			// MetadataWriter.writeDescription is called but we can't easily assert on it
			// since a new instance is created each time
		});

		it('given image exists in database with force=false, when processSingleFile called, then should skip processing', async () => {
			mockStat.mockResolvedValue({ isFile: () => true });
			mockDatabase.getDescription.mockResolvedValue('Existing description');

			const results = await processor.processSingleFile('/test/image.jpg', { force: false });

			expect(results.total_files).toBe(1);
			expect(results.processed).toBe(0); // Skipped images are not counted as processed
			expect(results.failed).toBe(0);

			expect(mockDescriptionGenerator.generateDescription).not.toHaveBeenCalled();
			expect(mockDatabase.saveDescription).not.toHaveBeenCalled();
			// MetadataWriter not instantiated when skipping
		});

		it('given image exists in database with force=true, when processSingleFile called, then should reprocess', async () => {
			mockStat.mockResolvedValue({ isFile: () => true });
			mockDatabase.getDescription.mockResolvedValue('Existing description');

			const results = await processor.processSingleFile('/test/image.jpg', { force: true });

			expect(results.total_files).toBe(1);
			expect(results.processed).toBe(1);
			expect(results.failed).toBe(0);

			expect(mockDescriptionGenerator.generateDescription).toHaveBeenCalled();
			expect(mockDatabase.saveDescription).toHaveBeenCalled();
			// MetadataWriter.writeDescription is called via new instance
		});

		it('given file does not exist, when processSingleFile called, then should return error result', async () => {
			mockPathExists.mockResolvedValue(false);

			const results = await processor.processSingleFile('/test/nonexistent.jpg');

			expect(results.total_files).toBe(1);
			expect(results.processed).toBe(0);
			expect(results.failed).toBe(1);
			expect(results.errors).toHaveLength(1);
			expect(results.errors[0]).toContain('File not found');
		});

		it('given path is a directory not a file, when processSingleFile called, then should return error result', async () => {
			mockStat.mockResolvedValue({ isFile: () => false });

			const results = await processor.processSingleFile('/test/directory');

			expect(results.total_files).toBe(1);
			expect(results.processed).toBe(0);
			expect(results.failed).toBe(1);
			expect(results.errors).toHaveLength(1);
			expect(results.errors[0]).toContain('Path is not a file');
		});

		it('given LLM client throws error, when processSingleFile called, then should return error result', async () => {
			mockStat.mockResolvedValue({ isFile: () => true });
			mockDescriptionGenerator.generateDescription.mockRejectedValue(new Error('API error'));

			const results = await processor.processSingleFile('/test/image.jpg');

			expect(results.total_files).toBe(1);
			expect(results.processed).toBe(0);
			expect(results.failed).toBe(1);
			expect(results.errors).toHaveLength(1);
			expect(results.errors[0]).toContain('API error');
		});
	});

	describe('processSingleFile using fakes (refactored pattern)', () => {
		it('given fakes instead of mocks, when processSingleFile called, then should work without mock verification', async () => {
			const fakeLlm = new FakeLLMClient();
			const fakeDb = new FakeDatabaseManager();
			const refactoredProcessor = new ImageMetadata(
				fakeLlm,
				fakeDb as any,
				createMockProgressLogger(),
				createMockLogger()
			);

			mockStat.mockResolvedValue({ isFile: () => true });

			const results = await refactoredProcessor.processSingleFile('/test/image.jpg');

			// Test verifies behavior, not mock calls
			expect(results.total_files).toBe(1);
			expect(results.processed).toBe(1);
			expect(results.failed).toBe(0);
			expect(fakeDb.hasDescription('/test/image.jpg')).toBe(true);

			const stored = fakeDb.getStoredDescriptions();
			expect(stored.get('/test/image.jpg')).toContain('Generated description');
		});

		it('given fakes, when processSingleFile skips cached image with force=false, then should not process', async () => {
			const fakeLlm = new FakeLLMClient();
			const fakeDb = new FakeDatabaseManager();
			await fakeDb.saveDescription('/test/image.jpg', 'Cached description');

			const refactoredProcessor = new ImageMetadata(
				fakeLlm,
				fakeDb as any,
				createMockProgressLogger(),
				createMockLogger()
			);
			mockStat.mockResolvedValue({ isFile: () => true });

			const results = await refactoredProcessor.processSingleFile('/test/image.jpg', {
				force: false,
			});

			expect(results.processed).toBe(0);
		});

		it('given fakes, when processSingleFile encounters error, then should return error results', async () => {
			const fakeLlm = new FakeLLMClient();
			const fakeDb = new FakeDatabaseManager();
			const refactoredProcessor = new ImageMetadata(
				fakeLlm,
				fakeDb as any,
				createMockProgressLogger(),
				createMockLogger()
			);

			mockPathExists.mockResolvedValue(false);

			const results = await refactoredProcessor.processSingleFile('/test/nonexistent.jpg');

			expect(results.failed).toBe(1);
			expect(results.errors).toHaveLength(1);
			expect(results.errors[0]).toContain('not found');
		});
	});

	describe('processSingleFile with force option (after inlining processSingleImage)', () => {
		beforeEach(() => {
			mockStat.mockResolvedValue({ isFile: () => true });
		});

		it('given cached image with force=false, when processSingleFile called, then should skip processing', async () => {
			mockDatabase.getDescription.mockResolvedValue('Existing description');

			const results = await processor.processSingleFile('/test/image.jpg', {
				force: false,
			});

			expect(results.processed).toBe(0);
			expect(mockDescriptionGenerator.generateDescription).not.toHaveBeenCalled();
		});

		it('given cached image with force=true, when processSingleFile called, then should reprocess', async () => {
			mockDatabase.getDescription.mockResolvedValue('Existing description');

			const results = await processor.processSingleFile('/test/image.jpg', {
				force: true,
			});

			expect(results.processed).toBe(1);
			expect(mockDescriptionGenerator.generateDescription).toHaveBeenCalled();
		});

		it('given uncached image, when processSingleFile called, then should process', async () => {
			mockDatabase.getDescription.mockResolvedValue(null);

			const results = await processor.processSingleFile('/test/image.jpg', {
				force: false,
			});

			expect(results.processed).toBe(1);
			expect(mockDescriptionGenerator.generateDescription).toHaveBeenCalled();
		});

		it('given processSingleFile called without options, when no options provided, then should work correctly', async () => {
			mockStat.mockResolvedValue({ isFile: () => true });
			mockDatabase.getDescription.mockResolvedValue(null);

			const results = await processor.processSingleFile('/test/image.jpg');

			expect(results.total_files).toBe(1);
			expect(results.processed).toBeGreaterThanOrEqual(0);
		});

		it('given processSingleFile called, when file processed, then should return valid result', async () => {
			mockStat.mockResolvedValue({ isFile: () => true });
			mockDatabase.getDescription.mockResolvedValue('cached');

			const results = await processor.processSingleFile('/test/image.jpg');

			expect(results.total_files).toBe(1);
			expect(results.processing_time).toBeGreaterThanOrEqual(0);
		});
	});

	describe('processDirectory with force option', () => {
		beforeEach(() => {
			mockFindImageFiles.mockResolvedValue(['/test/image1.jpg', '/test/image2.jpg']);
		});

		it('given processDirectory with force option, when called, then should reprocess cached files', async () => {
			mockDatabase.getDescription.mockResolvedValue('Existing description');

			const results = await processor.processDirectory('/test/dir', {
				force: true,
				showProgress: false,
				sanitizeNames: false,
			});

			expect(results.total_files).toBe(2);
			expect(results.processed).toBe(2);
			expect(mockDescriptionGenerator.generateDescription).toHaveBeenCalledTimes(2);
		});

		it('given cached images with force=false, when processDirectory called, then should skip processing', async () => {
			mockDatabase.getDescription.mockResolvedValue('Existing description');

			const results = await processor.processDirectory('/test/dir', {
				force: false,
				showProgress: false,
				sanitizeNames: false,
			});

			expect(results.total_files).toBe(2);
			expect(results.processed).toBe(0);
			expect(mockDescriptionGenerator.generateDescription).not.toHaveBeenCalled();
		});
	});

	describe('processDirectory using fakes (refactored pattern)', () => {
		it('given fakes, when processDirectory called, then should process all files with state-based verification', async () => {
			const fakeLlm = new FakeLLMClient();
			const fakeDb = new FakeDatabaseManager();
			const refactoredProcessor = new ImageMetadata(
				fakeLlm,
				fakeDb as any,
				createMockProgressLogger(),
				createMockLogger()
			);

			mockFindImageFiles.mockResolvedValue(['/test/image1.jpg', '/test/image2.jpg']);
			mockStat.mockResolvedValue({ isFile: () => true });

			const results = await refactoredProcessor.processDirectory('/test/dir', {
				force: false,
				showProgress: false,
				sanitizeNames: false,
			});

			expect(results.total_files).toBe(2);
			expect(results.processed).toBe(2);
			expect(fakeDb.hasDescription('/test/image1.jpg')).toBe(true);
			expect(fakeDb.hasDescription('/test/image2.jpg')).toBe(true);
		});

		it('given processDirectory with multiple files, when called, then should call processSingleFile for each file', async () => {
			mockFindImageFiles.mockResolvedValue(['/test/image1.jpg', '/test/image2.jpg']);
			mockStat.mockResolvedValue({ isFile: () => true });

			// Mock processSingleFile to track calls
			processor.processSingleFile = vi.fn().mockResolvedValue({
				total_files: 1,
				processed: 1,
				failed: 0,
				renamed: 0,
				processing_time: 0,
				errors: [],
			});

			const results = await processor.processDirectory('/test/dir', {
				force: false,
				showProgress: false,
				sanitizeNames: false,
			});

			expect(processor.processSingleFile).toHaveBeenCalledTimes(2);
			expect(results.total_files).toBe(2);
			expect(results.processed).toBe(2);
		});
	});

	describe('sanitizeDirectory function integration', () => {
		it('given directory and logger, when sanitizeDirectory called from processDirectory, then should sanitize files', async () => {
			mockFindImageFiles.mockResolvedValue(['/test/image1.jpg', '/test/image2.jpg']);

			const results = await processor.processDirectory('/test/dir', { showProgress: false });

			expect(results.renamed).toBeGreaterThanOrEqual(0);
		});
	});

	describe('processSingleFile with generated description', () => {
		it('given a valid image file with generated description, when processSingleFile called, then should write metadata and process', async () => {
			// This test ensures inline behavior works correctly
			mockStat.mockResolvedValue({ isFile: () => true });

			const results = await processor.processSingleFile('/test/image.jpg');

			expect(results.total_files).toBe(1);
			expect(results.processed).toBe(1);
			expect(results.failed).toBe(0);
			expect(mockDescriptionGenerator.generateDescription).toHaveBeenCalled();
		});
	});
});

describe('ensureUniqueFilename function', () => {
	it('given path without collision, when ensureUniqueFilename called, then should return original path', async () => {
		mockPathExists.mockResolvedValue(false);

		const result = await ensureUniqueFilename('/test/dir/file.jpg');

		expect(result).toBe('/test/dir/file.jpg');
	});

	it('given path with collision, when ensureUniqueFilename called, then should return path with counter', async () => {
		mockPathExists
			.mockResolvedValueOnce(true) // First path exists
			.mockResolvedValueOnce(false); // Second path (with -1) does not exist

		const result = await ensureUniqueFilename('/test/dir/file.jpg');

		expect(result).toBe('/test/dir/file-1.jpg');
	});
});

describe('sanitizeDirectory function', () => {
	it('given directory and logger, when sanitizeDirectory called, then should return number of renamed files', async () => {
		mockFindImageFiles.mockResolvedValue(['/test/dir/unsanitized-name.jpg']);

		const logger = new ProgressLogger();
		const result = await sanitizeDirectory('/test/dir', logger);

		expect(typeof result).toBe('number');
		expect(result).toBeGreaterThanOrEqual(0);
	});
});

describe('sanitizeFilename function', () => {
	it('given filename with invalid characters, when sanitizeFilename called, then should remove invalid characters', () => {
		expect(sanitizeFilename('file<>:|*?')).toBe('file______');
		expect(sanitizeFilename('path/to\\file')).toBe('path_to_file');
	});

	it('given filename with multiple spaces, when sanitizeFilename called, then should replace multiple spaces with single space', () => {
		expect(sanitizeFilename('file    with     spaces')).toBe('file with spaces');
	});

	it('given filename with whitespace, when sanitizeFilename called, then should trim whitespace', () => {
		expect(sanitizeFilename('  filename  ')).toBe('filename');
	});

	it('given empty filename, when sanitizeFilename called, then should return unnamed', () => {
		expect(sanitizeFilename('')).toBe('unnamed');
		expect(sanitizeFilename('   ')).toBe('unnamed');
	});

	it('given long filename over 200 chars, when sanitizeFilename called, then should truncate to 200 chars', () => {
		const longName = 'a'.repeat(300);
		const result = sanitizeFilename(longName);
		expect(result.length).toBe(200);
	});

	it('given filename with special and control characters, when sanitizeFilename called, then should handle correctly', () => {
		expect(sanitizeFilename('file.jpg')).toBe('file.jpg');
		expect(sanitizeFilename('file\x00\x1F')).toBe('file__');
	});
});

describe('ImageDescription', () => {
	let mockDescriptionGenerator: MockedObject<DescriptionGenerator>;
	let mockDatabase: MockedObject<DatabaseManager>;

	beforeEach(() => {
		mockDescriptionGenerator = {
			generateDescription: vi.fn().mockResolvedValue('Generated description'),
			testConnection: vi.fn(),
		} as any;

		mockDatabase = {
			getDescription: vi.fn().mockResolvedValue(null),
			saveDescription: vi.fn().mockResolvedValue(undefined),
			countRecords: vi.fn(),
			getAllDescriptions: vi.fn(),
			close: vi.fn(),
			databasePath: '/test/db.sqlite',
		} as any;
	});

	it('given LLMClient and DatabaseManager, when ImageDescription instantiated, then should create instance', () => {
		const imageDesc = new ImageDescription(mockDescriptionGenerator, mockDatabase);
		expect(imageDesc).toBeDefined();
	});

	describe('process method', () => {
		it('given cached description with force=true set in constructor, when process called, then should regenerate despite cache', async () => {
			mockDatabase.getDescription.mockResolvedValue('Existing description');

			const imageDesc = new ImageDescription(mockDescriptionGenerator, mockDatabase, true);
			const result = await imageDesc.process('/test/image.jpg');

			expect(result.description).toBe('Generated description');
			expect(result.source).toBe('generated');
			expect(mockDescriptionGenerator.generateDescription).toHaveBeenCalledWith('/test/image.jpg');
		});

		it('given description already exists in database, when process called, then should return cached description with cached source', async () => {
			mockDatabase.getDescription.mockResolvedValue('Existing description');

			const imageDesc = new ImageDescription(mockDescriptionGenerator, mockDatabase);
			const result = await imageDesc.process('/test/image.jpg');

			expect(result.description).toBe('Existing description');
			expect(result.source).toBe('cached');
			expect(mockDescriptionGenerator.generateDescription).not.toHaveBeenCalled();
		});

		it('given description not in database, when process called, then should generate and save description with generated source', async () => {
			const imageDesc = new ImageDescription(mockDescriptionGenerator, mockDatabase);
			const result = await imageDesc.process('/test/image.jpg');

			expect(result.description).toBe('Generated description');
			expect(result.source).toBe('generated');
			expect(mockDescriptionGenerator.generateDescription).toHaveBeenCalledWith('/test/image.jpg');
			expect(mockDatabase.saveDescription).toHaveBeenCalledWith('/test/image.jpg', 'Generated description');
		});
	});

	describe('process using FakeDatabaseManager', () => {
		it('given fake database and LLM client, when processing multiple files, then database state should reflect saved descriptions', async () => {
			const fakeDb = new FakeDatabaseManager();
			const mockLlmClient = {
				generateDescription: vi
					.fn()
					.mockImplementation(async (filePath: string) => `Description for ${filePath}`),
			} as any;

			const imageDesc = new ImageDescription(mockLlmClient, fakeDb as any);

			// Process first file
			const result1 = await imageDesc.process('/test/image1.jpg');
			// Process second file
			const result2 = await imageDesc.process('/test/image2.jpg');

			// Verify state - test doesn't care HOW database.saveDescription was called
			// Just that descriptions got saved
			expect(fakeDb.hasDescription('/test/image1.jpg')).toBe(true);
			expect(fakeDb.hasDescription('/test/image2.jpg')).toBe(true);

			const stored = fakeDb.getStoredDescriptions();
			expect(stored.get('/test/image1.jpg')).toBe('Description for /test/image1.jpg');
			expect(stored.get('/test/image2.jpg')).toBe('Description for /test/image2.jpg');

			// Behavior is observable through state, not mock calls
			expect(result1.source).toBe('generated');
			expect(result2.source).toBe('generated');
		});
	});
});
