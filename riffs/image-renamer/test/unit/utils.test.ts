/// <reference types="vitest" />

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as fsExtra from 'fs-extra';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImageRenamerConfig } from '../../src/lib/schema.js';
import { FileOperationError, ImageCorrupted } from '../../src/lib/types.js';

// Mock dependencies
vi.mock('fs', () => ({
	constants: {
		R_OK: 4,
	},
	promises: {
		access: vi.fn(),
		stat: vi.fn(),
		readdir: vi.fn(),
		readFile: vi.fn(),
	},
}));

vi.mock('fs-extra', () => ({
	pathExists: vi.fn(),
}));

vi.mock('sharp');

const mockedFs = vi.mocked(fs);
const mockedFsExtra = vi.mocked(fsExtra);
const mockedSharp = vi.mocked(sharp);

// Import the module under test after mocking
import * as utils from '../../src/utils/utils.js';

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
					model: 'llava-llama3',
					timeout: 30,
					retryAttempts: 3,
					retryDelay: 1.0,
					prompt: 'Describe this image in 4-5 words',
				},
				anthropic: {
					apiKey: '',
					model: 'claude-sonnet-4-20250514',
					timeout: 30,
					maxTokens: 1024,
					baseUrl: 'https://api.anthropic.com/v1',
					prompt: 'Generate a concise filename',
				},
				gemini: {
					apiKey: '',
					model: 'gemini-2.5-flash',
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
			file: '.aria/logs/test/image-renamer-utils.log',
			maxFileSizeMb: 10,
			maxFiles: 7,
		},
	};

	return { ...defaultConfig, ...overrides };
}

