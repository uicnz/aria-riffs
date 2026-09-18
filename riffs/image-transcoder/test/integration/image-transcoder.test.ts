import { promises as fs } from 'node:fs';
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

describe('image-transcoder', () => {
	it('given existing file, when processFile called, then returns success result', async () => {
		const testFile = 'riffs/image-transcoder/images/test-image.jpg';
		const transcoder = new ImageTranscoder(loadConfig(), createMockLogger());

		const result = await transcoder.processFile(testFile);

		expect(result.success).toBe(true);
		expect(result.inputPath).toBe(testFile);
	});

	it('given file larger than threshold, when processFile called, then reduces file size', async () => {
		const config = loadConfig();
		const riffConfig = config['image-transcoder'];
		riffConfig.transcoding.maxFileSizeBytes = 1; // Set to 1 byte to trigger reduction
		const transcoder = new ImageTranscoder(config, createMockLogger());

		const inputFile = 'riffs/image-transcoder/images/test-image.jpg';
		const expectedOutput = 'riffs/image-transcoder/images/test-image.webp';

		await transcoder.processFile(inputFile);

		// Verify webp file was created (file reduction was triggered)
		const exists = await fs
			.access(expectedOutput)
			.then(() => true)
			.catch(() => false);
		expect(exists).toBe(true);

		// Cleanup
		await fs.unlink(expectedOutput).catch(() => {});
	});

	it('given webp file under threshold, when processFile called, then does not convert', async () => {
		// Create a small webp file first by converting test image
		const config = loadConfig();
		const riffConfig = config['image-transcoder'];
		riffConfig.transcoding.maxFileSizeBytes = 1;
		const setupTranscoder = new ImageTranscoder(config, createMockLogger());
		const inputFile = 'riffs/image-transcoder/images/test-image.jpg';
		const webpFile = 'riffs/image-transcoder/images/test-image.webp';

		await setupTranscoder.processFile(inputFile);

		// Now process the webp file with high threshold (so it doesn't trigger reduction)
		const testConfig = loadConfig();
		testConfig['image-transcoder'].transcoding.maxFileSizeBytes = 10 * 1024 * 1024; // 10MB - higher than test file
		const transcoder = new ImageTranscoder(testConfig, createMockLogger());

		const webpStatBefore = await fs.stat(webpFile);
		await transcoder.processFile(webpFile);
		const webpStatAfter = await fs.stat(webpFile);

		// File should be unchanged (no conversion happened)
		expect(webpStatAfter.size).toBe(webpStatBefore.size);

		// Cleanup
		await fs.unlink(webpFile).catch(() => {});
	});

	it('given outputDir set and file over threshold, when processFile called, then outputs to outputDir', async () => {
		const config = loadConfig();
		const riffConfig = config['image-transcoder'];
		riffConfig.transcoding.maxFileSizeBytes = 1; // 1 byte - trigger conversion
		riffConfig.paths.output.dir = 'riffs/image-transcoder/images';
		const transcoder = new ImageTranscoder(config, createMockLogger());

		const inputFile = 'riffs/image-transcoder/images/test-image.jpg';
		const expectedOutput = 'riffs/image-transcoder/images/test-image.webp';

		await transcoder.processFile(inputFile);

		// Verify file was created in outputDir
		const exists = await fs
			.access(expectedOutput)
			.then(() => true)
			.catch(() => false);
		expect(exists).toBe(true);

		// Cleanup
		await fs.unlink(expectedOutput).catch(() => {});
	});

	it('given config with quality 90, when processFile called, then creates webp with quality 90', async () => {
		const inputFile = 'riffs/image-transcoder/images/test-image.jpg';
		const outputHigh = 'riffs/image-transcoder/images/test-image-high.webp';
		const outputDefault = 'riffs/image-transcoder/images/test-image.webp';

		// Process with quality 90 - use threshold high enough that both quality settings fit without dimension reduction
		const configHigh = loadConfig();
		const riffConfigHigh = configHigh['image-transcoder'];
		riffConfigHigh.transcoding.maxFileSizeBytes = 160 * 1024; // 160KB - triggers conversion, both qualities fit under threshold
		riffConfigHigh.transcoding.quality = 90;
		const transcoderHigh = new ImageTranscoder(configHigh, createMockLogger());

		await transcoderHigh.processFile(inputFile);
		const statsHigh = await fs.stat(outputDefault);
		await fs.rename(outputDefault, outputHigh);

		// Process with quality 85 (default)
		const configDefault = loadConfig();
		const riffConfigDefault = configDefault['image-transcoder'];
		riffConfigDefault.transcoding.maxFileSizeBytes = 160 * 1024; // 160KB - triggers conversion, both qualities fit under threshold
		riffConfigDefault.transcoding.quality = 85;
		const transcoderDefault = new ImageTranscoder(configDefault, createMockLogger());

		await transcoderDefault.processFile(inputFile);
		const statsDefault = await fs.stat(outputDefault);

		// Higher quality should produce larger file
		expect(statsHigh.size).toBeGreaterThan(statsDefault.size);

		// Cleanup
		await fs.unlink(outputHigh).catch(() => {});
		await fs.unlink(outputDefault).catch(() => {});
	});

	it('given jpeg file converted to webp under threshold, when processFile called, then creates webp under threshold', async () => {
		const config = loadConfig();
		// Set threshold between input size (167588) and converted webp size (~120KB)
		const riffConfig = config['image-transcoder'];
		riffConfig.transcoding.maxFileSizeBytes = 150 * 1024; // 150KB - triggers conversion, webp fits under
		const transcoder = new ImageTranscoder(config, createMockLogger());

		const inputFile = 'riffs/image-transcoder/images/test-image.jpg';
		const expectedOutput = 'riffs/image-transcoder/images/test-image.webp';

		await transcoder.processFile(inputFile);

		// Verify output file was created and is under threshold
		const stats = await fs.stat(expectedOutput);
		expect(stats.size).toBeLessThanOrEqual(riffConfig.transcoding.maxFileSizeBytes);

		// Cleanup
		await fs.unlink(expectedOutput).catch(() => {});
	});

	it('given file requiring multiple dimension reductions, when processFile called, then iteratively reduces until under threshold', async () => {
		const config = loadConfig();
		const riffConfig = config['image-transcoder'];
		riffConfig.transcoding.maxFileSizeBytes = 80 * 1024; // 80KB - requires multiple iterations but achievable
		const transcoder = new ImageTranscoder(config, createMockLogger());

		const inputFile = 'riffs/image-transcoder/images/test-image.jpg';
		const expectedOutput = 'riffs/image-transcoder/images/test-image.webp';

		await transcoder.processFile(inputFile);

		// Verify output file exists
		const exists = await fs
			.access(expectedOutput)
			.then(() => true)
			.catch(() => false);
		expect(exists).toBe(true);

		// Verify final file is under threshold (dimension reduction was triggered)
		const finalStats = await fs.stat(expectedOutput);
		expect(finalStats.size).toBeLessThanOrEqual(riffConfig.transcoding.maxFileSizeBytes);

		// Cleanup
		await fs.unlink(expectedOutput).catch(() => {});
	});

	it('given directory path, when process called, then returns BatchResult for all images', async () => {
		const config = loadConfig();
		config['image-transcoder'].transcoding.maxFileSizeBytes = 10 * 1024 * 1024; // High threshold - no reduction
		const transcoder = new ImageTranscoder(config, createMockLogger());
		const dirPath = 'riffs/image-transcoder/images';

		const result = await transcoder.process(dirPath);

		expect(result.totalFiles).toBeGreaterThan(0);
		expect(result.failed).toBe(0);
		expect(result.results.length).toBeGreaterThan(0);
	});

	it('given image with EXIF metadata, when processFile called, then preserves metadata in output', async () => {
		const inputFile = 'riffs/image-transcoder/images/test-metadata.jpg';
		const outputFile = 'riffs/image-transcoder/images/test-metadata.webp';

		// Create test image with EXIF metadata
		const testMetadata = {
			exif: {
				IFD0: {
					Copyright: 'Test Copyright 2025',
					Artist: 'Test Artist',
				},
			},
		};

		await sharp({
			create: {
				width: 800,
				height: 600,
				channels: 3,
				background: { r: 100, g: 150, b: 200 },
			},
		})
			.jpeg()
			.withMetadata(testMetadata)
			.toFile(inputFile);

		// Verify metadata was written to input file
		const inputMetadata = await sharp(inputFile).metadata();
		expect(inputMetadata.exif).toBeDefined();

		// Process the file (set threshold to trigger conversion)
		const config = loadConfig();
		config['image-transcoder'].transcoding.maxFileSizeBytes = 1; // Force conversion
		const transcoder = new ImageTranscoder(config, createMockLogger());

		await transcoder.processFile(inputFile);

		// Verify output file exists
		const exists = await fs
			.access(outputFile)
			.then(() => true)
			.catch(() => false);
		expect(exists).toBe(true);

		// Check if metadata is preserved in output
		const outputMetadata = await sharp(outputFile).metadata();
		expect(outputMetadata.exif).toBeDefined();

		// Cleanup
		await fs.unlink(inputFile).catch(() => {});
		await fs.unlink(outputFile).catch(() => {});
	});
});
