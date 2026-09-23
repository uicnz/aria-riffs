/**
 * Main image processing logic for metadata embedding
 * Contains: ImageMetadata, ImageDescription, validateImageFile function, and utility functions
 */

import { constants as fsConstants } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import cliProgress from 'cli-progress';
import fsExtra from 'fs-extra';
import type { Logger } from 'pino';
import sharp from 'sharp';
import type { DatabaseManager } from '../db/database.js';
import { loadConfig } from '../lib/config.js';
import {
	type DescriptionResult,
	FilePermissionError,
	ImageProcessorError,
	type LLMClient,
	MetadataWriteError,
	type ProcessingResults,
	UnsupportedImageFormat,
} from '../lib/types.js';
import type { ProgressLogger } from '../utils/progress-logger.js';
import { findImageFiles } from '../utils/utils.js';
import { MetadataWriter } from './write-metadata.js';

// Load config once at module level
const appConfig = loadConfig();
const riff = appConfig['image-metadata'];

/**
 * Handles description generation and database persistence
 */
export class ImageDescription {
	private llmClient: LLMClient;
	private dbManager: DatabaseManager;
	private force: boolean;

	constructor(llmClient: LLMClient, dbManager: DatabaseManager, force: boolean = false) {
		this.llmClient = llmClient;
		this.dbManager = dbManager;
		this.force = force;
	}

	async process(filePath: string): Promise<DescriptionResult> {
		const existing = await this.dbManager.getDescription(filePath);

		if (existing && !this.force) {
			return { description: existing, source: 'cached' };
		}

		const description = await this.llmClient.generateDescription(filePath);
		await this.dbManager.saveDescription(filePath, description);

		return { description, source: 'generated' };
	}
}

/**
 * Verifies that a file exists and is a valid image file.
 */
export async function validateImageFile(filePath: string): Promise<void> {
	if (!(await fsExtra.pathExists(filePath))) {
		throw new ImageProcessorError(`File not found: ${filePath}`);
	}
	const stats = await fs.stat(filePath);
	if (!stats.isFile()) {
		throw new ImageProcessorError(`Path is not a file: ${filePath}`);
	}

	// Validate content and format
	try {
		await fs.access(filePath, fsConstants.R_OK);

		const fileStats = await fs.stat(filePath);
		const maxSizeMB = riff.images.maxFileSizeMb;
		const maxSizeBytes = maxSizeMB * 1024 * 1024;

		if (fileStats.size > maxSizeBytes) {
			const actualSizeMB = Math.round(fileStats.size / 1024 / 1024);
			throw new UnsupportedImageFormat(`Image file too large: ${actualSizeMB}MB > ${maxSizeMB}MB`);
		}

		const metadata = await sharp(filePath).metadata();
		if (!metadata.format) {
			throw new UnsupportedImageFormat(`Invalid or corrupted image file: ${filePath}`);
		}
	} catch (error: unknown) {
		if (error instanceof UnsupportedImageFormat) {
			throw error;
		}
		if (error && typeof error === 'object' && 'code' in error && error.code === 'EACCES') {
			throw new FilePermissionError(`Permission denied accessing file: ${filePath}`);
		}
		if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
			throw new FilePermissionError(`File not found: ${filePath}`);
		}
		throw new UnsupportedImageFormat(`Failed to validate image: ${error}`);
	}
}

/**
 * Sanitizes a filename by removing invalid characters and limiting length
 */
