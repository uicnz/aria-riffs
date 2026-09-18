import * as fs from 'node:fs';
import * as fsExtra from 'fs-extra';
import type { Logger } from 'pino';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImageOcrRiffConfig } from '../../src/lib/schema.js';

/**
 * Create a mock Pino logger for tests
 */
function createMockLogger(): Logger {
	return {
		info: vi.fn(),
		debug: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		fatal: vi.fn(),
		trace: vi.fn(),
		silent: vi.fn(),
		level: 'info',
		child: vi.fn(),
	} as unknown as Logger;
}

/**
 * Create a mock config for testing (riff-specific config, not full config)
 */
function createMockConfig(overrides: Partial<ImageOcrRiffConfig> = {}): ImageOcrRiffConfig {
	return {
		paths: {
			input: { dir: '.aria/assets/image-ocr/images' },
			output: { dir: '.aria/exports/image-ocr/images' },
			database: { dir: '.aria/db/image-ocr/tessdata' },
			...overrides.paths,
		},
		ocr: {
			language: 'eng',
			confidenceThreshold: 0.5,
			timeout: 30,
			...overrides.ocr,
		},
		output: {
			format: 'markdown',
			includeMetadata: true,
			preserveLayout: false,
			...overrides.output,
		},
		files: {
			supportedExtensions: ['.png', '.jpg', '.jpeg', '.pdf'],
			maxFileSizeMb: 100,
			outputExtension: '.txt',
			...overrides.files,
		},
		processing: {
			batchSize: 5,
			progressBar: true,
			concurrentJobs: 2,
			...overrides.processing,
		},
	};
}

// Mock chalk to avoid issues with colors in tests - add default export
vi.mock('chalk', () => ({
	default: {
		red: vi.fn(str => str),
		green: vi.fn(str => str),
		yellow: vi.fn(str => str),
		blue: vi.fn(str => str),
		gray: vi.fn(str => str),
		bold: vi.fn(str => str),
	},
}));

// Mock scribe.js-ocr
vi.mock('scribe.js-ocr', () => ({
	__esModule: true,
	default: {
		extractText: vi.fn(),
		opt: {
			reflow: true,
		},
	},
}));

// Mock dependencies
vi.mock('fs', () => ({
	promises: {
		stat: vi.fn(),
		writeFile: vi.fn(),
	},
}));

vi.mock('fs-extra', () => ({
	pathExists: vi.fn(),
	ensureDir: vi.fn(),
}));

vi.mock('../../src/utils/utils', () => ({
	validateFile: vi.fn(),
	generateOutputPath: vi.fn(),
	findFiles: vi.fn(),
	sleep: vi.fn(),
}));

// Mock console methods
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;
beforeEach(() => {
	console.log = vi.fn();
	console.error = vi.fn();
	console.warn = vi.fn();
});
afterEach(() => {
	console.log = originalLog;
	console.error = originalError;
	console.warn = originalWarn;
});

// Import after mocking
// @ts-expect-error - scribe.js-ocr doesn't have types
import scribe from 'scribe.js-ocr';
import { ImageOcr } from '../../src/core/ocr.js';
import { findFiles, generateOutputPath, validateFile } from '../../src/utils/utils.js';

const mockedScribe = vi.mocked(scribe);
const mockedFs = vi.mocked(fs);
const mockedFsExtra = vi.mocked(fsExtra);
const mockedValidateFile = vi.mocked(validateFile);
const mockedGenerateOutputPath = vi.mocked(generateOutputPath);
const mockedFindFiles = vi.mocked(findFiles);

