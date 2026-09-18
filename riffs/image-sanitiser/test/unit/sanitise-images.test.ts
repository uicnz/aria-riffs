import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies BEFORE importing them
vi.mock('fs-extra', () => ({
	pathExists: vi.fn(),
}));

// Mock cli-progress with hoisted pattern to survive vi.clearAllMocks()
const { MockedSingleBar, setProgressBarInstance } = vi.hoisted(() => {
	let progressBarInstance: unknown = null;
	const MockedConstructor = vi.fn(function (this: unknown) {
		return progressBarInstance;
	});
	return {
		MockedSingleBar: MockedConstructor,
		setProgressBarInstance: (instance: unknown) => {
			progressBarInstance = instance;
		},
	};
});

vi.mock('cli-progress', () => ({
	default: {
		SingleBar: MockedSingleBar,
	},
}));

vi.mock('chalk', () => ({
	default: {
		red: vi.fn((str: string) => str),
		green: vi.fn((str: string) => str),
		yellow: vi.fn((str: string) => str),
		cyan: vi.fn((str: string) => str),
		gray: vi.fn((str: string) => str),
	},
}));

// Mock ImageFormatDetector with hoisted pattern to survive vi.clearAllMocks()
const { MockedImageFormatDetector, setDetectorInstance } = vi.hoisted(() => {
	let detectorInstance: unknown = null;
	const MockedConstructor = vi.fn(function (this: unknown) {
		return detectorInstance;
	});
	return {
		MockedImageFormatDetector: MockedConstructor,
		setDetectorInstance: (instance: unknown) => {
			detectorInstance = instance;
		},
	};
});

const { MockedConsoleLogger } = vi.hoisted(() => {
	const mockConsoleLog = vi.fn();
	const mockConsoleWarn = vi.fn();
	const mockConsoleError = vi.fn();
	const mockSetProgressBar = vi.fn();
	const mockSetProgress = vi.fn();
	const MockedConstructor = vi.fn(function (this: unknown) {
		return {
			log: mockConsoleLog,
			warn: mockConsoleWarn,
			error: mockConsoleError,
			setProgressBar: mockSetProgressBar,
			setProgress: mockSetProgress,
		};
	});
	return {
		MockedConsoleLogger: MockedConstructor,
	};
});

vi.mock('../../src/core/detect-format', () => ({
	ImageFormatDetector: MockedImageFormatDetector,
}));

vi.mock('../../src/utils/console-logger.js', () => ({
	ConsoleLogger: MockedConsoleLogger,
}));

vi.mock('../../src/utils/utils', () => ({
	findImageFiles: vi.fn(),
	validateImageFile: vi.fn(),
	sanitizeFilename: vi.fn(),
	getUniqueFilename: vi.fn(),
	safeFileMove: vi.fn(),
}));

import * as fsExtra from 'fs-extra';
import { ImageSanitiser } from '../../src/core/sanitise-images.js';
import { ImageSanitiserError } from '../../src/lib/types.js';
import {
	findImageFiles,
	getUniqueFilename,
	safeFileMove,
	sanitizeFilename,
	validateImageFile,
} from '../../src/utils/utils.js';
import { createMockLogger, createTestConfig } from './fakes.js';

const mockedFsExtra = vi.mocked(fsExtra);
const mockedFindImageFiles = vi.mocked(findImageFiles);
const mockedValidateImageFile = vi.mocked(validateImageFile);
const mockedSanitizeFilename = vi.mocked(sanitizeFilename);
const mockedGetUniqueFilename = vi.mocked(getUniqueFilename);
const mockedSafeFileMove = vi.mocked(safeFileMove);

