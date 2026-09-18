/**
 * Unit tests for ImageWatcher class
 */

/// <reference types="vitest" />
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock fs module - hoist mocked functions
const { mockFsReaddir, mockFsStat } = vi.hoisted(() => ({
	mockFsReaddir: vi.fn(),
	mockFsStat: vi.fn(),
}));

vi.mock('fs', () => ({
	promises: {
		readdir: mockFsReaddir,
		stat: mockFsStat,
	},
}));

// Mock watcher first to avoid ES module issues - add default export
vi.mock('watcher', () => ({
	default: vi.fn().mockImplementation(() => ({
		close: vi.fn(),
	})),
}));

// Mock fs-extra - hoist mocked function
const { mockPathExists } = vi.hoisted(() => ({
	mockPathExists: vi.fn(),
}));

vi.mock('fs-extra', () => ({
	pathExists: mockPathExists,
}));

// Mock other dependencies
// Hoist mock functions
const { mockIsSupportedImage, mockFindImageFiles } = vi.hoisted(() => ({
	mockIsSupportedImage: vi.fn(),
	mockFindImageFiles: vi.fn(),
}));

vi.mock('../../src/utils/utils.js', () => ({
	isSupportedImage: mockIsSupportedImage,
	sleep: vi.fn(),
	findImageFiles: mockFindImageFiles,
}));

// Mock ImageRenamer - hoist to survive vi.clearAllMocks()
const { mockImageRenamer, mockTestConnection } = vi.hoisted(() => {
	const mockTestConnection = vi.fn().mockResolvedValue(false);
	const mockRenameSingleImage = vi.fn();
	const mockImageRenamer = vi.fn(function (this: unknown) {
		return {
			testConnection: mockTestConnection,
			renameSingleImage: mockRenameSingleImage,
		};
	});
	return { mockImageRenamer, mockTestConnection };
});

vi.mock('../../src/core/rename-images.js', () => ({
	ImageRenamer: mockImageRenamer,
}));

// Mock FilenameGenerator with hoisted pattern
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

import * as path from 'node:path';
import type { Logger } from 'pino';
import { ImageWatcher } from '../../src/core/watch-files.js';
import type { ImageRenamerConfig } from '../../src/lib/schema.js';
import { createMockLogger } from './fakes.js';

// Create a test config factory
function createTestConfig(): ImageRenamerConfig {
	return {
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
				journalMode: 'DELETE',
			},
		},
		logging: {
			level: 'info',
			verbose: false,
			file: '.aria/logs/test/image-renamer-watch.log',
			maxFileSizeMb: 10,
			maxFiles: 7,
		},
	};
}