describe('ImageOcrProcessor', () => {
	let processor: ImageOcr;
	let mockLogger: Logger;
	let mockConfig: ImageOcrRiffConfig;

	beforeEach(() => {
		mockLogger = createMockLogger();
		mockConfig = createMockConfig();
		processor = new ImageOcr(mockLogger, mockConfig);
		vi.clearAllMocks();

		// Default mock implementations
		mockedValidateFile.mockResolvedValue(undefined);
		mockedGenerateOutputPath.mockReturnValue('/output/test.txt');
		(mockedFsExtra.pathExists as ReturnType<typeof vi.fn>).mockResolvedValue(false);
		(mockedFsExtra.ensureDir as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
		(mockedFs.promises.writeFile as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
	});

	describe('processSingleFile', () => {
		it('given valid file, when processSingleFile called, then returns success result', async () => {
			mockedScribe.extractText.mockResolvedValue('Extracted text from image');

			const result = await processor.processSingleFile('/input/test.png');

			expect(result.success).toBe(true);
			expect(result.inputPath).toBe('/input/test.png');
			expect(result.outputPath).toBe('/output/test.txt');
			expect(result.extractedText).toBe('Extracted text from image');
			expect(result.error).toBeUndefined();

			expect(mockedValidateFile).toHaveBeenCalledWith('/input/test.png', mockConfig);
			expect(mockedScribe.extractText).toHaveBeenCalledWith(['/input/test.png']);
			expect(mockedFs.promises.writeFile).toHaveBeenCalledWith(
				'/output/test.txt',
				'Extracted text from image',
				'utf8'
			);
		});

		it('given database directory configured, when OCR runs, then switches cwd to database dir and restores', async () => {
			mockedScribe.extractText.mockResolvedValue('Extracted text from image');
			const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue('/repo');
			const chdirSpy = vi.spyOn(process, 'chdir').mockImplementation(() => undefined);

			await processor.processSingleFile('/input/test.png');

			expect(chdirSpy).toHaveBeenCalledWith('/repo/.aria/db/image-ocr/tessdata');
			expect(chdirSpy).toHaveBeenCalledWith('/repo');
			cwdSpy.mockRestore();
			chdirSpy.mockRestore();
		});

		it('given output newer than input, when processSingleFile called, then skips processing', async () => {
			// Clear all previous mock calls
			vi.clearAllMocks();

			const inputStats = { mtime: new Date('2023-01-01'), size: 1024 };
			const outputStats = { mtime: new Date('2023-01-02') };

			// Set up mocks fresh for this test
			mockedValidateFile.mockResolvedValue(undefined);
			mockedGenerateOutputPath.mockReturnValue('/output/test.txt');
			(mockedFsExtra.pathExists as ReturnType<typeof vi.fn>).mockResolvedValue(true);

			// Just mock stat to return the right data for input vs output files
			(mockedFs.promises.stat as ReturnType<typeof vi.fn>).mockImplementation(async (path: any) => {
				if (path.includes('output')) {
					return outputStats as any;
				}
				return inputStats as any;
			});

			// Add OCR mock in case skipping doesn't work
			mockedScribe.extractText.mockResolvedValue([{ text: 'Should not be called', confidence: 0.9 }]);

			const result = await processor.processSingleFile('/input/test.png');

			// Debug: Check if result has expected structure
			expect(result).toHaveProperty('success');
			expect(result).toHaveProperty('inputPath', '/input/test.png');
			expect(result).toHaveProperty('outputPath');

			if (!result.success && result.error) {
				// Print the actual error to understand what's happening
				throw new Error(`Test failed: ${result.error}`);
			}

			expect(result.success).toBe(true);
			expect(mockedScribe.extractText).not.toHaveBeenCalled();
		});

		it('given output older than input, when processSingleFile called, then processes file', async () => {
			const inputStats = { mtime: new Date('2023-01-02') };
			const outputStats = { mtime: new Date('2023-01-01') };

			(mockedFsExtra.pathExists as ReturnType<typeof vi.fn>).mockResolvedValue(true);
			(mockedFs.promises.stat as ReturnType<typeof vi.fn>)
				.mockResolvedValueOnce(inputStats as any)
				.mockResolvedValueOnce(outputStats as any);

			mockedScribe.extractText.mockResolvedValue('Updated text');

			const result = await processor.processSingleFile('/input/test.png');

			expect(result.success).toBe(true);
			expect(mockedScribe.extractText).toHaveBeenCalled();
		});

		it('given OCR timeout, when processSingleFile called, then returns failure', async () => {
			// Mock OCR to never resolve
			mockedScribe.extractText.mockImplementation(() => new Promise(() => {}));

			// Create processor with very short timeout
			const shortTimeoutConfig = createMockConfig({
				ocr: { language: 'eng', confidenceThreshold: 0.5, timeout: 0.1 },
			});
			const shortTimeoutProcessor = new ImageOcr(mockLogger, shortTimeoutConfig);

			const result = await shortTimeoutProcessor.processSingleFile('/input/test.png');

			expect(result.success).toBe(false);
			expect(result.error).toContain('timeout');
		});

		it('given validation error, when processSingleFile called, then returns failure', async () => {
			mockedValidateFile.mockRejectedValue(new Error('File too large'));

			const result = await processor.processSingleFile('/input/test.png');

			expect(result.success).toBe(false);
			expect(result.error).toBe('File too large');
			expect(mockedScribe.extractText).not.toHaveBeenCalled();
		});

		it('given OCR processing error, when processSingleFile called, then returns failure', async () => {
			mockedScribe.extractText.mockRejectedValue(new Error('OCR failed'));

			const result = await processor.processSingleFile('/input/test.png');

			expect(result.success).toBe(false);
			expect(result.error).toContain('OCR processing failed');
		});

		it('given empty OCR result, when processSingleFile called, then returns success', async () => {
			mockedScribe.extractText.mockResolvedValue('');

			const result = await processor.processSingleFile('/input/test.png');

			expect(result.success).toBe(true);
			expect(result.extractedText).toBe('');
		});

		it('given invalid OCR result format, when processSingleFile called, then returns failure', async () => {
			mockedScribe.extractText.mockResolvedValue({ invalidField: 'value' });

			const result = await processor.processSingleFile('/input/test.png');

			expect(result.success).toBe(false);
			expect(result.error).toContain('Invalid OCR result format');
		});

		it('given text content, when processSingleFile called, then extracts text', async () => {
			mockedScribe.extractText.mockResolvedValue('Text content');

			const result = await processor.processSingleFile('/input/test.png');

			expect(result.success).toBe(true);
			expect(result.extractedText).toBe('Text content');
		});

		it('given string OCR result, when processSingleFile called, then returns string', async () => {
			mockedScribe.extractText.mockResolvedValue('Simple string result');

			const result = await processor.processSingleFile('/input/test.png');

			expect(result.success).toBe(true);
			expect(result.extractedText).toBe('Simple string result');
		});
	});

	describe('processDirectory', () => {
		it('given directory with files, when processDirectory called, then processes all files', async () => {
			const mockFiles = ['/dir/file1.png', '/dir/file2.jpg'];
			mockedFindFiles.mockResolvedValue(mockFiles);
			(mockedFsExtra.pathExists as ReturnType<typeof vi.fn>).mockResolvedValue(true);
			(mockedFs.promises.stat as ReturnType<typeof vi.fn>).mockResolvedValue({ isDirectory: () => true } as any);

			mockedScribe.extractText.mockResolvedValue('Sample text');

			const results = await processor.processDirectory('/test/dir', {
				recursive: false,
				showProgress: false,
			});

			expect(results.total_files).toBe(2);
			expect(results.processed).toBe(2);
			expect(results.failed).toBe(0);
			expect(results.skipped).toBe(0);
			expect(results.errors).toHaveLength(0);
		});

		it('given nonexistent directory, when processDirectory called, then throws error', async () => {
			(mockedFsExtra.pathExists as ReturnType<typeof vi.fn>).mockImplementation(async (pathToCheck: string) => {
				// Return false for any path containing 'nonexistent'
				return !pathToCheck.includes('nonexistent');
			});

			await expect(processor.processDirectory('/nonexistent')).rejects.toThrow('Directory not found');
		});

		it('given file path instead of directory, when processDirectory called, then throws error', async () => {
			(mockedFsExtra.pathExists as ReturnType<typeof vi.fn>).mockResolvedValue(true);
			(mockedFs.promises.stat as ReturnType<typeof vi.fn>).mockResolvedValue({ isDirectory: () => false } as any);

			await expect(processor.processDirectory('/file.txt')).rejects.toThrow('Path is not a directory');
		});

		it('given empty directory, when processDirectory called, then returns zero counts', async () => {
			mockedFindFiles.mockResolvedValue([]);
			(mockedFsExtra.pathExists as ReturnType<typeof vi.fn>).mockResolvedValue(true);
			(mockedFs.promises.stat as ReturnType<typeof vi.fn>).mockResolvedValue({ isDirectory: () => true } as any);

			const results = await processor.processDirectory('/empty/dir');

			expect(results.total_files).toBe(0);
			expect(results.processed).toBe(0);
			expect(mockLogger.warn).toHaveBeenCalledWith(
				expect.objectContaining({ directoryPath: expect.any(String) }),
				'No supported files found in directory'
			);
		});

		it('given mixed success and failure files, when processDirectory called, then reports both', async () => {
			const mockFiles = ['/dir/good.png', '/dir/bad.png'];
			mockedFindFiles.mockResolvedValue(mockFiles);
			(mockedFsExtra.pathExists as ReturnType<typeof vi.fn>).mockResolvedValue(true);
			(mockedFs.promises.stat as ReturnType<typeof vi.fn>).mockResolvedValue({ isDirectory: () => true } as any);

			// First file succeeds, second fails
			mockedScribe.extractText.mockResolvedValueOnce('Success').mockRejectedValueOnce(new Error('OCR failed'));

			const results = await processor.processDirectory('/test/dir', {
				showProgress: false,
			});

			expect(results.total_files).toBe(2);
			expect(results.processed).toBe(1);
			expect(results.failed).toBe(1);
			expect(results.errors).toHaveLength(1);
			expect(results.errors[0]).toContain('bad.png');
		});

		it('given concurrent jobs config, when processDirectory called, then processes in batches', async () => {
			const mockFiles = ['/dir/file1.png', '/dir/file2.png', '/dir/file3.png'];
			mockedFindFiles.mockResolvedValue(mockFiles);
			(mockedFsExtra.pathExists as ReturnType<typeof vi.fn>).mockResolvedValue(true);
			(mockedFs.promises.stat as ReturnType<typeof vi.fn>).mockResolvedValue({ isDirectory: () => true } as any);

			mockedScribe.extractText.mockResolvedValue('Sample text');

			const results = await processor.processDirectory('/test/dir', {
				showProgress: false,
			});

			expect(results.total_files).toBe(3);
			expect(results.processed).toBe(3);
			expect(mockedScribe.extractText).toHaveBeenCalledTimes(3);
		});
	});
});
