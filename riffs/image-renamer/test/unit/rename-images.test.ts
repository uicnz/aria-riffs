/**
 * Unit tests for image-renamer class
 */

import * as path from 'node:path';
import { beforeEach, describe, expect, it, type MockedObject, vi } from 'vitest';
import type { ImageRenamerConfig } from '../../src/lib/schema.js';

// Mock dependencies
vi.mock('fs', () => ({
	promises: {
		stat: vi.fn(),
		unlink: vi.fn(),
	},
}));

vi.mock('fs-extra', () => ({
	pathExists: vi.fn(),
	copy: vi.fn(),
}));

// Mock cli-progress with hoisted functions to survive vi.clearAllMocks()
const { mockProgressBarGetTotal, MockSingleBar } = vi.hoisted(() => {
	const mockProgressBarStart = vi.fn();
	const mockProgressBarUpdate = vi.fn();
	const mockProgressBarStop = vi.fn();
	const mockProgressBarGetTotal = vi.fn().mockReturnValue(100);
	const MockSingleBar = vi.fn().mockImplementation(() => ({
		start: mockProgressBarStart,
		update: mockProgressBarUpdate,
		stop: mockProgressBarStop,
		getTotal: mockProgressBarGetTotal,
	}));
	return {
		mockProgressBarGetTotal,
		MockSingleBar,
	};
});

vi.mock('cli-progress', () => ({
	default: {
		SingleBar: MockSingleBar,
	},
}));

vi.mock('chalk', () => ({
	default: {
		cyan: vi.fn((text: string) => text),
		green: vi.fn((text: string) => text),
		yellow: vi.fn((text: string) => text),
		gray: vi.fn((text: string) => text),
		red: vi.fn((text: string) => text),
	},
}));

vi.mock('../../src/utils/utils.js', () => ({
	sanitizeFilename: vi.fn(),
	getUniqueFilename: vi.fn(),
	findImageFiles: vi.fn(),
	verifyImage: vi.fn(),
	isSupportedImage: vi.fn(),
	sleep: vi.fn(),
}));

import * as fs from 'node:fs';
import * as fsExtra from 'fs-extra';
import type { Logger } from 'pino';
import { ImageRenamer } from '../../src/core/rename-images.js';
import { FileOperationError, ImageRenameError, type LLMClient, LlmConnectionError } from '../../src/lib/types.js';
import * as utils from '../../src/utils/utils.js';
import { createMockLogger } from './fakes.js';

// Create a test config factory
function createTestConfig(overrides: Partial<ImageRenamerConfig> = {}): ImageRenamerConfig {
	const defaultConfig: ImageRenamerConfig = {
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
			file: '.aria/logs/test/image-renamer-rename.log',
			maxFileSizeMb: 10,
			maxFiles: 7,
		},
	};

	return { ...defaultConfig, ...overrides };
}