describe('ImageWatcher', () => {
	// Type for accessing private properties in tests
	type ImageWatcherTestAccess = {
		shouldIgnoreFile: (path: string) => boolean;
		scanExistingFiles: (dirPath: string) => Promise<void>;
		processNewFile: (filePath: string) => Promise<void>;
		existingFiles: Set<string>;
		processingFiles: Set<string>;
		processedFiles: Set<string>;
		renamer: unknown;
		filesProcessed: number;
		filesFailed: number;
		config: ImageRenamerConfig;
	};

	let mockLogger: Logger;
	let testConfig: ImageRenamerConfig;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let mockLlmClient: any;

	beforeEach(() => {
		vi.clearAllMocks();

		// Create mock logger
		mockLogger = createMockLogger();
		testConfig = createTestConfig();

		// Create mock llmClient with all required properties
		mockLlmClient = {
			generateFilename: vi.fn(),
			testConnection: vi.fn(),
			listModels: vi.fn().mockResolvedValue([]),
			modelName: 'test-model',
			endpointUrl: 'http://localhost:11434',
		};

		// Re-setup ImageRenamer mock after clearAllMocks
		mockTestConnection.mockResolvedValue(false);
	});

	describe('shouldIgnoreFile', () => {
		let watcher: ImageWatcher;

		beforeEach(() => {
			watcher = new ImageWatcher(mockLogger, testConfig, { llmClient: mockLlmClient, quiet: true });
		});

		it('should ignore files that are not supported images', () => {
			mockIsSupportedImage.mockReturnValue(false);

			const result = (watcher as unknown as { shouldIgnoreFile: (path: string) => boolean }).shouldIgnoreFile(
				'/path/to/document.txt'
			);

			expect(result).toBe(true);
			expect(mockIsSupportedImage).toHaveBeenCalledWith('/path/to/document.txt', testConfig);
		});

		it('should not ignore supported image files', () => {
			mockIsSupportedImage.mockReturnValue(true);

			const result = (watcher as unknown as ImageWatcherTestAccess).shouldIgnoreFile('/path/to/image.jpg');

			expect(result).toBe(false);
			expect(mockIsSupportedImage).toHaveBeenCalledWith('/path/to/image.jpg', testConfig);
		});

		it('should ignore files that existed before watching started', () => {
			mockIsSupportedImage.mockReturnValue(true);
			const filePath = '/path/to/existing-image.jpg';

			// Add file to existing files set
			(watcher as unknown as ImageWatcherTestAccess).existingFiles.add(path.resolve(filePath));

			const result = (watcher as unknown as ImageWatcherTestAccess).shouldIgnoreFile(filePath);

			expect(result).toBe(true);
		});

		it('should ignore files that are currently being processed', () => {
			mockIsSupportedImage.mockReturnValue(true);
			const filePath = '/path/to/processing-image.jpg';

			// Add file to processing files set
			(watcher as unknown as ImageWatcherTestAccess).processingFiles.add(path.resolve(filePath));

			const result = (watcher as unknown as ImageWatcherTestAccess).shouldIgnoreFile(filePath);

			expect(result).toBe(true);
		});

		it('should ignore files that have already been processed', () => {
			mockIsSupportedImage.mockReturnValue(true);
			const filePath = '/path/to/processed-image.jpg';

			// Add file to processed files set
			(watcher as unknown as ImageWatcherTestAccess).processedFiles.add(path.resolve(filePath));

			const result = (watcher as unknown as ImageWatcherTestAccess).shouldIgnoreFile(filePath);

			expect(result).toBe(true);
		});

		it('should handle relative and absolute paths correctly', () => {
			mockIsSupportedImage.mockReturnValue(true);
			const relativePath = 'image.jpg';
			const absolutePath = path.resolve(relativePath);

			// Add absolute path to existing files
			(watcher as unknown as ImageWatcherTestAccess).existingFiles.add(absolutePath);

			// Should ignore relative path when absolute path exists in set
			const result = (watcher as unknown as ImageWatcherTestAccess).shouldIgnoreFile(relativePath);

			expect(result).toBe(true);
		});

		it('should not ignore new supported image files', () => {
			mockIsSupportedImage.mockReturnValue(true);
			const filePath = '/path/to/new-image.jpg';

			const result = (watcher as unknown as ImageWatcherTestAccess).shouldIgnoreFile(filePath);

			expect(result).toBe(false);
		});
	});

	describe('scanExistingFiles', () => {
		let watcher: ImageWatcher;

		beforeEach(() => {
			watcher = new ImageWatcher(mockLogger, testConfig, { llmClient: mockLlmClient, quiet: true });
		});

		it('should scan existing files and add them to existingFiles set', async () => {
			const directoryPath = '/test/directory';
			const mockFiles = ['/test/directory/image1.jpg', '/test/directory/image2.png'] as const;

			mockFindImageFiles.mockResolvedValue([...mockFiles]);

			await (watcher as unknown as ImageWatcherTestAccess).scanExistingFiles(directoryPath);

			expect(mockFindImageFiles).toHaveBeenCalledWith(directoryPath, testConfig, false);

			// Check that files were added to existingFiles set with resolved paths
			const existingFiles = (watcher as unknown as ImageWatcherTestAccess).existingFiles;
			expect(existingFiles.has(path.resolve(mockFiles[0]))).toBe(true);
			expect(existingFiles.has(path.resolve(mockFiles[1]))).toBe(true);
			expect(existingFiles.size).toBe(2);
		});

		it('should use recursive option when watcher is configured for recursive scanning', async () => {
			const directoryPath = '/test/directory';
			const mockFiles = ['/test/directory/subdir/image.jpg'];

			// Create watcher with recursive option
			watcher = new ImageWatcher(mockLogger, testConfig, {
				llmClient: mockLlmClient,
				recursive: true,
				quiet: true,
			});
			mockFindImageFiles.mockResolvedValue(mockFiles);

			await (watcher as unknown as ImageWatcherTestAccess).scanExistingFiles(directoryPath);

			expect(mockFindImageFiles).toHaveBeenCalledWith(directoryPath, testConfig, true);
		});

		it('should handle empty directories gracefully', async () => {
			const directoryPath = '/test/empty';

			mockFindImageFiles.mockResolvedValue([]);

			await (watcher as unknown as ImageWatcherTestAccess).scanExistingFiles(directoryPath);

			expect(mockFindImageFiles).toHaveBeenCalledWith(directoryPath, testConfig, false);

			const existingFiles = (watcher as unknown as ImageWatcherTestAccess).existingFiles;
			expect(existingFiles.size).toBe(0);
		});

		it('should log found files count via logger', async () => {
			const directoryPath = '/test/directory';
			const mockFiles = ['/test/directory/image1.jpg', '/test/directory/image2.png'];

			mockFindImageFiles.mockResolvedValue(mockFiles);

			await (watcher as unknown as ImageWatcherTestAccess).scanExistingFiles(directoryPath);

			expect(mockLogger.info).toHaveBeenCalledWith(
				expect.objectContaining({ directoryPath, fileCount: 2 }),
				'Found 2 existing image files to ignore'
			);
		});

		it('should handle errors gracefully and log them', async () => {
			const directoryPath = '/test/directory';
			const error = new Error('Permission denied');

			mockFindImageFiles.mockRejectedValue(error);

			await (watcher as unknown as ImageWatcherTestAccess).scanExistingFiles(directoryPath);

			expect(mockLogger.error).toHaveBeenCalledWith(
				expect.objectContaining({ directoryPath, error: 'Error: Permission denied' }),
				'Failed to scan existing files'
			);

			// Should not crash and existingFiles should remain empty
			const existingFiles = (watcher as unknown as ImageWatcherTestAccess).existingFiles;
			expect(existingFiles.size).toBe(0);
		});

		it('should resolve file paths to absolute paths', async () => {
			const directoryPath = '/test/directory';
			const mockFiles = ['./image1.jpg', '../other/image2.png'];

			mockFindImageFiles.mockResolvedValue(mockFiles);

			await (watcher as unknown as ImageWatcherTestAccess).scanExistingFiles(directoryPath);

			const existingFiles = (watcher as unknown as ImageWatcherTestAccess).existingFiles;

			// Check that relative paths were converted to absolute
			expect(existingFiles.has(path.resolve('./image1.jpg'))).toBe(true);
			expect(existingFiles.has(path.resolve('../other/image2.png'))).toBe(true);
		});
	});

	describe('processNewFile', () => {
		let watcher: ImageWatcher;
		let mockRenamer: any;

		beforeEach(() => {
			watcher = new ImageWatcher(mockLogger, testConfig, { llmClient: mockLlmClient, quiet: true });

			// Access the private renamer and create a mock
			mockRenamer = {
				testConnection: vi.fn(),
				generateNewFilename: vi.fn(),
				safeFileMove: vi.fn(),
				safeFileMoveWithDatabaseUpdate: vi.fn().mockResolvedValue('NotModified'),
			};
			(watcher as unknown as ImageWatcherTestAccess).renamer = mockRenamer;

			// Reset collection states
			(watcher as unknown as ImageWatcherTestAccess).existingFiles.clear();
			(watcher as unknown as ImageWatcherTestAccess).processingFiles.clear();
			(watcher as unknown as ImageWatcherTestAccess).processedFiles.clear();
			(watcher as unknown as ImageWatcherTestAccess).filesProcessed = 0;
			(watcher as unknown as ImageWatcherTestAccess).filesFailed = 0;
		});

		it('should return early if file should be ignored', async () => {
			const filePath = '/path/to/image.jpg';
			mockIsSupportedImage.mockReturnValue(false); // Will be ignored

			await (watcher as unknown as ImageWatcherTestAccess).processNewFile(filePath);

			// Should not modify any collections or call renamer methods
			expect((watcher as unknown as ImageWatcherTestAccess).processingFiles.size).toBe(0);
			expect((watcher as unknown as ImageWatcherTestAccess).processedFiles.size).toBe(0);
			expect((watcher as unknown as ImageWatcherTestAccess).filesProcessed).toBe(0);
			expect((watcher as unknown as ImageWatcherTestAccess).filesFailed).toBe(0);
			expect(mockRenamer.testConnection).not.toHaveBeenCalled();
		});

		it('should successfully process file and update collections correctly', async () => {
			const filePath = '/path/to/image.jpg';
			const newPath = '/path/to/new-name.jpg';
			const resolvedOriginal = path.resolve(filePath);
			const resolvedNew = path.resolve(newPath);

			mockIsSupportedImage.mockReturnValue(true);
			mockRenamer.testConnection.mockResolvedValue(true);
			mockRenamer.generateNewFilename.mockResolvedValue(newPath);
			mockRenamer.safeFileMoveWithDatabaseUpdate.mockResolvedValue('NotModified');

			await (watcher as unknown as ImageWatcherTestAccess).processNewFile(filePath);

			// Verify collection states after successful processing
			expect((watcher as unknown as ImageWatcherTestAccess).processingFiles.has(resolvedOriginal)).toBe(false); // Removed in finally
			expect((watcher as unknown as ImageWatcherTestAccess).processedFiles.has(resolvedOriginal)).toBe(true);
			expect((watcher as unknown as ImageWatcherTestAccess).processedFiles.has(resolvedNew)).toBe(true);
			expect((watcher as unknown as ImageWatcherTestAccess).filesProcessed).toBe(1);
			expect((watcher as unknown as ImageWatcherTestAccess).filesFailed).toBe(0);

			// Verify renamer methods were called
			expect(mockRenamer.testConnection).toHaveBeenCalled();
			expect(mockRenamer.generateNewFilename).toHaveBeenCalledWith(filePath);
			expect(mockRenamer.safeFileMoveWithDatabaseUpdate).toHaveBeenCalledWith(filePath, newPath);
		});

		it('should handle no rename needed case correctly', async () => {
			const filePath = '/path/to/image.jpg';
			const resolvedPath = path.resolve(filePath);

			mockIsSupportedImage.mockReturnValue(true);
			mockRenamer.testConnection.mockResolvedValue(true);
			mockRenamer.generateNewFilename.mockResolvedValue(filePath); // Same path = no rename needed

			await (watcher as unknown as ImageWatcherTestAccess).processNewFile(filePath);

			// Verify collection states
			expect((watcher as unknown as ImageWatcherTestAccess).processingFiles.has(resolvedPath)).toBe(false); // Removed in finally
			expect((watcher as unknown as ImageWatcherTestAccess).processedFiles.has(resolvedPath)).toBe(true);
			expect((watcher as unknown as ImageWatcherTestAccess).filesProcessed).toBe(1);
			expect((watcher as unknown as ImageWatcherTestAccess).filesFailed).toBe(0);

			// safeFileMove should not be called when no rename is needed
			expect(mockRenamer.safeFileMove).not.toHaveBeenCalled();
		});

		it('should handle Ollama connection failure and clean up properly', async () => {
			const filePath = '/path/to/image.jpg';
			const resolvedPath = path.resolve(filePath);

			mockIsSupportedImage.mockReturnValue(true);
			mockRenamer.testConnection.mockResolvedValue(false);

			await (watcher as unknown as ImageWatcherTestAccess).processNewFile(filePath);

			// Verify collection states after connection failure
			expect((watcher as unknown as ImageWatcherTestAccess).processingFiles.has(resolvedPath)).toBe(false); // Removed in finally
			expect((watcher as unknown as ImageWatcherTestAccess).processedFiles.has(resolvedPath)).toBe(false); // Never added
			expect((watcher as unknown as ImageWatcherTestAccess).filesProcessed).toBe(0);
			expect((watcher as unknown as ImageWatcherTestAccess).filesFailed).toBe(1);

			expect(mockRenamer.generateNewFilename).not.toHaveBeenCalled();
		});

		it('should handle filename generation failure without stopOnError', async () => {
			const filePath = '/path/to/image.jpg';
			const resolvedPath = path.resolve(filePath);

			watcher = new ImageWatcher(mockLogger, testConfig, {
				llmClient: mockLlmClient,
				quiet: true,
				stopOnError: false,
			});
			(watcher as unknown as ImageWatcherTestAccess).renamer = mockRenamer;

			mockIsSupportedImage.mockReturnValue(true);
			mockRenamer.testConnection.mockResolvedValue(true);
			mockRenamer.generateNewFilename.mockResolvedValue(null); // Failed to generate

			await (watcher as unknown as ImageWatcherTestAccess).processNewFile(filePath);

			// Verify collection states after filename generation failure
			expect((watcher as unknown as ImageWatcherTestAccess).processingFiles.has(resolvedPath)).toBe(false); // Removed in finally
			expect((watcher as unknown as ImageWatcherTestAccess).processedFiles.has(resolvedPath)).toBe(false); // Never added
			expect((watcher as unknown as ImageWatcherTestAccess).filesProcessed).toBe(0);
			expect((watcher as unknown as ImageWatcherTestAccess).filesFailed).toBe(1);

			expect(mockRenamer.safeFileMove).not.toHaveBeenCalled();
		});

		it('should handle filename generation failure with stopOnError', async () => {
			const filePath = '/path/to/image.jpg';
			const resolvedPath = path.resolve(filePath);

			watcher = new ImageWatcher(mockLogger, testConfig, {
				llmClient: mockLlmClient,
				quiet: true,
				stopOnError: true,
			});
			(watcher as unknown as ImageWatcherTestAccess).renamer = mockRenamer;

			mockIsSupportedImage.mockReturnValue(true);
			mockRenamer.testConnection.mockResolvedValue(true);
			mockRenamer.generateNewFilename.mockResolvedValue(null);

			await expect((watcher as unknown as ImageWatcherTestAccess).processNewFile(filePath)).rejects.toThrow(
				'Filename generation failed'
			);

			// Verify collection states after error
			expect((watcher as unknown as ImageWatcherTestAccess).processingFiles.has(resolvedPath)).toBe(false); // Removed in finally
			expect((watcher as unknown as ImageWatcherTestAccess).processedFiles.has(resolvedPath)).toBe(false);
			expect((watcher as unknown as ImageWatcherTestAccess).filesProcessed).toBe(0);
			expect((watcher as unknown as ImageWatcherTestAccess).filesFailed).toBe(2); // Incremented twice: once for filename failure, once in outer catch
		});

		it('should handle file move failure and clean up processedFiles', async () => {
			const filePath = '/path/to/image.jpg';
			const newPath = '/path/to/new-name.jpg';
			const resolvedOriginal = path.resolve(filePath);
			const resolvedNew = path.resolve(newPath);

			mockIsSupportedImage.mockReturnValue(true);
			mockRenamer.testConnection.mockResolvedValue(true);
			mockRenamer.generateNewFilename.mockResolvedValue(newPath);
			mockRenamer.safeFileMoveWithDatabaseUpdate.mockRejectedValue(new Error('Move failed'));

			await (watcher as unknown as ImageWatcherTestAccess).processNewFile(filePath);

			// Verify collection cleanup after move failure
			expect((watcher as unknown as ImageWatcherTestAccess).processingFiles.has(resolvedOriginal)).toBe(false); // Removed in finally
			expect((watcher as unknown as ImageWatcherTestAccess).processedFiles.has(resolvedOriginal)).toBe(false); // Removed on failure
			expect((watcher as unknown as ImageWatcherTestAccess).processedFiles.has(resolvedNew)).toBe(false); // Removed on failure
			expect((watcher as unknown as ImageWatcherTestAccess).filesProcessed).toBe(0);
			expect((watcher as unknown as ImageWatcherTestAccess).filesFailed).toBe(2); // Incremented twice: once in move catch, once in outer catch
		});

		it('should handle file move failure with stopOnError enabled', async () => {
			const filePath = '/path/to/image.jpg';
			const newPath = '/path/to/new-name.jpg';
			const resolvedOriginal = path.resolve(filePath);

			watcher = new ImageWatcher(mockLogger, testConfig, {
				llmClient: mockLlmClient,
				quiet: true,
				stopOnError: true,
			});
			(watcher as unknown as ImageWatcherTestAccess).renamer = mockRenamer;

			mockIsSupportedImage.mockReturnValue(true);
			mockRenamer.testConnection.mockResolvedValue(true);
			mockRenamer.generateNewFilename.mockResolvedValue(newPath);
			mockRenamer.safeFileMoveWithDatabaseUpdate.mockRejectedValue(new Error('Move failed'));

			await expect((watcher as unknown as ImageWatcherTestAccess).processNewFile(filePath)).rejects.toThrow(
				'Stopping watch due to processing error'
			);

			// Verify cleanup even when error is re-thrown
			expect((watcher as unknown as ImageWatcherTestAccess).processingFiles.has(resolvedOriginal)).toBe(false);
			expect((watcher as unknown as ImageWatcherTestAccess).processedFiles.size).toBe(0); // Cleaned up
			expect((watcher as unknown as ImageWatcherTestAccess).filesFailed).toBe(2); // Incremented twice: once in move catch, once in outer catch
		});

		it('should properly track processing state during execution', async () => {
			const filePath = '/path/to/image.jpg';
			const newPath = '/path/to/new-name.jpg';
			const resolvedOriginal = path.resolve(filePath);
			const resolvedNew = path.resolve(newPath);

			mockIsSupportedImage.mockReturnValue(true);
			mockRenamer.testConnection.mockResolvedValue(true);
			mockRenamer.generateNewFilename.mockResolvedValue(newPath);

			// Mock safeFileMoveWithDatabaseUpdate to check state during execution
			mockRenamer.safeFileMoveWithDatabaseUpdate.mockImplementation(async () => {
				// During execution, file should be in processing and processed sets
				expect((watcher as unknown as ImageWatcherTestAccess).processingFiles.has(resolvedOriginal)).toBe(true);
				expect((watcher as unknown as ImageWatcherTestAccess).processedFiles.has(resolvedOriginal)).toBe(true);
				expect((watcher as unknown as ImageWatcherTestAccess).processedFiles.has(resolvedNew)).toBe(true);
				return 'NotModified';
			});

			await (watcher as unknown as ImageWatcherTestAccess).processNewFile(filePath);

			// After completion, should be removed from processing but remain in processed
			expect((watcher as unknown as ImageWatcherTestAccess).processingFiles.has(resolvedOriginal)).toBe(false);
			expect((watcher as unknown as ImageWatcherTestAccess).processedFiles.has(resolvedOriginal)).toBe(true);
			expect((watcher as unknown as ImageWatcherTestAccess).processedFiles.has(resolvedNew)).toBe(true);
		});

		it('should always remove from processingFiles even if unexpected error occurs', async () => {
			const filePath = '/path/to/image.jpg';
			const resolvedPath = path.resolve(filePath);

			mockIsSupportedImage.mockReturnValue(true);
			mockRenamer.testConnection.mockRejectedValue(new Error('Unexpected error'));

			await (watcher as unknown as ImageWatcherTestAccess).processNewFile(filePath);

			// Even with unexpected error, processingFiles should be cleaned up
			expect((watcher as unknown as ImageWatcherTestAccess).processingFiles.has(resolvedPath)).toBe(false);
			expect((watcher as unknown as ImageWatcherTestAccess).filesFailed).toBe(1);
		});

		it('should handle case where new path equals original path', async () => {
			const filePath = '/path/to/image.jpg';
			const resolvedPath = path.resolve(filePath);

			mockIsSupportedImage.mockReturnValue(true);
			mockRenamer.testConnection.mockResolvedValue(true);
			mockRenamer.generateNewFilename.mockResolvedValue(filePath); // Same path

			await (watcher as unknown as ImageWatcherTestAccess).processNewFile(filePath);

			// Should only add the single path once to processedFiles
			expect((watcher as unknown as ImageWatcherTestAccess).processedFiles.has(resolvedPath)).toBe(true);
			expect((watcher as unknown as ImageWatcherTestAccess).processedFiles.size).toBe(1);
			expect((watcher as unknown as ImageWatcherTestAccess).filesProcessed).toBe(1);
		});

		it('should call safeFileMoveWithDatabaseUpdate instead of safeFileMove', async () => {
			const filePath = '/path/to/image.jpg';
			const newPath = '/path/to/new-name.jpg';

			mockIsSupportedImage.mockReturnValue(true);
			mockRenamer.testConnection.mockResolvedValue(true);
			mockRenamer.generateNewFilename.mockResolvedValue(newPath);
			mockRenamer.safeFileMoveWithDatabaseUpdate = vi.fn().mockResolvedValue('Modified');

			await (watcher as unknown as ImageWatcherTestAccess).processNewFile(filePath);

			// Should call safeFileMoveWithDatabaseUpdate instead of safeFileMove
			expect(mockRenamer.safeFileMoveWithDatabaseUpdate).toHaveBeenCalledWith(filePath, newPath);
		});
	});

	describe('startWatching', () => {
		it('should fail with Ollama connection error when not connected', async () => {
			mockPathExists.mockResolvedValue(true);

			// Mock fs.promises.stat to return a directory
			mockFsStat.mockResolvedValue({
				isDirectory: vi.fn().mockReturnValue(true),
			});

			const watcher = new ImageWatcher(mockLogger, testConfig, { llmClient: mockLlmClient, quiet: true });

			await expect(watcher.startWatching('/tmp')).rejects.toThrow(
				'Cannot connect to Ollama API - ensure Ollama is running'
			);
		});
	});
});
