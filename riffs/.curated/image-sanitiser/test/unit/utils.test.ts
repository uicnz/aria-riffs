/// <reference types="vitest" />
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies BEFORE importing them
vi.mock('fs', () => ({
	promises: {
		access: vi.fn(),
		stat: vi.fn(),
		readdir: vi.fn(),
		unlink: vi.fn(),
	},
	constants: {
		R_OK: 4,
	},
}));

vi.mock('fs-extra', () => ({
	pathExists: vi.fn(),
	copy: vi.fn(),
}));

// Now import the mocked modules
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as fsExtra from 'fs-extra';
import { FileOperationError, UnsupportedImageFormat } from '../../src/lib/types.js';
import { createTestConfig } from './fakes.js';

const { mockLogger, mockCreateLogger } = vi.hoisted(() => {
	const mockLogger = {
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		debug: vi.fn(),
		fatal: vi.fn(),
		trace: vi.fn(),
		silent: vi.fn(),
		level: 'info',
		child: vi.fn(),
	};
	return {
		mockLogger,
		mockCreateLogger: vi.fn(() => mockLogger),
	};
});

vi.mock('../../src/lib/logger.js', () => ({
	createLogger: mockCreateLogger,
}));

const mockedFs = vi.mocked(fs);
const mockedFsExtra = vi.mocked(fsExtra);

// Import the module under test after mocking
import * as utils from '../../src/utils/utils.js';