describe('image-renamer Utils', () => {
	let testConfig: ImageRenamerConfig;

	beforeEach(() => {
		vi.clearAllMocks();
		testConfig = createTestConfig();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('isSupportedImage', () => {
		it('should return true for supported extensions', () => {
			expect(utils.isSupportedImage('test.jpg', testConfig)).toBe(true);
			expect(utils.isSupportedImage('test.JPG', testConfig)).toBe(true);
			expect(utils.isSupportedImage('test.png', testConfig)).toBe(true);
			expect(utils.isSupportedImage('path/to/image.gif', testConfig)).toBe(true);
		});

		it('should return false for unsupported extensions', () => {
			testConfig['image-renamer'].images.supportedExtensions = ['.png', '.jpg', '.jpeg'];

			expect(utils.isSupportedImage('test.txt', testConfig)).toBe(false);
			expect(utils.isSupportedImage('test.pdf', testConfig)).toBe(false);
			expect(utils.isSupportedImage('test', testConfig)).toBe(false);
		});

		it('should work with custom extensions', () => {
			testConfig['image-renamer'].images.supportedExtensions = ['.webp', '.avif'];

			expect(utils.isSupportedImage('test.webp', testConfig)).toBe(true);
			expect(utils.isSupportedImage('test.avif', testConfig)).toBe(true);
			expect(utils.isSupportedImage('test.jpg', testConfig)).toBe(false);
		});
	});

	describe('verifyImage', () => {
		const mockStats = { size: 1024 * 1024 }; // 1MB
		const mockMetadata = { format: 'jpeg', width: 100, height: 100 };

		beforeEach(() => {
			// @ts-expect-error
			mockedFs.promises.access.mockResolvedValue(undefined);
			// @ts-expect-error
			mockedFs.promises.stat.mockResolvedValue(mockStats);

			const mockSharpInstance = {
				metadata: vi.fn().mockResolvedValue(mockMetadata),
			};
			// @ts-expect-error
			mockedSharp.mockReturnValue(mockSharpInstance);
		});

		it('should pass verification for valid image files', async () => {
			await expect(utils.verifyImage('test.jpg', testConfig)).resolves.not.toThrow();

			expect(mockedFs.promises.access).toHaveBeenCalledWith('test.jpg', fs.constants.R_OK);
			expect(mockedFs.promises.stat).toHaveBeenCalledWith('test.jpg');
			expect(mockedSharp).toHaveBeenCalledWith('test.jpg');
		});

		it('should throw ImageCorrupted for files too large', async () => {
			const largeMockStats = { size: 100 * 1024 * 1024 }; // 100MB
			// @ts-expect-error
			mockedFs.promises.stat.mockResolvedValue(largeMockStats);

			await expect(utils.verifyImage('test.jpg', testConfig)).rejects.toThrow(ImageCorrupted);
			await expect(utils.verifyImage('test.jpg', testConfig)).rejects.toThrow(
				'Image file too large: 100MB > 50MB'
			);
		});

		it('should throw ImageCorrupted for invalid image format', async () => {
			const mockSharpInstance = {
				metadata: vi.fn().mockResolvedValue({}),
			};
			// @ts-expect-error
			mockedSharp.mockReturnValue(mockSharpInstance);

			await expect(utils.verifyImage('test.jpg', testConfig)).rejects.toThrow(ImageCorrupted);
		});

		it('should skip sharp verification when disabled in config', async () => {
			testConfig['image-renamer'].images.verifyBeforeProcessing = false;

			await expect(utils.verifyImage('test.jpg', testConfig)).resolves.not.toThrow();

			expect(mockedFs.promises.access).toHaveBeenCalled();
			expect(mockedFs.promises.stat).toHaveBeenCalled();
			expect(mockedSharp).not.toHaveBeenCalled();
		});

		it('should handle file access errors', async () => {
			const error = new Error('Permission denied') as NodeJS.ErrnoException;
			error.code = 'EACCES';
			// @ts-expect-error
			mockedFs.promises.access.mockRejectedValue(error);

			await expect(utils.verifyImage('test.jpg', testConfig)).rejects.toThrow(FileOperationError);
			await expect(utils.verifyImage('test.jpg', testConfig)).rejects.toThrow(
				'Permission denied accessing file: test.jpg'
			);
		});
	});

	describe('sanitizeFilename', () => {
		it('should remove punctuation when configured', () => {
			const result = utils.sanitizeFilename('Hello, World! & More...', testConfig);
			expect(result).toBe('hello_world_more');
		});

		it('should replace spaces with configured character', () => {
			const result = utils.sanitizeFilename('file with spaces', testConfig);
			expect(result).toBe('file_with_spaces');
		});

		it('should convert case as configured', () => {
			testConfig['image-renamer'].filename.caseConversion = 'upper';
			testConfig['image-renamer'].filename.removePunctuation = false;

			const result = utils.sanitizeFilename('Mixed Case File', testConfig);
			expect(result).toBe('MIXED_CASE_FILE');
		});

		it('should preserve punctuation when disabled', () => {
			testConfig['image-renamer'].filename.removePunctuation = false;
			testConfig['image-renamer'].filename.caseConversion = 'none';

			const result = utils.sanitizeFilename('File, With! Punctuation.', testConfig);
			expect(result).toBe('File,_With!_Punctuation.');
		});

		it('should truncate long filenames', () => {
			testConfig['image-renamer'].filename.maxLength = 10;

			const result = utils.sanitizeFilename('very long filename that exceeds limit', testConfig);
			// Length can be <= 10 due to trailing character trimming
			expect(result.length).toBeLessThanOrEqual(10);
			expect(result.length).toBeGreaterThan(0);
		});

		it('should handle empty filenames', () => {
			const result = utils.sanitizeFilename('', testConfig);
			expect(result).toBe('unnamed-image');
		});
	});

	describe('getUniqueFilename', () => {
		beforeEach(() => {
			// @ts-expect-error
			mockedFsExtra.pathExists.mockResolvedValue(false);
		});

		it('should return original filename if unique', async () => {
			const result = await utils.getUniqueFilename('/path/original.jpg', 'test');
			expect(result).toBe('/path/test.jpg');
		});

		it('should generate numbered filename if original exists', async () => {
			mockedFsExtra.pathExists
				// @ts-expect-error
				.mockResolvedValueOnce(true) // test.jpg exists
				// @ts-expect-error
				.mockResolvedValueOnce(false); // test_1.jpg doesn't exist

			const result = await utils.getUniqueFilename('/path/original.jpg', 'test');
			expect(result).toBe('/path/test-1.jpg');
		});

		it('should increment until unique filename found', async () => {
			mockedFsExtra.pathExists
				// @ts-expect-error
				.mockResolvedValueOnce(true) // test.jpg exists
				// @ts-expect-error
				.mockResolvedValueOnce(true) // test-1.jpg exists
				// @ts-expect-error
				.mockResolvedValueOnce(true) // test-2.jpg exists
				// @ts-expect-error
				.mockResolvedValueOnce(false); // test-3.jpg doesn't exist

			const result = await utils.getUniqueFilename('/path/original.jpg', 'test');
			expect(result).toBe('/path/test-3.jpg');
		});

		it('should handle filenames without extensions', async () => {
			mockedFsExtra.pathExists
				// @ts-expect-error
				.mockResolvedValueOnce(true) // filename exists
				// @ts-expect-error
				.mockResolvedValueOnce(false); // filename-1 doesn't exist

			const result = await utils.getUniqueFilename('/path/original', 'filename');
			expect(result).toBe('/path/filename-1');
		});
	});

	describe('sleep', () => {
		it('should sleep for specified duration', async () => {
			const start = Date.now();
			await utils.sleep(0.1); // 100ms
			const end = Date.now();

			expect(end - start).toBeGreaterThanOrEqual(90);
		});
	});

	describe('findImageFiles', () => {
		it('should find image files in directory', async () => {
			const mockEntries = [
				{ name: 'image1.jpg', isFile: () => true, isDirectory: () => false },
				{ name: 'image2.png', isFile: () => true, isDirectory: () => false },
				{ name: 'document.txt', isFile: () => true, isDirectory: () => false },
				{ name: 'subdir', isFile: () => false, isDirectory: () => true },
			];

			// @ts-expect-error
			mockedFs.promises.readdir.mockResolvedValue(mockEntries);

			const result = await utils.findImageFiles('/test/dir', testConfig);

			expect(result).toEqual([path.join('/test/dir', 'image1.jpg'), path.join('/test/dir', 'image2.png')].sort());
		});
	});
});
