/**
 * Main OCR processing functionality
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import cliProgress from 'cli-progress';
import * as fsExtra from 'fs-extra';
import type { Logger } from 'pino';
// @ts-expect-error - scribe.js-ocr doesn't have types
import scribe from 'scribe.js-ocr';
import type { ImageOcrRiffConfig } from '../lib/schema.js';
import {
	type FileResult,
	ImageOcrError,
	OcrProcessingError,
	type OcrResult,
	type ProcessingResults,
} from '../lib/types.js';
import { findFiles, generateOutputPath, sleep, validateFile } from '../utils/utils.js';

/**
 * Progress-aware logger that coordinates output with cli-progress bars.
 * Pauses the progress bar before writing, then resumes it after.
 */
export class ProgressLogger {
	private progressBar: cliProgress.SingleBar | null = null;
	private currentProgress = 0;
	private totalItems = 0;
	private logger: Logger;

	constructor(logger: Logger) {
		this.logger = logger;
	}

	/**
	 * Set the progress bar to coordinate with
	 */
	setProgressBar(bar: cliProgress.SingleBar | null, total = 0): void {
		this.progressBar = bar;
		this.totalItems = total;
	}

	/**
	 * Update the current progress value
	 */
	setProgress(current: number): void {
		this.currentProgress = current;
	}

	/**
	 * Log a debug message, pausing progress bar if active
	 */
	debug(context: Record<string, unknown>, message: string): void {
		if (this.progressBar) {
			this.progressBar.stop();
			this.logger.debug(context, message);
			this.progressBar.start(this.totalItems, this.currentProgress);
		} else {
			this.logger.debug(context, message);
		}
	}

	/**
	 * Log an info message, pausing progress bar if active
	 */
	info(context: Record<string, unknown>, message: string): void {
		if (this.progressBar) {
			this.progressBar.stop();
			this.logger.info(context, message);
			this.progressBar.start(this.totalItems, this.currentProgress);
		} else {
			this.logger.info(context, message);
		}
	}

	/**
	 * Log an error message, pausing progress bar if active
	 */
	error(context: Record<string, unknown>, message: string): void {
		if (this.progressBar) {
			this.progressBar.stop();
			this.logger.error(context, message);
			this.progressBar.start(this.totalItems, this.currentProgress);
		} else {
			this.logger.error(context, message);
		}
	}

	/**
	 * Log a warning message, pausing progress bar if active
	 */
	warn(context: Record<string, unknown>, message: string): void {
		if (this.progressBar) {
			this.progressBar.stop();
			this.logger.warn(context, message);
			this.progressBar.start(this.totalItems, this.currentProgress);
		} else {
			this.logger.warn(context, message);
		}
	}
}

export class ImageOcr {
	private ocrSemaphore: Promise<void> = Promise.resolve();
	private logger: Logger;
	private progressLogger: ProgressLogger;
	private config: ImageOcrRiffConfig;

	constructor(logger: Logger, config: ImageOcrRiffConfig) {
		this.logger = logger;
		this.config = config;
		this.progressLogger = new ProgressLogger(logger);
	}

	async processSingleFile(filePath: string, force?: boolean): Promise<FileResult> {
		const result: FileResult = {
			inputPath: filePath,
			outputPath: generateOutputPath(filePath, this.config),
			extractedText: '',
			success: false,
		};

		this.logger.debug({ filePath }, 'Processing file');

		try {
			await validateFile(filePath, this.config);

			// Check if output file already exists and decide whether to skip
			if (!force && (await fsExtra.pathExists(result.outputPath))) {
				const inputStats = await fs.promises.stat(filePath);
				const outputStats = await fs.promises.stat(result.outputPath);

				if (outputStats.mtime > inputStats.mtime) {
					this.progressLogger.debug(
						{ filePath, outputPath: result.outputPath },
						`Skipping (output newer): ${path.basename(filePath)}`
					);
					result.success = true;
					return result;
				}
			}

			// Perform OCR using scribe.js
			const ocrResult = await this.performOcr(filePath);
			result.extractedText = ocrResult.text;

			await fsExtra.ensureDir(path.dirname(result.outputPath));
			await fs.promises.writeFile(result.outputPath, ocrResult.text, 'utf8');

			result.success = true;
			this.progressLogger.info(
				{ filePath, outputPath: result.outputPath, textLength: ocrResult.text.length },
				`${path.basename(filePath)} -> ${path.basename(result.outputPath)}`
			);

			return result;
		} catch (error) {
			result.error = error instanceof Error ? error.message : String(error);
			this.progressLogger.error({ filePath, error: result.error }, `${path.basename(filePath)}: ${result.error}`);
			return result;
		}
	}