describe('image-sanitiser Utils', () => {
	const testConfig = createTestConfig();

	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('isSupportedImageExtension', () => {
		it('should return true for supported extensions', () => {
			expect(utils.isSupportedImageExtension('test.jpg', testConfig)).toBe(true);
			expect(utils.isSupportedImageExtension('test.PNG', testConfig)).toBe(true);
			expect(utils.isSupportedImageExtension('path/to/image.webp', testConfig)).toBe(true);
		});

		it('should return false for unsupported extensions', () => {
			expect(utils.isSupportedImageExtension('test.txt', testConfig)).toBe(false);
			expect(utils.isSupportedImageExtension('test.pdf', testConfig)).toBe(false);
			expect(utils.isSupportedImageExtension('test', testConfig)).toBe(false);
		});

		it('should respect custom supported extensions in config', () => {
			const customConfig = createTestConfig({
				'image-sanitiser': {
					images: {
						supportedExtensions: ['.jpg', '.png'],
						maxFileSizeMb: 100,
						verifyAfterRename: true,
					},
				},
			});

			expect(utils.isSupportedImageExtension('test.jpg', customConfig)).toBe(true);
			expect(utils.isSupportedImageExtension('test.png', customConfig)).toBe(true);
			expect(utils.isSupportedImageExtension('test.webp', customConfig)).toBe(false);
		});
	});

	describe('validateImageFile', () => {
		const mockStats = { size: 1024 * 1024 }; // 1MB

		beforeEach(() => {
			// @ts-expect-error
			mockedFs.promises.access.mockResolvedValue(undefined);
			// @ts-expect-error
			mockedFs.promises.stat.mockResolvedValue(mockStats as any);
		});

		it('should pass validation for valid image files', async () => {
			await expect(utils.validateImageFile('test.jpg', testConfig)).resolves.not.toThrow();

			expect(mockedFs.promises.access).toHaveBeenCalledWith('test.jpg', fs.constants.R_OK);
			expect(mockedFs.promises.stat).toHaveBeenCalledWith('test.jpg');
		});

		it('should throw FileOperationError for access denied', async () => {
			const error = new Error('Permission denied') as NodeJS.ErrnoException;
			error.code = 'EACCES';
			// @ts-expect-error
			mockedFs.promises.access.mockRejectedValue(error);

			await expect(utils.validateImageFile('test.jpg', testConfig)).rejects.toThrow(FileOperationError);
			await expect(utils.validateImageFile('test.jpg', testConfig)).rejects.toThrow(
				'Permission denied accessing file: test.jpg'
			);
		});

		it('should throw FileOperationError for file not found', async () => {
			const error = new Error('File not found') as NodeJS.ErrnoException;
			error.code = 'ENOENT';
			// @ts-expect-error
			mockedFs.promises.access.mockRejectedValue(error);

			await expect(utils.validateImageFile('test.jpg', testConfig)).rejects.toThrow(FileOperationError);
			await expect(utils.validateImageFile('test.jpg', testConfig)).rejects.toThrow('File not found: test.jpg');
		});

		it('should throw UnsupportedImageFormat for files too large', async () => {
			const largeMockStats = { size: 200 * 1024 * 1024 }; // 200MB
			// @ts-expect-error
			mockedFs.promises.stat.mockResolvedValue(largeMockStats as any);

			await expect(utils.validateImageFile('test.jpg', testConfig)).rejects.toThrow(UnsupportedImageFormat);
			await expect(utils.validateImageFile('test.jpg', testConfig)).rejects.toThrow(
				'Image file too large: 200MB > 100MB'
			);
		});

		it('should throw UnsupportedImageFormat for empty files', async () => {
			const emptyMockStats = { size: 0 };
			// @ts-expect-error
			mockedFs.promises.stat.mockResolvedValue(emptyMockStats as any);

			await expect(utils.validateImageFile('test.jpg', testConfig)).rejects.toThrow(UnsupportedImageFormat);
			await expect(utils.validateImageFile('test.jpg', testConfig)).rejects.toThrow('Empty file: test.jpg');
		});
	});

	describe('sanitizeFilename', () => {
		it('should remove invalid characters', () => {
			expect(utils.sanitizeFilename('file<>:|*?')).toBe('file______');
			expect(utils.sanitizeFilename('path/to\\file')).toBe('path_to_file');
		});

		it('should replace multiple spaces with single space', () => {
			expect(utils.sanitizeFilename('file    with     spaces')).toBe('file with spaces');
		});

		it('should trim whitespace', () => {
			expect(utils.sanitizeFilename('  filename  ')).toBe('filename');
		});

		it('should handle empty filenames', () => {
			expect(utils.sanitizeFilename('')).toBe('sanitized-image');
			expect(utils.sanitizeFilename('   ')).toBe('sanitized-image');
		});

		it('should truncate long filenames', () => {
			const longName = 'a'.repeat(300);
			const result = utils.sanitizeFilename(longName);
			expect(result.length).toBe(200);
		});

		it('should handle special characters and unicode', () => {
			expect(utils.sanitizeFilename('file.jpg')).toBe('file.jpg');
			expect(utils.sanitizeFilename('file\x00\x1F')).toBe('file__');
		});
	});

	describe('getUniqueFilename', () => {
		beforeEach(() => {
			// @ts-expect-error
			mockedFsExtra.pathExists.mockResolvedValue(false);
		});

		it('should return new filename if it does not exist', async () => {
			const result = await utils.getUniqueFilename('/path/old.png', 'newfile', '.jpg');
			expect(result).toBe(path.join('/path', 'newfile.jpg'));
		});

		it('should return original path if new path is the same', async () => {
			const originalPath = '/path/file.jpg';
			const result = await utils.getUniqueFilename(originalPath, 'file', '.jpg');
			expect(result).toBe(originalPath);
		});

		it('should increment filename when path exists', async () => {
			mockedFsExtra.pathExists
				// @ts-expect-error - mock type mismatch
				.mockResolvedValueOnce(true) // First attempt exists
				// @ts-expect-error - mock type mismatch
				.mockResolvedValueOnce(false); // Second attempt does not exist

			const result = await utils.getUniqueFilename('/path/old.png', 'newfile', '.jpg');
			expect(result).toBe(path.join('/path', 'newfile-1.jpg'));
		});

		it('should throw error after too many collisions', async () => {
			// @ts-expect-error
			mockedFsExtra.pathExists.mockResolvedValue(true); // Always exists

			await expect(utils.getUniqueFilename('/path/old.png', 'newfile', '.jpg')).rejects.toThrow(
				FileOperationError
			);
		});
	});

	describe('getExtensionFromMimeType', () => {
		it('should return correct extension for known MIME types', () => {
			expect(utils.getExtensionFromMimeType('image/jpeg')).toBe('.jpg');
			expect(utils.getExtensionFromMimeType('image/png')).toBe('.png');
			expect(utils.getExtensionFromMimeType('image/gif')).toBe('.gif');
			expect(utils.getExtensionFromMimeType('image/webp')).toBe('.webp');
		});

		it('should handle case variations', () => {
			expect(utils.getExtensionFromMimeType('IMAGE/JPEG')).toBe('.jpg');
			expect(utils.getExtensionFromMimeType('Image/PNG')).toBe('.png');
		});

		it('should return empty string for unknown MIME types', () => {
			expect(utils.getExtensionFromMimeType('application/pdf')).toBe('');
			expect(utils.getExtensionFromMimeType('unknown/type')).toBe('');
		});
	});

	describe('normalizeExtension', () => {
		it('should normalize common extension variations', () => {
			expect(utils.normalizeExtension('.jpeg')).toBe('.jpg');
			expect(utils.normalizeExtension('.JPEG')).toBe('.jpg');
			expect(utils.normalizeExtension('.tif')).toBe('.tiff');
			expect(utils.normalizeExtension('.TIF')).toBe('.tiff');
		});

		it('should return unchanged extension for standard formats', () => {
			expect(utils.normalizeExtension('.png')).toBe('.png');
			expect(utils.normalizeExtension('.gif')).toBe('.gif');
			expect(utils.normalizeExtension('.webp')).toBe('.webp');
		});

		it('should handle case conversion', () => {
			expect(utils.normalizeExtension('.PNG')).toBe('.png');
			expect(utils.normalizeExtension('.GIF')).toBe('.gif');
		});
	});

	describe('findImageFiles', () => {
		it('should find image files with supported extensions', async () => {
			const mockEntries = [
				{ name: 'image1.jpg', isFile: () => true, isDirectory: () => false },
				{ name: 'image2.png', isFile: () => true, isDirectory: () => false },
				{ name: 'document.txt', isFile: () => true, isDirectory: () => false },
				{ name: 'subdir', isFile: () => false, isDirectory: () => true },
			];

			// @ts-expect-error
			mockedFs.promises.readdir.mockResolvedValue(mockEntries as any);

			const result = await utils.findImageFiles('/test/dir', testConfig, false);

			expect(result).toEqual([path.join('/test/dir', 'image1.jpg'), path.join('/test/dir', 'image2.png')].sort());
		});

		it('should find files without extensions (potential images)', async () => {
			const mockEntries = [
				{ name: 'image_no_ext', isFile: () => true, isDirectory: () => false },
				{ name: 'another.txt', isFile: () => true, isDirectory: () => false },
			];

			// @ts-expect-error
			mockedFs.promises.readdir.mockResolvedValue(mockEntries as any);

			const result = await utils.findImageFiles('/test/dir', testConfig, false);

			expect(result).toEqual([path.join('/test/dir', 'image_no_ext')]);
		});

		it('should handle directory read errors gracefully', async () => {
			// @ts-expect-error - mock type mismatch
			mockedFs.promises.readdir.mockRejectedValue(new Error('Permission denied'));

			const result = await utils.findImageFiles('/test/dir', testConfig);

			expect(result).toEqual([]);
			expect(mockLogger.warn).toHaveBeenCalledWith(
				expect.objectContaining({
					dirPath: '/test/dir',
					error: expect.any(Error),
				}),
				'Could not read directory while scanning images'
			);
		});
	});

	describe('safeFileMove', () => {
		beforeEach(() => {
			// @ts-expect-error - mock type mismatch
			mockedFsExtra.pathExists.mockResolvedValue(false);
			mockedFsExtra.copy.mockResolvedValue(undefined);
			// @ts-expect-error - mock type mismatch
			mockedFs.promises.stat.mockResolvedValue({ size: 1024 });
			// @ts-expect-error - mock type mismatch
			mockedFs.promises.unlink.mockResolvedValue(undefined);
		});

		it('should move file successfully', async () => {
			await utils.safeFileMove('/source/file.jpg', '/dest/file.jpg', testConfig);

			expect(mockedFsExtra.copy).toHaveBeenCalledWith('/source/file.jpg', '/dest/file.jpg');
			expect(mockedFs.promises.unlink).toHaveBeenCalledWith('/source/file.jpg');
		});

		it('should throw error after exhausting retries', async () => {
			mockedFsExtra.copy.mockRejectedValue(new Error('Copy failed'));

			await expect(utils.safeFileMove('/source/file.jpg', '/dest/file.jpg', testConfig)).rejects.toThrow(
				FileOperationError
			);
		});
	});
});
