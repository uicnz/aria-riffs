/// <reference types="vitest" />
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies BEFORE importing them
vi.mock('node:fs/promises', () => ({
	access: vi.fn(),
	stat: vi.fn(),
	readdir: vi.fn(),
	readFile: vi.fn(),
	unlink: vi.fn(),
}));

vi.mock('node:fs', () => ({
	constants: {
		R_OK: 4,
	},
}));

vi.mock('fs-extra', () => ({
	pathExists: vi.fn(),
	move: vi.fn(),
	ensureDir: vi.fn(),
}));

// Now import the mocked modules
import * as fsPromises from 'node:fs/promises';
import * as path from 'node:path';
import { FilePermissionError } from '../../src/lib/types.js';

// Mock loadConfig and logger with hoisted pattern for module-level initialization
const { mockLoadConfig, mockLogger, mockCreateLogger } = vi.hoisted(() => {
	const config = {
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
			file: '.aria/logs/test/image-metadata-utils.log',
			maxFileSizeMb: 10,
			maxFiles: 7,
		},
		llmProviders: {
			ollama: { endpoint: '', model: '', timeout: 30, keepAlive: 5, prompt: '' },
			anthropic: { apiKey: '', model: '', timeout: 30, maxTokens: 1024, baseUrl: '', prompt: '' },
			gemini: { apiKey: '', model: '', timeout: 30, maxTokens: 1024, baseUrl: '', prompt: '' },
		},
	};
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
		mockLoadConfig: vi.fn().mockReturnValue(config),
		mockLogger,
		mockCreateLogger: vi.fn(() => mockLogger),
	};
});

vi.mock('../../src/lib/config', () => ({
	loadConfig: mockLoadConfig,
}));

vi.mock('../../src/lib/logger.js', () => ({
	createLogger: mockCreateLogger,
}));

const mockedFsPromises = vi.mocked(fsPromises);

// Import the module under test after mocking
import * as utils from '../../src/utils/utils.js';