	private async performOcr(filePath: string): Promise<OcrResult> {
		// Use semaphore to ensure OCR operations don't interfere with each other
		const previousOperation = this.ocrSemaphore;
		let resolveCurrentOperation: (() => void) | undefined;
		this.ocrSemaphore = new Promise<void>(resolve => {
			resolveCurrentOperation = resolve;
		});

		const timeout = this.config.ocr.timeout * 1000;

		try {
			// Wait for previous OCR operation to complete
			await previousOperation;

			// Create a timeout promise with proper cleanup
			let timeoutId: NodeJS.Timeout | undefined;
			const timeoutPromise = new Promise<never>((_, reject) => {
				timeoutId = setTimeout(() => reject(new Error('OCR timeout')), timeout);
			});

			// Perform OCR with timeout (now safely sequential)
			// Force scribe.js runtime data writes into Aria home storage, not caller CWD.
			scribe.opt.reflow = false; // Safe to set globally now that operations are sequential
			const ocrPromise = this.extractTextWithDedicatedDatabaseDir(filePath);

			try {
				const text = await Promise.race([ocrPromise, timeoutPromise]);
				// Clear timeout if OCR completed first
				if (timeoutId) clearTimeout(timeoutId);

				if (typeof text !== 'string') {
					throw new OcrProcessingError('Invalid OCR result format');
				}

				return {
					text: text.trim(),
					confidence: 1.0,
				};
			} catch (error) {
				// Always clear timeout on any error
				if (timeoutId) clearTimeout(timeoutId);
				throw error;
			}
		} catch (error) {
			if (error instanceof Error && error.message === 'OCR timeout') {
				throw new OcrProcessingError(`OCR processing timeout after ${timeout / 1000} seconds`);
			}
			throw new OcrProcessingError(`OCR processing failed: ${error}`);
		} finally {
			// Always resolve the semaphore to allow next operation
			if (resolveCurrentOperation) {
				resolveCurrentOperation();
			}
		}
	}

	private async extractTextWithDedicatedDatabaseDir(filePath: string): Promise<unknown> {
		const resolvedFilePath = path.resolve(filePath);
		const databaseDir = path.resolve(this.config.paths.database.dir);
		const previousCwd = process.cwd();
		let changedCwd = false;

		try {
			await fsExtra.ensureDir(databaseDir);
			process.chdir(databaseDir);
			changedCwd = true;
		} catch (error) {
			this.logger.warn(
				{ databaseDir, error: error instanceof Error ? error.message : String(error) },
				'Failed to switch OCR database working directory; falling back to current working directory'
			);
		}

		try {
			return await scribe.extractText([resolvedFilePath]);
		} finally {
			if (changedCwd) {
				process.chdir(previousCwd);
			}
		}
	}

	async processDirectory(
		directoryPath: string,
		options: {
			recursive?: boolean;
			showProgress?: boolean;
			force?: boolean;
		} = {}
	): Promise<ProcessingResults> {
		const startTime = Date.now();
		const results: ProcessingResults = {
			total_files: 0,
			processed: 0,
			failed: 0,
			skipped: 0,
			processing_time: 0,
			errors: [],
		};

		this.logger.info({ directoryPath, options }, 'Starting directory processing');

		try {
			const resolvedPath = path.resolve(directoryPath);
			if (!(await fsExtra.pathExists(resolvedPath))) {
				throw new ImageOcrError(`Directory not found: ${directoryPath}`);
			}

			const stats = await fs.promises.stat(resolvedPath);
			if (!stats.isDirectory()) {
				throw new ImageOcrError(`Path is not a directory: ${directoryPath}`);
			}

			const files = await findFiles(resolvedPath, this.config, options.recursive);
			results.total_files = files.length;

			this.logger.debug({ fileCount: files.length, recursive: options.recursive }, 'Files discovered');

			if (results.total_files === 0) {
				this.logger.warn({ directoryPath }, 'No supported files found in directory');
				return results;
			}

			this.logger.info({ totalFiles: results.total_files }, `Processing ${results.total_files} files`);

			let progressBar: cliProgress.SingleBar | null = null;
			if (options.showProgress !== false && this.config.processing.progressBar) {
				progressBar = new cliProgress.SingleBar({
					format: 'Processing |{bar}| {percentage}% | {value}/{total} Files',
					barCompleteChar: '\u2588',
					barIncompleteChar: '\u2591',
				});
				progressBar.start(results.total_files, 0);
			}

			// Configure progress logger to coordinate with progress bar
			this.progressLogger.setProgressBar(progressBar, results.total_files);

			const concurrentJobs = this.config.processing.concurrentJobs;
			const batches = [];

			for (let i = 0; i < files.length; i += concurrentJobs) {
				batches.push(files.slice(i, i + concurrentJobs));
			}

			for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
				const batch = batches[batchIndex];
				const batchPromises = batch.map(async (filePath, fileIndex) => {
					const globalIndex = batchIndex * concurrentJobs + fileIndex;

					// Update progress logger progress before processing
					this.progressLogger.setProgress(globalIndex + 1);

					const result = await this.processSingleFile(filePath, options.force);

					if (result.success) {
						if (result.extractedText) {
							results.processed++;
						} else {
							results.skipped++;
						}
					} else {
						results.failed++;
						if (result.error) {
							results.errors.push(`${path.basename(filePath)}: ${result.error}`);
						}
					}

					if (progressBar) {
						progressBar.update(globalIndex + 1);
					}
				});

				await Promise.all(batchPromises);

				// Add small delay between batches to prevent overwhelming the system
				if (batchIndex < batches.length - 1) {
					await sleep(0.1);
				}
			}

			if (progressBar) {
				progressBar.stop();
			}

			// Clear progress bar reference
			this.progressLogger.setProgressBar(null);

			this.logger.info(
				{
					processed: results.processed,
					failed: results.failed,
					skipped: results.skipped,
					processingTime: results.processing_time,
				},
				'Directory processing completed'
			);
		} catch (error) {
			this.logger.error({ directoryPath, error: String(error) }, 'Directory processing failed');
			throw new ImageOcrError(`Directory processing failed: ${error}`);
		} finally {
			results.processing_time = (Date.now() - startTime) / 1000;
		}

		return results;
	}
}