export function sanitizeFilename(filename: string): string {
	// biome-ignore lint/suspicious/noControlCharactersInRegex: intentionally matching control characters for invalid filesystem names
	const invalidChars = /[<>:"/\\|?*\x00-\x1F]/g;
	let sanitized = filename.replace(invalidChars, '_');
	sanitized = sanitized.replace(/\s+/g, ' ').trim();

	if (!sanitized) {
		sanitized = 'unnamed';
	}

	const maxLength = 200;
	if (sanitized.length > maxLength) {
		sanitized = sanitized.substring(0, maxLength);
	}

	return sanitized;
}

/**
 * Ensures a file path is unique by appending a counter if the file exists
 */
export async function ensureUniqueFilename(filePath: string): Promise<string> {
	const dir = path.dirname(filePath);
	const ext = path.extname(filePath);
	const basename = path.basename(filePath, ext);

	let finalPath = filePath;
	let counter = 1;
	while (await fsExtra.pathExists(finalPath)) {
		finalPath = path.join(dir, `${basename}-${counter}${ext}`);
		counter++;
	}
	return finalPath;
}

/**
 * Sanitizes filenames in a directory (remove punctuation and control characters)
 */
// The helper/utility function sanitizeFilename should be moved into this module,
// because this is the only place it's used currently.
export async function sanitizeDirectory(directoryPath: string, logger: ProgressLogger): Promise<number> {
	let renamedCount = 0;
	try {
		const imageFiles = await findImageFiles(directoryPath, false);
		for (const filePath of imageFiles) {
			const dir = path.dirname(filePath);
			const ext = path.extname(filePath);
			const basename = path.basename(filePath, ext);
			const sanitized = sanitizeFilename(basename);
			if (sanitized !== basename) {
				const newPath = path.join(dir, sanitized + ext);
				const finalPath = await ensureUniqueFilename(newPath);
				await fsExtra.move(filePath, finalPath);
				logger.log(`Renamed: ${path.basename(filePath)} -> ${path.basename(finalPath)}`);
				renamedCount++;
			}
		}
	} catch (error) {
		throw new ImageProcessorError(`Failed to sanitize filenames: ${error}`);
	}
	return renamedCount;
}

/**
 * Main orchestrator for image processing.
 * for a single file, generate a description from an AI, write it to a database, and write metadata to the image.
 * for a directory, process all images within it. Optionally sanitize filenames first (remove punctuation/control chars).
 */
export class ImageMetadata {
	private llmClient: LLMClient;
	private dbManager: DatabaseManager;
	private progressLogger: ProgressLogger;
	private logger: Logger;

	constructor(llmClient: LLMClient, dbManager: DatabaseManager, progressLogger: ProgressLogger, logger: Logger) {
		this.llmClient = llmClient;
		this.dbManager = dbManager;
		this.progressLogger = progressLogger;
		this.logger = logger;
	}

	async processSingleFile(
		filePath: string,
		options: {
			force?: boolean;
		} = {}
	): Promise<ProcessingResults> {
		const startTime = Date.now();
		const results: ProcessingResults = {
			total_files: 1,
			processed: 0,
			failed: 0,
			renamed: 0,
			processing_time: 0,
			errors: [],
		};

		try {
			const resolvedPath = path.resolve(filePath);
			this.logger.info({ filePath: resolvedPath }, 'Processing file');
			this.progressLogger.log(`Processing: ${path.basename(filePath)}`);
			await validateImageFile(resolvedPath);
			const imageDescription = new ImageDescription(this.llmClient, this.dbManager, options.force);
			// Generate/retrieve description. If generated (from AI) then save to database.
			const result = await imageDescription.process(resolvedPath);
			this.logger.debug({ filePath: resolvedPath, source: result.source }, 'Description result');

			if (result.source === 'cached') {
				this.logger.debug({ filePath: resolvedPath }, 'Skipping cached file');
				this.progressLogger.log(`Skipping ${path.basename(resolvedPath)} - already processed`);
			} else if (result.description) {
				// Write metadata to file
				const metadataWriter = new MetadataWriter(resolvedPath, result.description, this.logger);
				await metadataWriter.writeDescription();
				this.logger.info({ filePath: resolvedPath }, 'Metadata written successfully');

				this.progressLogger.log(
					`${path.basename(resolvedPath)}\n  Description: ${result.description.substring(0, 100)}...`
				);

				results.processed = 1;
			}
		} catch (error) {
			if (error instanceof MetadataWriteError) {
				this.logger.warn({ filePath, error: error.message }, 'Could not write metadata');
				this.progressLogger.warn(`Warning: Could not write metadata: ${error.message}`);
			} else {
				results.failed = 1;
				const errorMsg = error instanceof Error ? error.message : String(error);
				this.logger.error({ filePath, error: errorMsg }, 'Processing failed');
				results.errors.push(`${path.basename(filePath)}: ${errorMsg}`);
			}
		} finally {
			results.processing_time = (Date.now() - startTime) / 1000;
		}

		return results;
	}

	async processDirectory(
		directoryPath: string,
		options: { sanitizeNames?: boolean; showProgress?: boolean; force?: boolean } = {}
	): Promise<ProcessingResults> {
		const startTime = Date.now();
		const results: ProcessingResults = {
			total_files: 0,
			processed: 0,
			failed: 0,
			renamed: 0,
			processing_time: 0,
			errors: [],
		};

		try {
			const resolvedPath = path.resolve(directoryPath);
			this.logger.info({ directoryPath: resolvedPath }, 'Processing directory');
			if (!(await fsExtra.pathExists(resolvedPath))) {
				throw new ImageProcessorError(`Directory not found: ${directoryPath}`);
			}

			if (options.sanitizeNames !== false) {
				this.progressLogger.log('Sanitizing filenames...');
				results.renamed = await sanitizeDirectory(resolvedPath, this.progressLogger);
				this.logger.debug({ renamed: results.renamed }, 'Filenames sanitized');
			}

			const imageFiles = await findImageFiles(resolvedPath, false);
			results.total_files = imageFiles.length;
			this.logger.info({ fileCount: results.total_files }, 'Found image files');

			if (results.total_files === 0) {
				this.logger.warn({ directoryPath: resolvedPath }, 'No supported image files found');
				this.progressLogger.log('No supported image files found');
				return results;
			}

			let progressBar: cliProgress.SingleBar | null = null;
			if (options.showProgress !== false && riff.processing.progressBar) {
				progressBar = new cliProgress.SingleBar({
					format: 'Processing |{bar}| {percentage}% | {value}/{total} Files',
					barCompleteChar: '\u2588',
					barIncompleteChar: '\u2591',
				});
				progressBar.start(results.total_files, 0);
			}

			for (let i = 0; i < imageFiles.length; i++) {
				const filePath = imageFiles[i];
				if (!filePath) continue;
				// Manage progress bar before processing
				this.progressLogger.setProgressBar(progressBar);
				const fileResult = await this.processSingleFile(filePath, {
					force: options.force ?? false,
				});
				// Accumulate results from each file
				results.processed += fileResult.processed;
				results.failed += fileResult.failed;
				results.errors.push(...fileResult.errors);
				if (progressBar) {
					progressBar.update(i + 1);
				}
			}

			if (progressBar) {
				progressBar.stop();
			}

			this.logger.info(
				{
					processed: results.processed,
					failed: results.failed,
					renamed: results.renamed,
					processingTime: results.processing_time,
				},
				'Directory processing complete'
			);
		} finally {
			results.processing_time = (Date.now() - startTime) / 1000;
		}

		return results;
	}
}
