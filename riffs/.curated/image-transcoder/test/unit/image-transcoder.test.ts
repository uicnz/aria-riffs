import { promises as fs, type Stats } from 'node:fs';
import type { Logger } from 'pino';
import sharp from 'sharp';
import { describe, expect, it, vi } from 'vitest';
import { ImageTranscoder } from '../../src/core/image-transcoder.js';
import { loadConfig } from '../../src/lib/config.js';

// Create a mock logger for tests
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

vi.mock('fs', async () => {
	const actual = await vi.importActual<typeof import('fs')>('fs');
	return {
		...actual,
		promises: {
			stat: vi.fn(),
			writeFile: vi.fn(),
			readFile: vi.fn(),
			readdir: vi.fn(),
			access: vi.fn(),
			unlink: vi.fn(),
			rename: vi.fn(),
		},
	};
});

vi.mock('sharp', () => ({
	default: vi.fn(),
}));

describe('image-transcoder - Error Handling', () => {
	it('given fs.stat fails with permission error, when processFile called, then returns failure result', async () => {
		const transcoder = new ImageTranscoder(loadConfig(), createMockLogger());
		const mockStat = vi.mocked(fs.stat);
		mockStat.mockRejectedValue(new Error('EACCES: permission denied'));

		const result = await transcoder.processFile('test.jpg');

		expect(result.success).toBe(false);
		expect(result.error).toContain('permission denied');
		expect(result.inputPath).toBe('test.jpg');
	});

	it('given fs.stat fails with file not found, when processFile called, then returns failure result', async () => {
		const transcoder = new ImageTranscoder(loadConfig(), createMockLogger());
		const mockStat = vi.mocked(fs.stat);
		mockStat.mockRejectedValue(new Error('ENOENT: no such file or directory'));

		const result = await transcoder.processFile('nonexistent.jpg');

		expect(result.success).toBe(false);
		expect(result.error).toContain('no such file or directory');
		expect(result.inputPath).toBe('nonexistent.jpg');
	});

	it('given sharp fails with invalid image format, when processFile called, then returns failure result', async () => {
		const config = loadConfig();
		config['image-transcoder'].transcoding.maxFileSizeBytes = 1;
		const transcoder = new ImageTranscoder(config, createMockLogger());

		const mockStat = vi.mocked(fs.stat);
		mockStat.mockResolvedValue({ size: 1000, isDirectory: () => false } as Stats);

		const mockSharp = vi.mocked(sharp);
		mockSharp.mockReturnValue({
			withMetadata: vi.fn().mockReturnThis(),
			webp: vi.fn().mockReturnThis(),
			toBuffer: vi.fn().mockRejectedValue(new Error('Input file contains unsupported image format')),
		} as unknown as ReturnType<typeof sharp>);

		const result = await transcoder.processFile('invalid.jpg');

		expect(result.success).toBe(false);
		expect(result.error).toContain('unsupported image format');
	});

	it('given fs.writeFile fails with disk full error, when processFile called, then returns failure result', async () => {
		const config = loadConfig();
		config['image-transcoder'].transcoding.maxFileSizeBytes = 500; // Between input (1000) and buffer (4) to trigger write without dimension reduction
		const transcoder = new ImageTranscoder(config, createMockLogger());

		const mockStat = vi.mocked(fs.stat);
		mockStat.mockResolvedValueOnce({ size: 1000, isDirectory: () => false } as Stats);
		mockStat.mockResolvedValueOnce({ size: 1000, isDirectory: () => false } as Stats);

		const mockSharp = vi.mocked(sharp);
		mockSharp.mockReturnValue({
			withMetadata: vi.fn().mockReturnThis(),
			webp: vi.fn().mockReturnThis(),
			toBuffer: vi.fn().mockResolvedValue(Buffer.from('test')),
		} as unknown as ReturnType<typeof sharp>);

		const mockWriteFile = vi.mocked(fs.writeFile);
		mockWriteFile.mockRejectedValue(new Error('ENOSPC: no space left on device'));

		const result = await transcoder.processFile('test.jpg');

		expect(result.success).toBe(false);
		expect(result.error).toContain('no space left on device');
	});

	it('given directory read fails, when process called on directory, then throws error', async () => {
		const mockStat = vi.mocked(fs.stat);
		const mockReaddir = vi.mocked(fs.readdir);

		mockStat.mockReset();
		mockReaddir.mockReset();

		mockStat.mockResolvedValue({ size: 0, isDirectory: () => true } as Stats);
		mockReaddir.mockRejectedValue(new Error('EACCES: permission denied'));

		const transcoder = new ImageTranscoder(loadConfig(), createMockLogger());

		await expect(transcoder.process('test-dir')).rejects.toThrow('permission denied');
	});
});

