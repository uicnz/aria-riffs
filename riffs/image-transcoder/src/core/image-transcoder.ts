import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Logger } from 'pino';
import sharp from 'sharp';
import type { ImageTranscoderConfig } from '../lib/schema.js';
import type { BatchResult, ProcessingResult } from '../lib/types.js';

export class ImageTranscoder {
	outputDir?: string;
	config: ImageTranscoderConfig;
	logger: Logger;

	constructor(config: ImageTranscoderConfig, logger: Logger) {
		this.config = config;
		this.outputDir = config['image-transcoder'].paths.output.dir ?? undefined;
		this.logger = logger;
	}

	async process(filepath: string): Promise<BatchResult> {
		const results: ProcessingResult[] = [];
		const stats = await fs.stat(filepath);

		// Handle single file case
		if (!stats.isDirectory()) {
			const result = await this.processFile(filepath);
			results.push(result);
			return {
				totalFiles: 1,
				processed: result.success ? 1 : 0,
				failed: result.success ? 0 : 1,
				skipped: 0,
				results,
			};
		}

		// Handle directory case - process all image files
		const files = await fs.readdir(filepath);
		const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.tiff', '.gif'];

		let skipped = 0;
		for (const file of files) {
			const fullPath = path.join(filepath, file);
			const ext = path.extname(file).toLowerCase();

			if (imageExtensions.includes(ext)) {
				const result = await this.processFile(fullPath);
				results.push(result);
			} else {
				skipped++;
			}
		}

		const processed = results.filter(r => r.success).length;
		const failed = results.filter(r => !r.success).length;

		return {
			totalFiles: results.length + skipped,
			processed,
			failed,
			skipped,
			results,
		};
	}

	async processFile(filepath: string): Promise<ProcessingResult> {
		this.logger.info({ filepath }, 'Processing file');

		try {
			const originalSize = await this.getFileSize(filepath);
			this.logger.debug({ filepath, size: originalSize }, 'File size determined');

			if (originalSize <= this.config['image-transcoder'].transcoding.maxFileSizeBytes) {
				return {
					inputPath: filepath,
					outputPath: filepath,
					originalSize,
					finalSize: originalSize,
					iterations: 0,
					success: true,
				};
			}

			const outputPath = this.getOutputPath(filepath, '.webp');
			const { finalSize, iterations } = await this.reduceFileSize(filepath, outputPath);

			this.logger.info(
				{ filepath, outputPath, originalSize, finalSize, iterations },
				'File transcoded successfully'
			);

			return {
				inputPath: filepath,
				outputPath,
				originalSize,
				finalSize,
				iterations,
				success: true,
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			this.logger.error({ filepath, error: errorMessage }, 'Failed to process file');
			return {
				inputPath: filepath,
				outputPath: filepath,
				originalSize: 0,
				finalSize: 0,
				iterations: 0,
				success: false,
				error: errorMessage,
			};
		}
	}

	private async getFileSize(filepath: string): Promise<number> {
		const stats = await fs.stat(filepath);
		return stats.size;
	}

	private async writeBufferToFile(buffer: Buffer, outputPath: string): Promise<void> {
		await fs.writeFile(outputPath, buffer);
	}

	private async isWebp(filepath: string): Promise<boolean> {
		return filepath.toLowerCase().endsWith('.webp');
	}

	private async convertToWebp(inputBuffer: Buffer): Promise<Buffer> {
		return await sharp(inputBuffer)
			.withMetadata()
			.webp({ quality: this.config['image-transcoder'].transcoding.quality })
			.toBuffer();
	}

	private getOutputPath(filepath: string, extension: string): string {
		const parsedPath = path.parse(filepath);
		const outputDir = this.outputDir ?? parsedPath.dir;
		const outputPath = path.join(outputDir, `${parsedPath.name}${extension}`);

		// Check if output would overwrite input
		if (filepath === outputPath) {
			throw new Error(`Output path would overwrite input file: ${filepath}`);
		}
		return outputPath;
	}

	private async reduceFileSize(
		filepath: string,
		outputPath: string
	): Promise<{ finalSize: number; iterations: number }> {
		const isWebp = await this.isWebp(filepath);

		// Load file into buffer, converting to WebP if needed
		let buffer = isWebp ? await fs.readFile(filepath) : await this.convertToWebp(await fs.readFile(filepath));

		// Iteratively reduce dimensions until under threshold (if needed)
		const maxIterations = 10;
		let iterations = 0;
		while (
			buffer.length > this.config['image-transcoder'].transcoding.maxFileSizeBytes &&
			iterations < maxIterations
		) {
			buffer = await this.reduceDimensions(buffer);
			iterations++;
		}

		await this.writeBufferToFile(buffer, outputPath);

		return { finalSize: buffer.length, iterations };
	}

	private async reduceDimensions(inputBuffer: Buffer): Promise<Buffer> {
		const metadata = await sharp(inputBuffer).metadata();
		const newWidth = Math.round((metadata.width || 0) * 0.9);
		const newHeight = Math.round((metadata.height || 0) * 0.9);

		const buffer = await sharp(inputBuffer)
			.resize(newWidth, newHeight, {
				kernel: 'lanczos3',
			})
			.withMetadata()
			.toBuffer();

		return buffer;
	}
}
