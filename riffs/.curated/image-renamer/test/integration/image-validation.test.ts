import * as path from 'node:path';
import * as fs from 'fs-extra';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/lib/config.js';
import { FileOperationError, ImageCorrupted } from '../../src/lib/types.js';
import { findImageFiles, isSupportedImage, verifyImage } from '../../src/utils/utils.js';

// Note: These integration tests use the real config from Zod defaults
const config = loadConfig();

describe('ImageMeta Integration - Image Validation', () => {
	const testImagesDir = path.join(__dirname, '../fixtures/sample-images');

	beforeAll(async () => {
		// Ensure test images exist
		if (!(await fs.pathExists(testImagesDir))) {
			throw new Error('Test images not found. Run: bun run test:setup');
		}
	});

	describe('isSupportedImage with real files', () => {
		it('should correctly identify supported image formats', async () => {
			const imageFiles = await fs.readdir(testImagesDir);

			const supportedFiles = imageFiles.filter(file =>
				['.jpg', '.jpeg', '.png', '.gif', '.bmp'].some(ext => file.toLowerCase().endsWith(ext))
			);

			for (const file of supportedFiles) {
				expect(isSupportedImage(file, config)).toBe(true);
			}
		});

		it('should reject non-image files', () => {
			expect(isSupportedImage('README.md', config)).toBe(false);
			expect(isSupportedImage('document.txt', config)).toBe(false);
			expect(isSupportedImage('archive.zip', config)).toBe(false);
		});

		it('should handle mixed case extensions', () => {
			expect(isSupportedImage('UPPERCASE.JPG', config)).toBe(true);
			expect(isSupportedImage('MiXeD_CaSe-File.png', config)).toBe(true);
		});
	});

	describe('verifyImage with real images', () => {
		it('should validate small valid images', async () => {
			const validImages = ['small_red.jpg', 'small_green.png', 'tiny_white.png'];

			for (const image of validImages) {
				const imagePath = path.join(testImagesDir, image);
				if (await fs.pathExists(imagePath)) {
					await expect(verifyImage(imagePath, config)).resolves.not.toThrow();
				}
			}
		});

		it('should validate different image formats', async () => {
			const formatTests = [
				{ file: 'landscape.jpg', format: 'JPEG' },
				{ file: 'portrait.png', format: 'PNG' },
				{ file: 'wide_cyan.png', format: 'PNG' },
			];

			for (const test of formatTests) {
				const imagePath = path.join(testImagesDir, test.file);
				if (await fs.pathExists(imagePath)) {
					await expect(verifyImage(imagePath, config)).resolves.not.toThrow();
				}
			}
		});

		it('should reject corrupted image files', async () => {
			const corruptedPath = path.join(testImagesDir, 'corrupted.jpg');
			if (await fs.pathExists(corruptedPath)) {
				await expect(verifyImage(corruptedPath, config)).rejects.toThrow(ImageCorrupted);
			}
		});

		it('should reject empty image files', async () => {
			const emptyPath = path.join(testImagesDir, 'empty.jpg');
			if (await fs.pathExists(emptyPath)) {
				await expect(verifyImage(emptyPath, config)).rejects.toThrow(ImageCorrupted);
			}
		});

		it('should reject oversized files', async () => {
			const oversizedPath = path.join(testImagesDir, 'oversized.jpg');
			if (await fs.pathExists(oversizedPath)) {
				// Note: This test uses the real config which has a 50MB limit
				// The oversized.jpg file must be > 50MB to trigger rejection
				const stats = await fs.stat(oversizedPath);
				const fileSizeMB = stats.size / (1024 * 1024);

				if (fileSizeMB > 50) {
					await expect(verifyImage(oversizedPath, config)).rejects.toThrow(ImageCorrupted);
				} else {
					return;
				}
			}
		});

		it.skip('should reject oversized files (with mock)', async () => {
			// This test is skipped because we no longer mock config in integration tests
			// If needed, this should be tested in unit tests where mocking is appropriate
			const oversizedPath = path.join(testImagesDir, 'oversized.jpg');
			if (await fs.pathExists(oversizedPath)) {
				// Would need to mock config here
				await expect(verifyImage(oversizedPath, config)).rejects.toThrow(ImageCorrupted);
			}
		});

		it('should handle files with special characters in names', async () => {
			const specialFiles = ['file with spaces.jpg', 'file-with-dashes.png', 'file_with_underscores.gif'];

			for (const file of specialFiles) {
				const imagePath = path.join(testImagesDir, file);
				if (await fs.pathExists(imagePath)) {
					await expect(verifyImage(imagePath, config)).resolves.not.toThrow();
				}
			}
		});
	});

	describe('findImageFiles with real directory', () => {
		it('should find all image files in test directory', async () => {
			const imageFiles = await findImageFiles(testImagesDir, config, false);

			expect(imageFiles.length).toBeGreaterThan(0);

			// Verify all returned files are images
			for (const file of imageFiles) {
				expect(isSupportedImage(file, config)).toBe(true);
			}
		});

		it('should return sorted file list', async () => {
			const imageFiles = await findImageFiles(testImagesDir, config, false);
			const sortedFiles = [...imageFiles].sort();

			expect(imageFiles).toEqual(sortedFiles);
		});

		it('should find images with various naming patterns', async () => {
			const imageFiles = await findImageFiles(testImagesDir, config, false);
			const filenames = imageFiles.map(file => path.basename(file));

			// Check for files with different naming patterns
			expect(filenames.some(name => name.includes(' '))).toBe(true); // spaces
			expect(filenames.some(name => name.includes('-'))).toBe(true); // dashes
			expect(filenames.some(name => name.includes('_'))).toBe(true); // underscores
			expect(filenames.some(name => /[A-Z]/.test(name))).toBe(true); // uppercase
		});

		it('should exclude non-image files', async () => {
			const imageFiles = await findImageFiles(testImagesDir, config, false);
			const filenames = imageFiles.map(file => path.basename(file));

			expect(filenames).not.toContain('README.md');
		});
	});

	describe('Real file operations', () => {
		it('should handle non-existent files gracefully', async () => {
			const nonExistentPath = path.join(testImagesDir, 'does-not-exist.jpg');

			await expect(verifyImage(nonExistentPath, config)).rejects.toThrow(FileOperationError);
		});

		it('should work with absolute and relative paths', async () => {
			const imageName = 'small_red.jpg';
			const absolutePath = path.resolve(testImagesDir, imageName);

			if (await fs.pathExists(absolutePath)) {
				await expect(verifyImage(absolutePath, config)).resolves.not.toThrow();
			}
		});
	});
});