describe('image-transcoder - Constructor and Config', () => {
	it('given config with output_dir, when instantiated, then outputDir is set from config', () => {
		const config = loadConfig();
		config['image-transcoder'].paths.output.dir = '/config/output/path';
		const transcoder = new ImageTranscoder(config, createMockLogger());

		expect(transcoder.outputDir).toBe('/config/output/path');
	});

	it('given config provided, when instantiated, then stores config', () => {
		const config = loadConfig();
		const transcoder = new ImageTranscoder(config, createMockLogger());

		expect(transcoder.config).toBeDefined();
		expect(transcoder.config['image-transcoder'].transcoding.maxFileSizeBytes).toBe(5242880);
	});
});

describe('image-transcoder - BatchResult Return Type', () => {
	it('given single file path, when process called, then returns BatchResult with one file', async () => {
		const config = loadConfig();
		config['image-transcoder'].transcoding.maxFileSizeBytes = 10000;
		const transcoder = new ImageTranscoder(config, createMockLogger());

		const mockStat = vi.mocked(fs.stat);
		mockStat.mockResolvedValue({ size: 5000, isDirectory: () => false } as Stats);

		const result = await transcoder.process('test-file.jpg');

		expect(result).toMatchObject({
			totalFiles: 1,
			processed: 1,
			failed: 0,
			skipped: 0,
		});
		expect(result.results).toHaveLength(1);
		expect(result.results[0].success).toBe(true);
	});

	it('given directory with mixed success and failure, when process called, then returns correct counts', async () => {
		const config = loadConfig();
		config['image-transcoder'].transcoding.maxFileSizeBytes = 10000;
		const transcoder = new ImageTranscoder(config, createMockLogger());

		const mockStat = vi.mocked(fs.stat);
		const mockReaddir = vi.mocked(fs.readdir);

		mockStat.mockReset();
		mockReaddir.mockReset();

		// Directory check
		mockStat.mockResolvedValueOnce({
			size: 0,
			isDirectory: () => true,
		} as Stats);

		// File stats for processFile calls
		mockStat.mockResolvedValue({
			size: 5000,
			isDirectory: () => false,
		} as Stats);

		mockReaddir.mockResolvedValue(['good.jpg', 'bad.jpg', 'skip.txt'] as unknown as Awaited<
			ReturnType<typeof fs.readdir>
		>);

		// Mock processFile to succeed for first file, fail for second
		const successResult = {
			inputPath: 'test-dir/good.jpg',
			outputPath: 'test-dir/good.jpg',
			originalSize: 5000,
			finalSize: 5000,
			iterations: 0,
			success: true,
		};
		const failureResult = {
			inputPath: 'test-dir/bad.jpg',
			outputPath: 'test-dir/bad.jpg',
			originalSize: 0,
			finalSize: 0,
			iterations: 0,
			success: false,
			error: 'Simulated error',
		};

		vi.spyOn(transcoder, 'processFile').mockResolvedValueOnce(successResult).mockResolvedValueOnce(failureResult);

		const result = await transcoder.process('test-dir');

		expect(result).toMatchObject({
			totalFiles: 3,
			processed: 1,
			failed: 1,
			skipped: 1,
		});
		expect(result.results).toHaveLength(2);
		expect(result.results.filter(r => r.success)).toHaveLength(1);
		expect(result.results.filter(r => !r.success)).toHaveLength(1);
	});
});