describe('ImageSanitiser', () => {
	let sanitiser: ImageSanitiser;
	let mockLogger: ReturnType<typeof createMockLogger>;
	let mockDetector: {
		detectImageFormat: ReturnType<typeof vi.fn>;
		cleanup: ReturnType<typeof vi.fn>;
	};
	let mockProgressBar: {
		start: ReturnType<typeof vi.fn>;
		update: ReturnType<typeof vi.fn>;
		stop: ReturnType<typeof vi.fn>;
	};
	const testConfig = createTestConfig();

	beforeEach(() => {
		vi.clearAllMocks();

		mockLogger = createMockLogger();

		mockDetector = {
			detectImageFormat: vi.fn(),
			cleanup: vi.fn(),
		};

		mockProgressBar = {
			start: vi.fn(),
			update: vi.fn(),
			stop: vi.fn(),
		};

		setDetectorInstance(mockDetector);
		setProgressBarInstance(mockProgressBar);

		mockedSanitizeFilename.mockImplementation(name => `sanitized_${name}`);

		sanitiser = new ImageSanitiser(mockLogger, testConfig);
	});

	afterEach(async () => {
		if (sanitiser) {
			await sanitiser.cleanup();
		}
	});

	describe('analyzeSingleFile', () => {
		it('should analyze a valid image file', async () => {
			const mockDetectionResult = {
				detectedExtension: '.jpg',
				detectedMimeType: 'image/jpeg',
				confidence: 'high' as const,
				method: 'magic-bytes' as const,
				originalExtension: '.png',
				needsRename: true,
			};

			mockedValidateImageFile.mockResolvedValue(undefined);
			mockDetector.detectImageFormat.mockResolvedValue(mockDetectionResult);
			mockedGetUniqueFilename.mockResolvedValue('/test/sanitized_image.jpg');

			const result = await sanitiser.analyzeSingleFile('/test/image.png');

			expect(result.filePath).toBe('/test/image.png');
			expect(result.detectionResult).toEqual(mockDetectionResult);
			expect(result.proposedNewPath).toBe('/test/sanitized_image.jpg');
			expect(result.error).toBeUndefined();
		});

		it('should handle files that do not need renaming', async () => {
			const mockDetectionResult = {
				detectedExtension: '.jpg',
				detectedMimeType: 'image/jpeg',
				confidence: 'high' as const,
				method: 'magic-bytes' as const,
				originalExtension: '.jpg',
				needsRename: false,
			};

			mockedValidateImageFile.mockResolvedValue(undefined);
			mockDetector.detectImageFormat.mockResolvedValue(mockDetectionResult);

			const result = await sanitiser.analyzeSingleFile('/test/image.jpg');

			expect(result.detectionResult.needsRename).toBe(false);
			expect(result.proposedNewPath).toBeUndefined();
		});

		it('should handle validation errors', async () => {
			mockedValidateImageFile.mockRejectedValue(new Error('Invalid image'));

			const result = await sanitiser.analyzeSingleFile('/test/invalid.jpg');

			expect(result.error).toBe('Invalid image');
			expect(result.detectionResult.confidence).toBe('low');
		});
	});

	describe('sanitizeSingleFile', () => {
		it('should skip files that do not need renaming', async () => {
			const mockDetectionResult = {
				detectedExtension: '.jpg',
				detectedMimeType: 'image/jpeg',
				confidence: 'high' as const,
				method: 'magic-bytes' as const,
				originalExtension: '.jpg',
				needsRename: false,
			};

			mockedValidateImageFile.mockResolvedValue(undefined);
			mockDetector.detectImageFormat.mockResolvedValue(mockDetectionResult);

			const result = await sanitiser.sanitizeSingleFile('/test/image.jpg');

			expect(result).toBe(true);
			expect(mockedSafeFileMove).not.toHaveBeenCalled();
		});

		it('should perform dry run without actually moving files', async () => {
			const mockDetectionResult = {
				detectedExtension: '.jpg',
				detectedMimeType: 'image/jpeg',
				confidence: 'high' as const,
				method: 'magic-bytes' as const,
				originalExtension: '.png',
				needsRename: true,
			};

			mockedValidateImageFile.mockResolvedValue(undefined);
			mockDetector.detectImageFormat.mockResolvedValue(mockDetectionResult);
			mockedGetUniqueFilename.mockResolvedValue('/test/sanitized_image.jpg');

			const result = await sanitiser.sanitizeSingleFile('/test/image.png', true);

			expect(result).toBe(true);
			expect(mockedSafeFileMove).not.toHaveBeenCalled();
		});

		it('should actually move files when not in dry run mode', async () => {
			const mockDetectionResult = {
				detectedExtension: '.jpg',
				detectedMimeType: 'image/jpeg',
				confidence: 'high' as const,
				method: 'magic-bytes' as const,
				originalExtension: '.png',
				needsRename: true,
			};

			// Use config with verifyAfterRename = false
			const noVerifyConfig = createTestConfig({
				'image-sanitiser': {
					images: {
						supportedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.tif', '.webp'],
						maxFileSizeMb: 100,
						verifyAfterRename: false,
					},
				},
			});
			const sanitiserNoVerify = new ImageSanitiser(mockLogger, noVerifyConfig);

			mockedValidateImageFile.mockResolvedValue(undefined);
			mockDetector.detectImageFormat.mockResolvedValue(mockDetectionResult);
			mockedGetUniqueFilename.mockResolvedValue('/test/sanitized_image.jpg');
			mockedSafeFileMove.mockResolvedValue(undefined);

			const result = await sanitiserNoVerify.sanitizeSingleFile('/test/image.png', false);

			expect(result).toBe(true);
			expect(mockedSafeFileMove).toHaveBeenCalledWith(
				'/test/image.png',
				'/test/sanitized_image.jpg',
				noVerifyConfig
			);
		});

		it('should verify renamed file when configured', async () => {
			const mockDetectionResult = {
				detectedExtension: '.jpg',
				detectedMimeType: 'image/jpeg',
				confidence: 'high' as const,
				method: 'magic-bytes' as const,
				originalExtension: '.png',
				needsRename: true,
			};

			mockedValidateImageFile.mockResolvedValue(undefined);
			mockDetector.detectImageFormat.mockResolvedValue(mockDetectionResult);
			mockedGetUniqueFilename.mockResolvedValue('/test/sanitized_image.jpg');
			mockedSafeFileMove.mockResolvedValue(undefined);

			// Mock verification result
			mockDetector.detectImageFormat.mockResolvedValueOnce(mockDetectionResult);
			mockDetector.detectImageFormat.mockResolvedValueOnce({
				...mockDetectionResult,
				detectedExtension: '.jpg', // Same as expected
			});

			const result = await sanitiser.sanitizeSingleFile('/test/image.png', false);

			expect(result).toBe(true);
			expect(mockDetector.detectImageFormat).toHaveBeenCalledTimes(2);
		});

		it('should handle file move errors', async () => {
			const mockDetectionResult = {
				detectedExtension: '.jpg',
				detectedMimeType: 'image/jpeg',
				confidence: 'high' as const,
				method: 'magic-bytes' as const,
				originalExtension: '.png',
				needsRename: true,
			};

			mockedValidateImageFile.mockResolvedValue(undefined);
			mockDetector.detectImageFormat.mockResolvedValue(mockDetectionResult);
			mockedGetUniqueFilename.mockResolvedValue('/test/sanitized_image.jpg');
			mockedSafeFileMove.mockRejectedValue(new Error('Move failed'));

			const result = await sanitiser.sanitizeSingleFile('/test/image.png', false);

			expect(result).toBe(false);
		});
	});

	describe('sanitizeDirectory', () => {
		it('should process directory with image files', async () => {
			(mockedFsExtra.pathExists as ReturnType<typeof vi.fn>).mockResolvedValue(true);
			mockedFindImageFiles.mockResolvedValue(['/test/image1.png', '/test/image2.jpg']);

			// Mock analyzeSingleFile
			vi.spyOn(sanitiser, 'sanitizeSingleFile').mockImplementation(async filePath => {
				return filePath.includes('image1'); // Only image1 succeeds
			});

			const results = await sanitiser.sanitizeDirectory('/test', {
				recursive: false,
				dryRun: true,
				showProgress: true,
			});

			expect(results.total_files).toBe(2);
			expect(results.processed).toBe(1);
			expect(results.skipped).toBe(1);
			expect(mockProgressBar.start).toHaveBeenCalledWith(2, 0);
			expect(mockProgressBar.stop).toHaveBeenCalled();
		});

		it('should handle non-existent directory', async () => {
			(mockedFsExtra.pathExists as ReturnType<typeof vi.fn>).mockResolvedValue(false);

			await expect(sanitiser.sanitizeDirectory('/nonexistent')).rejects.toThrow(ImageSanitiserError);
		});

		it('should handle empty directory', async () => {
			(mockedFsExtra.pathExists as ReturnType<typeof vi.fn>).mockResolvedValue(true);
			mockedFindImageFiles.mockResolvedValue([]);

			const results = await sanitiser.sanitizeDirectory('/test');

			expect(results.total_files).toBe(0);
		});

		it('should disable progress bar when configured', async () => {
			const noProgressConfig = createTestConfig({
				'image-sanitiser': {
					processing: {
						progressBar: false,
						batchSize: 50,
						concurrentOperations: false,
					},
				},
			});
			const sanitiserNoProgress = new ImageSanitiser(mockLogger, noProgressConfig);

			(mockedFsExtra.pathExists as ReturnType<typeof vi.fn>).mockResolvedValue(true);
			mockedFindImageFiles.mockResolvedValue(['/test/image1.png']);

			vi.spyOn(sanitiserNoProgress, 'sanitizeSingleFile').mockResolvedValue(true);

			await sanitiserNoProgress.sanitizeDirectory('/test', { showProgress: false });

			expect(mockProgressBar.start).not.toHaveBeenCalled();
		});
	});

	describe('cleanup', () => {
		it('should clean up detector', async () => {
			await sanitiser.cleanup();

			expect(mockDetector.cleanup).toHaveBeenCalled();
		});
	});

	describe('database integration', () => {
		it('given database manager provided, when file renamed, then updates database path', async () => {
			const mockDatabaseManager = {
				saveDescription: vi.fn().mockResolvedValue(undefined),
				updateFilePath: vi.fn().mockResolvedValue(undefined),
				close: vi.fn(),
			};

			// Use config with verifyAfterRename = false
			const noVerifyConfig = createTestConfig({
				'image-sanitiser': {
					images: {
						supportedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.tif', '.webp'],
						maxFileSizeMb: 100,
						verifyAfterRename: false,
					},
				},
			});

			const sanitiserWithDb = new ImageSanitiser(
				mockLogger,
				noVerifyConfig,
				mockDetector as unknown as ConstructorParameters<typeof ImageSanitiser>[2],
				mockDatabaseManager as {
					saveDescription: (filePath: string, description: string) => Promise<void>;
					updateFilePath: (oldPath: string, newPath: string) => Promise<void>;
					close: () => void;
				}
			);

			const mockDetectionResult = {
				detectedExtension: '.jpg',
				detectedMimeType: 'image/jpeg',
				confidence: 'high' as const,
				method: 'magic-bytes' as const,
				originalExtension: '.png',
				needsRename: true,
			};

			mockedValidateImageFile.mockResolvedValue(undefined);
			mockDetector.detectImageFormat.mockResolvedValue(mockDetectionResult);
			mockedGetUniqueFilename.mockResolvedValue('/test/sanitized_image.jpg');
			mockedSafeFileMove.mockResolvedValue(undefined);

			await sanitiserWithDb.sanitizeSingleFile('/test/image.png', false);

			expect(mockDatabaseManager.updateFilePath).toHaveBeenCalledWith(
				'/test/image.png',
				'/test/sanitized_image.jpg'
			);
		});
	});
});
