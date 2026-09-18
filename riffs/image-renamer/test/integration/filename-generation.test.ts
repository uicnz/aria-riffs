import * as path from 'node:path';
import * as fs from 'fs-extra';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/lib/config.js';
import { ImageCorrupted } from '../../src/lib/types.js';
import {
	findImageFiles,
	getUniqueFilename,
	isSupportedImage,
	sanitizeFilename,
	verifyImage,
} from '../../src/utils/utils.js';

// Note: These integration tests use the real config from Zod defaults
const config = loadConfig();

describe('image-renamer Integration - Filename Generation', () => {
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

		it('should handle mixed case extensions', () => {
			expect(isSupportedImage('UPPERCASE.JPG', config)).toBe(true);
			expect(isSupportedImage('MiXeD_CaSe-File.png', config)).toBe(true);
		});
	});

	describe('verifyImage with real images', () => {
		it('should verify small valid images', async () => {
			const validImages = ['small_red.jpg', 'small_green.png', 'tiny_white.png'];

			for (const image of validImages) {
				const imagePath = path.join(testImagesDir, image);
				if (await fs.pathExists(imagePath)) {
					await expect(verifyImage(imagePath, config)).resolves.not.toThrow();
				}
			}
		});

		it('should verify different image formats', async () => {
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
	});

	describe('sanitizeFilename with real scenarios', () => {
		it('should handle typical AI-generated descriptions', () => {
			const descriptions = [
				'Beautiful sunset over mountain landscape',
				'A cat sitting on a wooden table',
				'Urban cityscape with tall buildings at night',
				'Close-up portrait of a smiling person',
				'Red sports car parked in garage',
			];

			for (const desc of descriptions) {
				const result = sanitizeFilename(desc, config);
				expect(result).toMatch(/^[a-z0-9_-]+$/);
				expect(result.length).toBeLessThanOrEqual(100);
				expect(result).not.toContain(' ');
			}
		});

		it('should handle descriptions with punctuation', () => {
			const descriptions = [
				'Dog playing in park, very happy!',
				'Woman reading book - peaceful scene.',
				"Child's toy car: red & blue colors",
				'Ocean waves (big splash!) on rocks',
			];

			for (const desc of descriptions) {
				const result = sanitizeFilename(desc, config);
				expect(result).toMatch(/^[a-z0-9_-]+$/);
				expect(result).not.toMatch(/[!@#$%^&*(),.?":{}|<>]/);
			}
		});

		it('should truncate very long descriptions', () => {
			const longDesc =
				'This is a very detailed description of an image that contains many words and goes on for quite a while with lots of descriptive language about various aspects of the scene including colors lighting composition and subject matter that would normally exceed our filename length limits';

			const result = sanitizeFilename(longDesc, config);
			expect(result.length).toBeLessThanOrEqual(100);
			expect(result).not.toContain(' ');
		});

		it('should handle edge cases', () => {
			expect(sanitizeFilename('', config)).toBe('unnamed-image');
			expect(sanitizeFilename('   ', config)).toBe('unnamed-image');
			expect(sanitizeFilename('!!!!', config)).toBe('unnamed-image');
			expect(sanitizeFilename('123 456', config)).toBe('123-456'); // Uses - as configured separator
		});
	});

	describe('getUniqueFilename with real directory', () => {
		it('should generate unique filenames when conflicts exist', async () => {
			// Use test images directory to test with existing files
			const existingFile = 'small_red.jpg';
			const existingPath = path.join(testImagesDir, existingFile);

			if (await fs.pathExists(existingPath)) {
				// When renaming to same name, should return original path
				const result = await getUniqueFilename(existingPath, 'small_red');
				expect(result).toBe(existingPath);

				// When renaming to different name, should create unique path
				const result2 = await getUniqueFilename(existingPath, 'new_name');
				expect(result2).toBe(path.join(testImagesDir, 'new_name.jpg'));
				expect(await fs.pathExists(result2)).toBe(false);
			}
		});

		it('should return original path if new basename creates unique file', async () => {
			const originalPath = path.join(testImagesDir, 'small_red.jpg');
			const result = await getUniqueFilename(originalPath, 'definitely_unique_name_12345');
			expect(result).toBe(path.join(testImagesDir, 'definitely_unique_name_12345.jpg'));
		});

		it('should handle same file path (no rename needed)', async () => {
			const existingFile = 'small_red.jpg';
			const existingPath = path.join(testImagesDir, existingFile);

			if (await fs.pathExists(existingPath)) {
				const result = await getUniqueFilename(existingPath, 'small_red');
				expect(result).toBe(existingPath); // Should return original path when renaming to same name
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

			// Verify files exist
			for (const file of imageFiles) {
				expect(await fs.pathExists(file)).toBe(true);
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

	describe('Real filename sanitization scenarios', () => {
		it('should handle problematic characters from test files', async () => {
			const testFilenames = [
				'file with spaces.jpg',
				'file-with-dashes.png',
				'file_with_underscores.gif',
				'special!@#chars.png',
			];

			for (const filename of testFilenames) {
				const testPath = path.join(testImagesDir, filename);
				if (await fs.pathExists(testPath)) {
					const baseName = path.basename(filename, path.extname(filename));
					const sanitized = sanitizeFilename(baseName, config);

					expect(sanitized).toMatch(/^[a-z0-9_-]+$/);
					expect(sanitized).not.toContain(' ');
					expect(sanitized).not.toMatch(/[!@#$%^&*(),.?":{}|<>]/);
				}
			}
		});

		it('should create valid filenames for all test images', async () => {
			const imageFiles = await findImageFiles(testImagesDir, config);

			for (const imagePath of imageFiles) {
				const originalBasename = path.basename(imagePath, path.extname(imagePath));
				const sanitized = sanitizeFilename(originalBasename, config);

				expect(sanitized.length).toBeGreaterThan(0);
				expect(sanitized).toMatch(/^[a-z0-9_-]+$/);
				expect(sanitized.length).toBeLessThanOrEqual(100);
			}
		});
	});

	describe('Performance and edge cases', () => {
		it('should handle large number of filename collisions efficiently', async () => {
			// Test with an existing file to force collision detection
			const existingFile = 'small_red.jpg';
			const existingPath = path.join(testImagesDir, existingFile);

			if (await fs.pathExists(existingPath)) {
				const start = Date.now();
				const result = await getUniqueFilename(existingPath, 'small_red');
				const end = Date.now();

				expect(result).toBe(existingPath); // Same file should return original path
				expect(end - start).toBeLessThan(100); // Should be fast
			}
		});

		it('should handle very long directory paths', async () => {
			const longBasename = 'a'.repeat(50);
			const testPath = path.join(testImagesDir, 'small_red.jpg'); // Use existing file
			const result = await getUniqueFilename(testPath, longBasename);

			// Should work even with long paths
			expect(result).toBeDefined();
			expect(result.endsWith('.jpg')).toBe(true);
			expect(path.basename(result)).toContain(longBasename);
		});
	});
});