describe('image-transcoder - ProcessingResult Return Type', () => {
	it('given file under threshold, when processFile called, then returns success result with no iterations', async () => {
		const config = loadConfig();
		config['image-transcoder'].transcoding.maxFileSizeBytes = 10000;
		const transcoder = new ImageTranscoder(config, createMockLogger());

		const mockStat = vi.mocked(fs.stat);
		mockStat.mockResolvedValue({ size: 5000, isDirectory: () => false } as Stats);

		const result = await transcoder.processFile('test.jpg');

		expect(result).toMatchObject({
			inputPath: 'test.jpg',
			originalSize: 5000,
			finalSize: 5000,
			iterations: 0,
			success: true,
		});
		expect(result.error).toBeUndefined();
	});

	it('given file over threshold, when processFile called, then returns success result with correct finalSize and iterations', async () => {
		const config = loadConfig();
		config['image-transcoder'].transcoding.maxFileSizeBytes = 100;
		config['image-transcoder'].paths.output.dir = '/output';
		const transcoder = new ImageTranscoder(config, createMockLogger());

		const mockStat = vi.mocked(fs.stat);
		mockStat.mockResolvedValue({ size: 1000, isDirectory: () => false } as Stats);

		const mockReadFile = vi.mocked(fs.readFile);
		mockReadFile.mockResolvedValue(Buffer.alloc(150)); // Over threshold

		const mockWriteFile = vi.mocked(fs.writeFile);
		mockWriteFile.mockResolvedValue();

		// Mock convertToWebp to return buffer still over threshold (triggers dimension reduction)
		vi.spyOn(
			transcoder as unknown as { convertToWebp: (buffer: Buffer) => Promise<Buffer> },
			'convertToWebp'
		).mockResolvedValue(Buffer.alloc(150));

		// Mock reduceDimensions to return buffer under threshold
		vi.spyOn(
			transcoder as unknown as { reduceDimensions: (buffer: Buffer) => Promise<Buffer> },
			'reduceDimensions'
		).mockResolvedValue(Buffer.alloc(80));

		const result = await transcoder.processFile('test.jpg');

		expect(result.success).toBe(true);
		expect(result.inputPath).toBe('test.jpg');
		expect(result.outputPath).toBe('/output/test.webp');
		expect(result.originalSize).toBe(1000);
		expect(result.finalSize).toBe(80);
		expect(result.iterations).toBe(1);
		expect(result.error).toBeUndefined();
	});
});