describe('ImageMeta Utils', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('isSupportedImage', () => {
		it('given image with supported extension, when isSupportedImage called, then should return true', () => {
			// Config is pre-loaded with supported extensions: ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp']
			expect(utils.isSupportedImage('test.jpg')).toBe(true);
			expect(utils.isSupportedImage('test.JPG')).toBe(true);
			expect(utils.isSupportedImage('test.png')).toBe(true);
			expect(utils.isSupportedImage('path/to/image.jpeg')).toBe(true);
		});

		it('given image with unsupported extension, when isSupportedImage called, then should return false', () => {
			// Config is pre-loaded with supported extensions that don't include .txt, .pdf
			expect(utils.isSupportedImage('test.txt')).toBe(false);
			expect(utils.isSupportedImage('test.pdf')).toBe(false);
			expect(utils.isSupportedImage('test')).toBe(false);
		});

		it('given supported extension, when isSupportedImage called, then should use configured extensions', () => {
			// Config is loaded at module level with default extensions
			expect(utils.isSupportedImage('test.png')).toBe(true);
		});
	});

	describe('findImageFiles', () => {
		// Config is pre-loaded with supported extensions including .jpg, .png

		it('given directory with images and non-images, when findImageFiles called non-recursively, then should find only image files', async () => {
			const mockEntries = [
				{ name: 'image1.jpg', isFile: () => true, isDirectory: () => false },
				{ name: 'image2.png', isFile: () => true, isDirectory: () => false },
				{ name: 'document.txt', isFile: () => true, isDirectory: () => false },
				{ name: 'subdir', isFile: () => false, isDirectory: () => true },
			];

			mockedFsPromises.readdir.mockResolvedValue(mockEntries as any);

			const result = await utils.findImageFiles('/test/dir', false);

			expect(result).toEqual([path.join('/test/dir', 'image1.jpg'), path.join('/test/dir', 'image2.png')].sort());
		});

		it('given directory with subdirectories containing images, when findImageFiles called recursively, then should find all image files', async () => {
			const mockRootEntries = [
				{ name: 'image1.jpg', isFile: () => true, isDirectory: () => false },
				{ name: 'subdir', isFile: () => false, isDirectory: () => true },
			];
			const mockSubEntries = [{ name: 'image2.png', isFile: () => true, isDirectory: () => false }];

			mockedFsPromises.readdir
				.mockResolvedValueOnce(mockRootEntries as any)
				.mockResolvedValueOnce(mockSubEntries as any);

			const result = await utils.findImageFiles('/test/dir', true);

			expect(result).toEqual(
				[path.join('/test/dir', 'image1.jpg'), path.join('/test/dir', 'subdir', 'image2.png')].sort()
			);

			expect(mockedFsPromises.readdir).toHaveBeenCalledTimes(2);
		});

		it('given directory read fails, when findImageFiles called, then should return empty array and warn', async () => {
			mockedFsPromises.readdir.mockRejectedValue(new Error('Permission denied'));

			const result = await utils.findImageFiles('/test/dir');

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

	describe('encodeImageToBase64', () => {
		it('given image file, when encodeImageToBase64 called, then should encode to base64', async () => {
			const mockBuffer = Buffer.from('fake image data');
			mockedFsPromises.readFile.mockResolvedValue(mockBuffer);

			const result = await utils.encodeImageToBase64('test.jpg');

			expect(result).toBe(mockBuffer.toString('base64'));
			expect(mockedFsPromises.readFile).toHaveBeenCalledWith('test.jpg');
		});

		it('given file read fails, when encodeImageToBase64 called, then should throw FilePermissionError', async () => {
			mockedFsPromises.readFile.mockRejectedValue(new Error('Read failed'));

			await expect(utils.encodeImageToBase64('test.jpg')).rejects.toThrow(FilePermissionError);
		});
	});

	describe('sleep', () => {
		it('given duration in seconds, when sleep called, then should pause execution', async () => {
			const start = Date.now();
			await utils.sleep(0.1); // 100ms
			const end = Date.now();

			expect(end - start).toBeGreaterThanOrEqual(90);
		});
	});

	describe('retryWithBackoff', () => {
		it('given function succeeds on first call, when retryWithBackoff called, then should return result immediately', async () => {
			const mockFn = vi.fn().mockResolvedValue('success');

			const result = await utils.retryWithBackoff(mockFn, 3);

			expect(result).toBe('success');
			expect(mockFn).toHaveBeenCalledTimes(1);
		});

		it('given function fails then succeeds, when retryWithBackoff called, then should retry and return result', async () => {
			const mockFn = vi
				.fn()
				.mockRejectedValueOnce(new Error('attempt 1'))
				.mockRejectedValueOnce(new Error('attempt 2'))
				.mockResolvedValueOnce('success');

			const result = await utils.retryWithBackoff(mockFn, 3, 0.01);

			expect(result).toBe('success');
			expect(mockFn).toHaveBeenCalledTimes(3);
		});

		it('given function fails on all attempts, when retryWithBackoff called, then should throw last error', async () => {
			const lastError = new Error('final attempt');
			const mockFn = vi
				.fn()
				.mockRejectedValueOnce(new Error('attempt 1'))
				.mockRejectedValueOnce(new Error('attempt 2'))
				.mockRejectedValueOnce(lastError);

			await expect(utils.retryWithBackoff(mockFn, 3, 0.01)).rejects.toThrow('final attempt');

			expect(mockFn).toHaveBeenCalledTimes(3);
		});

		it('given function fails multiple times, when retryWithBackoff called, then should use exponential backoff delays', async () => {
			const mockFn = vi
				.fn()
				.mockRejectedValueOnce(new Error('attempt 1'))
				.mockRejectedValueOnce(new Error('attempt 2'))
				.mockResolvedValueOnce('success');

			const start = Date.now();
			await utils.retryWithBackoff(mockFn, 3, 0.01);
			const end = Date.now();

			// Should have waited approximately 0.01 + 0.02 = 0.03 seconds
			expect(end - start).toBeGreaterThanOrEqual(20);
			expect(mockFn).toHaveBeenCalledTimes(3);
		});
	});
});
