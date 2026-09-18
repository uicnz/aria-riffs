import * as fs from 'node:fs';
import * as fsExtra from 'fs-extra';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImageOcrRiffConfig } from '../../src/lib/schema.js';

// Mock dependencies
vi.mock('fs', () => ({
	promises: {
		stat: vi.fn(),
		readdir: vi.fn(),
	},
}));

vi.mock('fs-extra', () => ({
	pathExists: vi.fn(),
}));

// Import after mocking
import { findFiles, generateOutputPath, isSupportedFile, validateFile } from '../../src/utils/utils.js';

const mockedFs = vi.mocked(fs);
const mockedFsExtra = vi.mocked(fsExtra);

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

describe('ImageOCR Utils', () => {
	let mockConfig: ImageOcrRiffConfig;

	beforeEach(() => {
		vi.clearAllMocks();
		mockConfig = createMockConfig();
	});

	describe('isSupportedFile', () => {
		it('should return true for supported extensions', () => {
			expect(isSupportedFile('test.png', mockConfig)).toBe(true);
			expect(isSupportedFile('test.jpg', mockConfig)).toBe(true);
			expect(isSupportedFile('test.jpeg', mockConfig)).toBe(true);
			expect(isSupportedFile('test.pdf', mockConfig)).toBe(true);
			expect(isSupportedFile('TEST.PNG', mockConfig)).toBe(true); // case insensitive
		});

		it('should return false for unsupported extensions', () => {
			expect(isSupportedFile('test.txt', mockConfig)).toBe(false);
			expect(isSupportedFile('test.doc', mockConfig)).toBe(false);
			expect(isSupportedFile('test.mp4', mockConfig)).toBe(false);
			expect(isSupportedFile('test', mockConfig)).toBe(false);
		});

		it('should handle files with multiple dots', () => {
			expect(isSupportedFile('my.test.file.png', mockConfig)).toBe(true);
			expect(isSupportedFile('my.test.file.txt', mockConfig)).toBe(false);
		});
	});

	describe('validateFile', () => {
		it('should pass validation for supported file that exists and is within size limit', async () => {
			// @ts-expect-error - Mock typing issues
			mockedFsExtra.pathExists.mockResolvedValue(true);
			(mockedFs.promises.stat as ReturnType<typeof vi.fn>).mockResolvedValue({
				size: 1024 * 1024, // 1MB
			} as any);

			await expect(validateFile('test.png', mockConfig)).resolves.not.toThrow();
		});

		it('should throw UnsupportedFileFormat for unsupported extensions', async () => {
			await expect(validateFile('test.txt', mockConfig)).rejects.toThrow('Unsupported file format');
		});

		it('should throw FileOperationError for non-existent files', async () => {
			// @ts-expect-error - Mock typing issues
			mockedFsExtra.pathExists.mockResolvedValue(false);

			await expect(validateFile('test.png', mockConfig)).rejects.toThrow('File does not exist');
		});

		it('should throw FileOperationError for files exceeding size limit', async () => {
			// @ts-expect-error - Mock typing issues
			mockedFsExtra.pathExists.mockResolvedValue(true);
			(mockedFs.promises.stat as ReturnType<typeof vi.fn>).mockResolvedValue({
				size: 200 * 1024 * 1024, // 200MB
			} as any);

			await expect(validateFile('test.png', mockConfig)).rejects.toThrow('exceeds maximum allowed size');
		});
	});

	describe('findFiles', () => {
		it('should find supported files in directory', async () => {
			(mockedFs.promises.readdir as ReturnType<typeof vi.fn>).mockResolvedValue([
				{ name: 'image1.png', isFile: () => true, isDirectory: () => false },
				{ name: 'image2.jpg', isFile: () => true, isDirectory: () => false },
				{ name: 'document.txt', isFile: () => true, isDirectory: () => false },
				{ name: 'subfolder', isFile: () => false, isDirectory: () => true },
			] as any);

			const files = await findFiles('/test/path', mockConfig, false);

			expect(files).toHaveLength(2);
			expect(files).toContain('/test/path/image1.png');
			expect(files).toContain('/test/path/image2.jpg');
			expect(files).not.toContain('/test/path/document.txt');
		});

		it('should recursively scan subdirectories when recursive is true', async () => {
			(mockedFs.promises.readdir as ReturnType<typeof vi.fn>)
				.mockResolvedValueOnce([
					{ name: 'image1.png', isFile: () => true, isDirectory: () => false },
					{ name: 'subfolder', isFile: () => false, isDirectory: () => true },
				] as any)
				.mockResolvedValueOnce([{ name: 'image2.jpg', isFile: () => true, isDirectory: () => false }] as any);

			const files = await findFiles('/test/path', mockConfig, true);

			expect(files).toHaveLength(2);
			expect(files).toContain('/test/path/image1.png');
			expect(files).toContain('/test/path/subfolder/image2.jpg');
		});

		it('should return empty array for directory with no supported files', async () => {
			(mockedFs.promises.readdir as ReturnType<typeof vi.fn>).mockResolvedValue([
				{ name: 'document.txt', isFile: () => true, isDirectory: () => false },
				{ name: 'video.mp4', isFile: () => true, isDirectory: () => false },
			] as any);

			const files = await findFiles('/test/path', mockConfig, false);
			expect(files).toHaveLength(0);
		});

		it('should return sorted file list', async () => {
			(mockedFs.promises.readdir as ReturnType<typeof vi.fn>).mockResolvedValue([
				{ name: 'z.png', isFile: () => true, isDirectory: () => false },
				{ name: 'a.jpg', isFile: () => true, isDirectory: () => false },
				{ name: 'm.pdf', isFile: () => true, isDirectory: () => false },
			] as any);

			const files = await findFiles('/test/path', mockConfig, false);

			expect(files).toEqual(['/test/path/a.jpg', '/test/path/m.pdf', '/test/path/z.png']);
		});
	});

	describe('generateOutputPath', () => {
		it('should generate output path with configured extension', () => {
			const output = generateOutputPath('/path/to/image.png', mockConfig);
			expect(output).toBe('/path/to/image.txt');
		});

		it('should handle files without extensions', () => {
			const output = generateOutputPath('/path/to/image', mockConfig);
			expect(output).toBe('/path/to/image.txt');
		});

		it('should use custom output extension from config', () => {
			const customConfig = createMockConfig({
				files: {
					supportedExtensions: ['.png'],
					maxFileSizeMb: 100,
					outputExtension: '.md',
				},
			});

			const output = generateOutputPath('/path/to/image.png', customConfig);
			expect(output).toBe('/path/to/image.md');
		});
	});
});