describe('ImageRenamer', () => {
	let mockLogger: Logger;
	let mockLlmClient: MockedObject<LLMClient>;
	let testConfig: ImageRenamerConfig;

	beforeEach(() => {
		vi.clearAllMocks();

		// Create mock logger
		mockLogger = createMockLogger();
		testConfig = createTestConfig();

		// Re-setup progress bar mock after clearAllMocks
		mockProgressBarGetTotal.mockReturnValue(100);

		// Create mock LLMClient instance
		mockLlmClient = {
			generateFilename: vi.fn(),
			testConnection: vi.fn(),
			checkConnectionWithDiagnostics: vi.fn(),
			listModels: vi.fn(),
			modelName: 'test-model',
			endpointUrl: 'http://test-endpoint',
		} as unknown as MockedObject<LLMClient>;

		// Setup utility function mocks
		(utils.sanitizeFilename as ReturnType<typeof vi.fn>).mockImplementation((name: string) =>
			name.toLowerCase().replace(/[^a-z0-9]/g, '-')
		);
		(utils.getUniqueFilename as ReturnType<typeof vi.fn>).mockImplementation(
			async (originalPath: string, newBasename: string) =>
				path.join(path.dirname(originalPath), newBasename + path.extname(originalPath))
		);
		(utils.verifyImage as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
		(utils.isSupportedImage as ReturnType<typeof vi.fn>).mockReturnValue(true);
		(utils.sleep as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
		(utils.findImageFiles as ReturnType<typeof vi.fn>).mockResolvedValue([]);

		// Setup fs mocks
		(fs.promises.stat as ReturnType<typeof vi.fn>).mockResolvedValue({ size: 1024 });
		(fs.promises.unlink as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
		(fsExtra.copy as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
		(fsExtra.pathExists as ReturnType<typeof vi.fn>).mockResolvedValue(true);
	});

	describe('constructor', () => {
		it('should create ImageRenamer with provided LLMClient', () => {
			const renamer = new ImageRenamer(mockLogger, mockLlmClient, undefined, testConfig);

			expect(renamer.llm).toBe(mockLlmClient);
		});
	});

	describe('generateNewFilename', () => {
		let renamer: ImageRenamer;

		beforeEach(() => {
			renamer = new ImageRenamer(mockLogger, mockLlmClient, undefined, testConfig);
		});

		it('should generate new filename successfully', async () => {
			const imagePath = '/path/to/image.jpg';
			const aiDescription = 'Beautiful mountain landscape';
			const sanitizedName = 'beautiful-mountain-landscape';
			const uniquePath = '/path/to/beautiful-mountain-landscape.jpg';

			mockLlmClient.generateFilename.mockResolvedValue(aiDescription);
			(utils.sanitizeFilename as ReturnType<typeof vi.fn>).mockReturnValue(sanitizedName);
			(utils.getUniqueFilename as ReturnType<typeof vi.fn>).mockResolvedValue(uniquePath);

			const result = await renamer.generateNewFilename(imagePath);

			expect(result).toBe(uniquePath);
			expect(mockLlmClient.generateFilename).toHaveBeenCalledWith(imagePath, undefined);
			expect(utils.sanitizeFilename).toHaveBeenCalledWith(aiDescription, testConfig);
			expect(utils.getUniqueFilename).toHaveBeenCalledWith(imagePath, sanitizedName);
		});

		it('should generate filename with custom prompt', async () => {
			const imagePath = '/path/to/image.jpg';
			const customPrompt = 'Generate a short name';
			const aiDescription = 'Sunset';
			const sanitizedName = 'sunset';
			const uniquePath = '/path/to/sunset.jpg';

			mockLlmClient.generateFilename.mockResolvedValue(aiDescription);
			(utils.sanitizeFilename as ReturnType<typeof vi.fn>).mockReturnValue(sanitizedName);
			(utils.getUniqueFilename as ReturnType<typeof vi.fn>).mockResolvedValue(uniquePath);

			const result = await renamer.generateNewFilename(imagePath, customPrompt);

			expect(result).toBe(uniquePath);
			expect(mockLlmClient.generateFilename).toHaveBeenCalledWith(imagePath, customPrompt);
		});

		it('should propagate LlmConnectionError', async () => {
			const imagePath = '/path/to/image.jpg';
			const error = new LlmConnectionError('Connection failed');

			mockLlmClient.generateFilename.mockRejectedValue(error);

			await expect(renamer.generateNewFilename(imagePath)).rejects.toThrow(LlmConnectionError);
			await expect(renamer.generateNewFilename(imagePath)).rejects.toThrow('Connection failed');
		});

		it('should wrap other errors in ImageRenameError', async () => {
			const imagePath = '/path/to/image.jpg';
			const error = new Error('Generic error');

			mockLlmClient.generateFilename.mockRejectedValue(error);

			await expect(renamer.generateNewFilename(imagePath)).rejects.toThrow(ImageRenameError);
			await expect(renamer.generateNewFilename(imagePath)).rejects.toThrow(
				'Failed to generate filename for image.jpg: Error: Generic error'
			);
		});
	});

	describe('testConnection', () => {
		it('should delegate to LLMClient testConnection', async () => {
			const renamer = new ImageRenamer(mockLogger, mockLlmClient, undefined, testConfig);
			mockLlmClient.testConnection.mockResolvedValue(true);

			const result = await renamer.testConnection();

			expect(result).toBe(true);
			expect(mockLlmClient.testConnection).toHaveBeenCalled();
		});
	});

	describe('safeFileMove', () => {
		let renamer: ImageRenamer;

		beforeEach(() => {
			renamer = new ImageRenamer(mockLogger, mockLlmClient, undefined, testConfig);
		});

		it('should successfully move file on first attempt', async () => {
			const sourcePath = '/source/image.jpg';
			const destinationPath = '/dest/image.jpg';

			await renamer.safeFileMove(sourcePath, destinationPath);

			expect(fsExtra.copy).toHaveBeenCalledWith(sourcePath, destinationPath);
			expect(fs.promises.stat).toHaveBeenCalledWith(sourcePath);
			expect(fs.promises.stat).toHaveBeenCalledWith(destinationPath);
			expect(fs.promises.unlink).toHaveBeenCalledWith(sourcePath);
		});

		it('should verify file sizes match after copy', async () => {
			const sourcePath = '/source/image.jpg';
			const destinationPath = '/dest/image.jpg';

			(fs.promises.stat as ReturnType<typeof vi.fn>)
				.mockResolvedValueOnce({ size: 1024 }) // source
				.mockResolvedValueOnce({ size: 1024 }); // destination

			await renamer.safeFileMove(sourcePath, destinationPath);

			expect(fs.promises.stat).toHaveBeenCalledTimes(2);
			expect(fs.promises.unlink).toHaveBeenCalledWith(sourcePath);
		});

		it('should throw error when file sizes mismatch', async () => {
			const sourcePath = '/source/image.jpg';
			const destinationPath = '/dest/image.jpg';

			// Mock alternating file sizes - source always 1024, destination always 512
			(fs.promises.stat as ReturnType<typeof vi.fn>).mockImplementation(async (filePath: string) => {
				if (filePath === sourcePath) {
					return { size: 1024 };
				}
				return { size: 512 }; // destination path
			});

			await expect(renamer.safeFileMove(sourcePath, destinationPath)).rejects.toThrow(FileOperationError);
		});

		it('should retry on failure and succeed', async () => {
			const sourcePath = '/source/image.jpg';
			const destinationPath = '/dest/image.jpg';

			(fsExtra.copy as ReturnType<typeof vi.fn>)
				.mockRejectedValueOnce(new Error('Copy failed'))
				.mockResolvedValueOnce(undefined);

			await renamer.safeFileMove(sourcePath, destinationPath);

			expect(fsExtra.copy).toHaveBeenCalledTimes(2);
			expect(utils.sleep).toHaveBeenCalledWith(0.5);
		});

		it('should clean up destination file on failure', async () => {
			const sourcePath = '/source/image.jpg';
			const destinationPath = '/dest/image.jpg';

			(fsExtra.copy as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Copy failed'));
			(fsExtra.pathExists as ReturnType<typeof vi.fn>).mockResolvedValue(true);

			await expect(renamer.safeFileMove(sourcePath, destinationPath)).rejects.toThrow(FileOperationError);

			expect(fs.promises.unlink).toHaveBeenCalledWith(destinationPath);
		});

		it('should throw FileOperationError after max retries', async () => {
			const sourcePath = '/source/image.jpg';
			const destinationPath = '/dest/image.jpg';

			// Reset mocks to ensure clean state
			vi.clearAllMocks();
			(fsExtra.copy as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Persistent error'));

			await expect(renamer.safeFileMove(sourcePath, destinationPath)).rejects.toThrow(FileOperationError);

			expect(fsExtra.copy).toHaveBeenCalledTimes(3);
			expect(utils.sleep).toHaveBeenCalledTimes(2);
		});
	});

	describe('safeFileMoveWithDatabaseUpdate', () => {
		it('given file paths and database manager, when called, then moves file and updates database', async () => {
			// Given: Source and destination paths with database manager
			const sourcePath = '/source/image.jpg';
			const destinationPath = '/dest/image.jpg';
			const mockDbManager = {
				saveDescription: vi.fn().mockResolvedValue(undefined),
				updateFilePath: vi.fn().mockResolvedValue('Modified'),
				close: vi.fn(),
			};
			const renamer = new ImageRenamer(mockLogger, mockLlmClient, mockDbManager, testConfig);
			vi.spyOn(renamer, 'safeFileMove').mockResolvedValue(undefined);

			// When: safeFileMoveWithDatabaseUpdate is called
			const result = await renamer.safeFileMoveWithDatabaseUpdate(sourcePath, destinationPath);

			// Then: Should call safeFileMove
			expect(renamer.safeFileMove).toHaveBeenCalledWith(sourcePath, destinationPath);

			// And: Should update database
			expect(mockDbManager.updateFilePath).toHaveBeenCalledWith(sourcePath, destinationPath);

			// And: Should return WasModified result
			expect(result).toBe('Modified');
		});

		it('given no database manager, when called, then only moves file', async () => {
			// Given: Source and destination paths without database manager
			const sourcePath = '/source/image.jpg';
			const destinationPath = '/dest/image.jpg';
			const renamer = new ImageRenamer(mockLogger, mockLlmClient, undefined, testConfig);
			vi.spyOn(renamer, 'safeFileMove').mockResolvedValue(undefined);

			// When: safeFileMoveWithDatabaseUpdate is called
			const result = await renamer.safeFileMoveWithDatabaseUpdate(sourcePath, destinationPath);

			// Then: Should call safeFileMove
			expect(renamer.safeFileMove).toHaveBeenCalledWith(sourcePath, destinationPath);

			// And: Should return NotModified (no database to update)
			expect(result).toBe('NotModified');
		});
	});

	describe('renameSingleImage', () => {
		let renamer: ImageRenamer;

		beforeEach(() => {
			renamer = new ImageRenamer(mockLogger, mockLlmClient, undefined, testConfig);
			vi.spyOn(renamer, 'generateNewFilename').mockResolvedValue('/path/new-name.jpg');
			vi.spyOn(renamer, 'safeFileMove').mockResolvedValue(undefined);
		});

		it('should skip unsupported image files', async () => {
			(utils.isSupportedImage as ReturnType<typeof vi.fn>).mockReturnValue(false);

			const result = await renamer.renameSingleImage('/path/document.txt');

			expect(result).toBe(false);
			expect(mockLogger.debug).toHaveBeenCalledWith(
				expect.objectContaining({ imagePath: '/path/document.txt' }),
				expect.stringContaining('Skipping unsupported file: document.txt')
			);
			expect(utils.verifyImage).not.toHaveBeenCalled();
		});

		it('should skip files that do not need renaming', async () => {
			const imagePath = '/path/image.jpg';
			vi.spyOn(renamer, 'generateNewFilename').mockResolvedValue(imagePath);

			const result = await renamer.renameSingleImage(imagePath);

			expect(result).toBe(true);
			expect(mockLogger.debug).toHaveBeenCalledWith(
				expect.objectContaining({ imagePath }),
				expect.stringContaining('No rename needed: image.jpg')
			);
			expect(renamer.safeFileMove).not.toHaveBeenCalled();
		});

		it('should perform dry run without moving files', async () => {
			const imagePath = '/path/original.jpg';
			const newPath = '/path/new-name.jpg';
			vi.spyOn(renamer, 'generateNewFilename').mockResolvedValue(newPath);

			const result = await renamer.renameSingleImage(imagePath, true);

			expect(result).toBe(true);
			expect(mockLogger.info).toHaveBeenCalledWith(
				expect.objectContaining({ imagePath, newPath }),
				expect.stringContaining('DRY RUN: original.jpg -> new-name.jpg')
			);
			expect(renamer.safeFileMove).not.toHaveBeenCalled();
		});

		it('should successfully rename image', async () => {
			const imagePath = '/path/original.jpg';
			const newPath = '/path/new-name.jpg';
			vi.spyOn(renamer, 'generateNewFilename').mockResolvedValue(newPath);

			const result = await renamer.renameSingleImage(imagePath, false);

			expect(result).toBe(true);
			expect(utils.verifyImage).toHaveBeenCalledWith(imagePath, testConfig);
			expect(renamer.generateNewFilename).toHaveBeenCalledWith(imagePath, undefined);
			expect(mockLogger.info).toHaveBeenCalledWith(
				expect.objectContaining({ imagePath, newPath }),
				expect.stringContaining('original.jpg -> new-name.jpg')
			);
		});

		it('should pass custom prompt to generateNewFilename', async () => {
			const imagePath = '/path/original.jpg';
			const customPrompt = 'Short name please';
			vi.spyOn(renamer, 'generateNewFilename').mockResolvedValue('/path/short.jpg');

			await renamer.renameSingleImage(imagePath, false, customPrompt);

			expect(renamer.generateNewFilename).toHaveBeenCalledWith(imagePath, customPrompt);
		});

		it('should handle errors and return false', async () => {
			const imagePath = '/path/original.jpg';
			const error = new Error('Processing failed');
			(utils.verifyImage as ReturnType<typeof vi.fn>).mockRejectedValue(error);

			const result = await renamer.renameSingleImage(imagePath);

			expect(result).toBe(false);
			expect(mockLogger.error).toHaveBeenCalledWith(
				expect.objectContaining({ imagePath }),
				expect.stringContaining('original.jpg: Processing failed')
			);
		});

		it('should handle progress bar correctly', async () => {
			const imagePath = '/path/original.jpg';
			const mockProgressBar = {
				start: vi.fn(),
				stop: vi.fn(),
				update: vi.fn(),
				getTotal: vi.fn().mockReturnValue(100),
			};

			const result = await renamer.renameSingleImage(imagePath, false, undefined, mockProgressBar as any, 50);

			expect(result).toBe(true);
			// Progress bar should be stopped/started around console output
			expect(mockProgressBar.stop).toHaveBeenCalled();
			expect(mockProgressBar.start).toHaveBeenCalledWith(100, 50);
		});

		it('should log database update when record was modified', async () => {
			const imagePath = '/path/original.jpg';
			mockLlmClient.generateFilename.mockResolvedValue('new-filename');

			const mockDbManager = {
				saveDescription: vi.fn().mockResolvedValue(undefined),
				updateFilePath: vi.fn().mockResolvedValue('Modified'),
				close: vi.fn(),
			};
			const renamerWithDb = new ImageRenamer(mockLogger, mockLlmClient, mockDbManager, testConfig);

			await renamerWithDb.renameSingleImage(imagePath, false);

			expect(mockDbManager.updateFilePath).toHaveBeenCalledWith(imagePath, '/path/new-filename.jpg');
			expect(mockLogger.debug).toHaveBeenCalledWith(
				expect.objectContaining({ imagePath }),
				expect.stringContaining('Database updated')
			);
		});

		it('should log database not updated when record was not modified', async () => {
			const imagePath = '/path/original.jpg';
			mockLlmClient.generateFilename.mockResolvedValue('new-filename');

			const mockDbManager = {
				saveDescription: vi.fn().mockResolvedValue(undefined),
				updateFilePath: vi.fn().mockResolvedValue('NotModified'),
				close: vi.fn(),
			};
			const renamerWithDb = new ImageRenamer(mockLogger, mockLlmClient, mockDbManager, testConfig);

			await renamerWithDb.renameSingleImage(imagePath, false);

			expect(mockDbManager.updateFilePath).toHaveBeenCalledWith(imagePath, '/path/new-filename.jpg');
			expect(mockLogger.debug).toHaveBeenCalledWith(
				expect.objectContaining({ imagePath }),
				expect.stringContaining('Database not updated')
			);
		});
	});

	describe('renameDirectory', () => {
		let renamer: ImageRenamer;

		beforeEach(() => {
			renamer = new ImageRenamer(mockLogger, mockLlmClient, undefined, testConfig);
			vi.spyOn(renamer, 'renameSingleImage').mockResolvedValue(true);
		});

		it('should throw error for non-existent directory', async () => {
			(fsExtra.pathExists as ReturnType<typeof vi.fn>).mockResolvedValue(false);

			await expect(renamer.renameDirectory('/nonexistent')).rejects.toThrow(ImageRenameError);
			await expect(renamer.renameDirectory('/nonexistent')).rejects.toThrow('Directory not found: /nonexistent');
		});

		it('should handle empty directory', async () => {
			(utils.findImageFiles as ReturnType<typeof vi.fn>).mockResolvedValue([]);

			const results = await renamer.renameDirectory('/empty/dir');

			expect(results.total_files).toBe(0);
			expect(results.processed).toBe(0);
			expect(results.failed).toBe(0);
			expect(results.skipped).toBe(0);
			expect(mockLogger.warn).toHaveBeenCalledWith(
				expect.objectContaining({ directoryPath: expect.any(String) }),
				'No supported image files found'
			);
		});

		it('should process directory successfully', async () => {
			const imageFiles = ['/dir/image1.jpg', '/dir/image2.png', '/dir/image3.gif'];
			(utils.findImageFiles as ReturnType<typeof vi.fn>).mockResolvedValue(imageFiles);

			// Add small delay to ensure processing_time > 0
			vi.spyOn(renamer, 'renameSingleImage').mockImplementation(async () => {
				await new Promise(resolve => setTimeout(resolve, 1));
				return true;
			});

			const results = await renamer.renameDirectory('/test/dir', { showProgress: false });

			expect(results.total_files).toBe(3);
			expect(results.processed).toBe(3);
			expect(results.failed).toBe(0);
			expect(results.skipped).toBe(0);
			expect(results.processing_time).toBeGreaterThanOrEqual(0);
			expect(utils.findImageFiles).toHaveBeenCalledWith(path.resolve('/test/dir'), testConfig, undefined);
			expect(renamer.renameSingleImage).toHaveBeenCalledTimes(3);
		});

		it('should use recursive option when specified', async () => {
			(utils.findImageFiles as ReturnType<typeof vi.fn>).mockResolvedValue([]);

			await renamer.renameDirectory('/test/dir', { recursive: true });

			expect(utils.findImageFiles).toHaveBeenCalledWith(path.resolve('/test/dir'), testConfig, true);
		});

		it('should pass dry run option to renameSingleImage', async () => {
			const imageFiles = ['/dir/image1.jpg'];
			(utils.findImageFiles as ReturnType<typeof vi.fn>).mockResolvedValue(imageFiles);

			await renamer.renameDirectory('/test/dir', { dryRun: true, showProgress: false });

			expect(renamer.renameSingleImage).toHaveBeenCalledWith(
				'/dir/image1.jpg',
				true,
				undefined,
				null, // showProgress: false means no progressBar
				1
			);
		});

		it('should pass custom prompt to renameSingleImage', async () => {
			const imageFiles = ['/dir/image1.jpg'];
			const customPrompt = 'Short filename';
			(utils.findImageFiles as ReturnType<typeof vi.fn>).mockResolvedValue(imageFiles);

			await renamer.renameDirectory('/test/dir', { customPrompt, showProgress: false });

			expect(renamer.renameSingleImage).toHaveBeenCalledWith(
				'/dir/image1.jpg',
				undefined,
				customPrompt,
				null, // showProgress: false means no progressBar
				1
			);
		});

		it('should handle mixed success and failure results', async () => {
			const imageFiles = ['/dir/image1.jpg', '/dir/image2.png', '/dir/image3.gif'];
			(utils.findImageFiles as ReturnType<typeof vi.fn>).mockResolvedValue(imageFiles);

			vi.spyOn(renamer, 'renameSingleImage')
				.mockResolvedValueOnce(true) // success
				.mockResolvedValueOnce(false) // skipped
				.mockRejectedValueOnce(new Error('Processing failed')); // failed

			const results = await renamer.renameDirectory('/test/dir', { showProgress: false });

			expect(results.total_files).toBe(3);
			expect(results.processed).toBe(1);
			expect(results.skipped).toBe(1);
			expect(results.failed).toBe(1);
			expect(results.errors).toEqual(['image3.gif: Processing failed']);
		});

		it('should disable progress bar when showProgress is false', async () => {
			const imageFiles = ['/dir/image1.jpg'];
			(utils.findImageFiles as ReturnType<typeof vi.fn>).mockResolvedValue(imageFiles);

			await renamer.renameDirectory('/test/dir', { showProgress: false });

			expect(renamer.renameSingleImage).toHaveBeenCalledWith('/dir/image1.jpg', undefined, undefined, null, 1);
		});

		it('should handle directory processing errors', async () => {
			(utils.findImageFiles as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Permission denied'));

			await expect(renamer.renameDirectory('/test/dir')).rejects.toThrow(ImageRenameError);
			await expect(renamer.renameDirectory('/test/dir')).rejects.toThrow('Directory processing failed');
		});
	});

	describe('database integration', () => {
		it('given database manager provided, when file renamed, then updates database path', async () => {
			const mockDatabaseManager = {
				updateFilePath: vi.fn().mockResolvedValue(undefined),
				close: vi.fn(),
			};

			const renamerWithDb = new ImageRenamer(mockLogger, mockLlmClient, mockDatabaseManager as any, testConfig);

			mockLlmClient.generateFilename.mockResolvedValue('new-filename');
			(utils.isSupportedImage as ReturnType<typeof vi.fn>).mockReturnValue(true);
			(utils.verifyImage as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
			(utils.sanitizeFilename as ReturnType<typeof vi.fn>).mockReturnValue('new-filename');
			(utils.getUniqueFilename as ReturnType<typeof vi.fn>).mockResolvedValue('/test/new-filename.jpg');
			(fsExtra.pathExists as ReturnType<typeof vi.fn>).mockResolvedValue(true);
			(fsExtra.copy as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
			(fs.promises.stat as ReturnType<typeof vi.fn>)
				.mockResolvedValueOnce({ size: 1000 } as any)
				.mockResolvedValueOnce({ size: 1000 } as any);
			(fs.promises.unlink as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

			await renamerWithDb.renameSingleImage('/test/old-filename.jpg', false);

			expect(mockDatabaseManager.updateFilePath).toHaveBeenCalledWith(
				'/test/old-filename.jpg',
				'/test/new-filename.jpg'
			);
		});
	});

	describe('llm getter', () => {
		it('should return the LLMClient instance', () => {
			const renamer = new ImageRenamer(mockLogger, mockLlmClient, undefined, testConfig);

			expect(renamer.llm).toBe(mockLlmClient);
		});
	});
});