describe('image-transcoder - Unit Tests', () => {
	it('given file smaller than threshold, when processFile called, then does not convert', async () => {
		const config = loadConfig();
		config['image-transcoder'].transcoding.maxFileSizeBytes = 10000;
		const transcoder = new ImageTranscoder(config, createMockLogger());

		const mockStat = vi.mocked(fs.stat);
		mockStat.mockResolvedValue({ size: 5000, isDirectory: () => false } as Stats);

		const reduceFileSize = vi.spyOn(
			transcoder as unknown as { reduceFileSize: (path: string) => Promise<void> },
			'reduceFileSize'
		);

		await transcoder.processFile('test.jpg');

		expect(reduceFileSize).not.toHaveBeenCalled();
	});

	it('given jpeg file over threshold, when processFile called, then converts to webp successfully', async () => {
		const config = loadConfig();
		config['image-transcoder'].transcoding.maxFileSizeBytes = 100;
		const transcoder = new ImageTranscoder(config, createMockLogger());

		const mockStat = vi.mocked(fs.stat);
		mockStat.mockResolvedValueOnce({ size: 1000, isDirectory: () => false } as Stats);
		mockStat.mockResolvedValueOnce({ size: 1000, isDirectory: () => false } as Stats);
		mockStat.mockResolvedValueOnce({ size: 80, isDirectory: () => false } as Stats);
		mockStat.mockResolvedValueOnce({ size: 80, isDirectory: () => false } as Stats);

		const mockReadFile = vi.mocked(fs.readFile);
		const inputBuffer = Buffer.from('input-data');
		mockReadFile.mockResolvedValue(inputBuffer);

		const mockWriteFile = vi.mocked(fs.writeFile);
		mockWriteFile.mockResolvedValue();

		const convertToWebp = vi
			.spyOn(transcoder as unknown as { convertToWebp: (buffer: Buffer) => Promise<Buffer> }, 'convertToWebp')
			.mockResolvedValue(Buffer.from('webp-data'));

		await transcoder.processFile('test.jpg');

		expect(convertToWebp).toHaveBeenCalledWith(inputBuffer);
	});

	it('given file still over threshold after conversion, when processFile called, then reduces dimensions', async () => {
		const config = loadConfig();
		config['image-transcoder'].transcoding.maxFileSizeBytes = 100;
		config['image-transcoder'].paths.output.dir = '/output';
		const transcoder = new ImageTranscoder(config, createMockLogger());

		const mockStat = vi.mocked(fs.stat);
		mockStat.mockResolvedValueOnce({ size: 1000, isDirectory: () => false } as Stats);
		mockStat.mockResolvedValueOnce({ size: 1000, isDirectory: () => false } as Stats);
		mockStat.mockResolvedValueOnce({ size: 80, isDirectory: () => false } as Stats);

		const mockReadFile = vi.mocked(fs.readFile);
		// Create a buffer larger than threshold to trigger dimension reduction
		const largeBuffer = Buffer.alloc(150);
		mockReadFile.mockResolvedValue(largeBuffer);

		const mockWriteFile = vi.mocked(fs.writeFile);
		mockWriteFile.mockResolvedValue();

		const smallBuffer = Buffer.alloc(80);
		const reduceDimensions = vi
			.spyOn(
				transcoder as unknown as { reduceDimensions: (buffer: Buffer) => Promise<Buffer> },
				'reduceDimensions'
			)
			.mockResolvedValue(smallBuffer);

		await transcoder.processFile('/input/test.webp');

		expect(reduceDimensions).toHaveBeenCalled();
	});

	it('given single file path, when process called, then calls processFile', async () => {
		const config = loadConfig();
		const transcoder = new ImageTranscoder(config, createMockLogger());

		const mockStat = vi.mocked(fs.stat);
		mockStat.mockResolvedValue({ size: 1000, isDirectory: () => false } as Stats);

		const mockResult = {
			inputPath: 'test-file.jpg',
			outputPath: 'test-file.jpg',
			originalSize: 1000,
			finalSize: 1000,
			iterations: 0,
			success: true,
		};
		const processFile = vi.spyOn(transcoder, 'processFile').mockResolvedValue(mockResult);

		const result = await transcoder.process('test-file.jpg');

		expect(processFile).toHaveBeenCalledWith('test-file.jpg');
		expect(processFile).toHaveBeenCalledTimes(1);
		expect(result.totalFiles).toBe(1);
	});

	it('given directory with image files, when process called, then returns BatchResult with counts', async () => {
		const config = loadConfig();
		config['image-transcoder'].transcoding.maxFileSizeBytes = 10000;

		const mockStat = vi.mocked(fs.stat);
		const mockReaddir = vi.mocked(fs.readdir);

		mockStat.mockReset();
		mockReaddir.mockReset();

		// First call to stat (for the directory check) returns isDirectory = true
		mockStat.mockResolvedValueOnce({
			size: 0,
			isDirectory: () => true,
			isFile: () => false,
		} as Stats);

		// Subsequent calls return file stats
		mockStat.mockResolvedValue({
			size: 5000,
			isDirectory: () => false,
			isFile: () => true,
		} as Stats);

		mockReaddir.mockResolvedValue(['test1.jpg', 'test2.png', 'readme.txt'] as unknown as Awaited<
			ReturnType<typeof fs.readdir>
		>);

		const transcoder = new ImageTranscoder(config, createMockLogger());
		const mockResult = {
			inputPath: '',
			outputPath: '',
			originalSize: 5000,
			finalSize: 5000,
			iterations: 0,
			success: true,
		};
		const processFile = vi.spyOn(transcoder, 'processFile').mockResolvedValue(mockResult);

		const result = await transcoder.process('test-dir');

		expect(processFile).toHaveBeenCalledWith('test-dir/test1.jpg');
		expect(processFile).toHaveBeenCalledWith('test-dir/test2.png');
		expect(processFile).not.toHaveBeenCalledWith(expect.stringContaining('readme.txt'));
		expect(processFile).toHaveBeenCalledTimes(2);
		expect(result).toMatchObject({
			totalFiles: 3,
			processed: 2,
			failed: 0,
			skipped: 1,
		});
	});
});
