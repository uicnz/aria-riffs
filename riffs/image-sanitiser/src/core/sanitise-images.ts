/**
 * Main image sanitization logic
 */

import * as path from 'node:path';
import cliProgress from 'cli-progress';
import * as fsExtra from 'fs-extra';
import type { Logger } from 'pino';
import type { ImageSanitiserConfig } from '../lib/schema.js';
import { type FileAnalysis, ImageSanitiserError, type ProcessingResults } from '../lib/types.js';
import { ConsoleLogger } from '../utils/console-logger.js';
import {
	findImageFiles,
	getUniqueFilename,
	safeFileMove,
	sanitizeFilename,
	validateImageFile,
} from '../utils/utils.js';
import { ImageFormatDetector } from './detect-format.js';

export class ImageSanitiser {
	private logger: Logger;
	private config: ImageSanitiserConfig;
	private consoleLogger: ConsoleLogger;
	private detector: ImageFormatDetector;
	private databaseManager?: {
		saveDescription: (filePath: string, description: string) => Promise<void>;
		updateFilePath: (oldPath: string, newPath: string) => Promise<void>;
		close: () => void;
	};

	constructor(
		logger: Logger,
		config: ImageSanitiserConfig,
		detector?: ImageFormatDetector,
		databaseManager?: {
			saveDescription: (filePath: string, description: string) => Promise<void>;
			updateFilePath: (oldPath: string, newPath: string) => Promise<void>;
			close: () => void;
		}
	) {
		this.logger = logger;
		this.config = config;
		this.consoleLogger = new ConsoleLogger();
		this.detector = detector || new ImageFormatDetector(config, logger);
		this.databaseManager = databaseManager;
	}

	async analyzeSingleFile(filePath: string): Promise<FileAnalysis> {
		try {
			await validateImageFile(filePath, this.config);

			const detectionResult = await this.detector.detectImageFormat(filePath);
			const analysis: FileAnalysis = {
				filePath,
				originalExtension: detectionResult.originalExtension,
				detectionResult,
			};

			if (detectionResult.needsRename) {
				// Use the actual file extension (not normalized) for proper basename stripping
				const actualOriginalExtension = path.extname(filePath);
				const baseName = sanitizeFilename(path.basename(filePath, actualOriginalExtension));
				const newPath = await getUniqueFilename(filePath, baseName, detectionResult.detectedExtension);
				analysis.proposedNewPath = newPath;
			}

			return analysis;
		} catch (error) {
			return {
				filePath,
				originalExtension: path.extname(filePath),
				detectionResult: {
					detectedExtension: path.extname(filePath),
					detectedMimeType: '',
					confidence: 'low',
					method: 'fallback',
					originalExtension: path.extname(filePath),
					needsRename: false,
				},
				error: error instanceof Error ? error.message : String(error),
			};
		}
	}

	async sanitizeSingleFile(filePath: string, dryRun: boolean = false): Promise<boolean> {
		this.logger.debug({ filePath, dryRun }, 'Processing file');

		try {
			const analysis = await this.analyzeSingleFile(filePath);

			if (analysis.error) {
				this.logger.error({ filePath, error: analysis.error }, 'Analysis error');
				this.consoleLogger.error(`Error analyzing ${path.basename(filePath)}: ${analysis.error}`);
				return false;
			}

			const { detectionResult, proposedNewPath } = analysis;

			if (!detectionResult.needsRename) {
				this.logger.debug(
					{ filePath, extension: detectionResult.detectedExtension },
					'File OK, no rename needed'
				);
				this.consoleLogger.log(
					`OK: ${path.basename(filePath)} (${detectionResult.detectedExtension.toUpperCase()})`
				);
				return true;
			}

			if (!proposedNewPath) {
				this.logger.warn({ filePath }, 'Could not generate new path');
				this.consoleLogger.log(`Skipped: ${path.basename(filePath)} - could not generate new path`);
				return false;
			}

			if (dryRun) {
				this.logger.info(
					{ filePath, proposedNewPath, method: detectionResult.method },
					'Dry run - would rename'
				);
				this.consoleLogger.log(
					`DRY RUN: ${path.basename(filePath)} -> ${path.basename(proposedNewPath)} (${detectionResult.method}, ${detectionResult.confidence} confidence)`
				);
				return true;
			}

			// Save to database before rename so updateFilePath has a record to update
			if (this.databaseManager) {
				try {
					const description = `Detected: ${detectionResult.detectedMimeType} (${detectionResult.method}, ${detectionResult.confidence})`;
					await this.databaseManager.saveDescription(filePath, description);
					this.logger.debug({ filePath, description }, 'Saved detection info to database');
				} catch (dbError) {
					this.logger.warn({ filePath, error: dbError }, 'Failed to save to database');
				}
			}

			await safeFileMove(filePath, proposedNewPath, this.config);
			this.logger.info({ filePath, newPath: proposedNewPath, method: detectionResult.method }, 'File renamed');

			// Update database with new file path
			if (this.databaseManager) {
				try {
					await this.databaseManager.updateFilePath(filePath, proposedNewPath);
					this.logger.debug({ filePath, newPath: proposedNewPath }, 'Database path updated');
				} catch (dbError) {
					// Log but don't fail the rename operation
					this.logger.warn({ filePath, error: dbError }, 'Failed to update database path');
					this.consoleLogger.warn(`Warning: Failed to update database for ${path.basename(filePath)}`);
				}
			}

			// Verify after rename if configured
			if (this.config['image-sanitiser'].images.verifyAfterRename) {
				const verificationResult = await this.detector.detectImageFormat(proposedNewPath);
				if (verificationResult.detectedExtension !== detectionResult.detectedExtension) {
					this.logger.warn(
						{
							filePath: proposedNewPath,
							expected: detectionResult.detectedExtension,
							actual: verificationResult.detectedExtension,
						},
						'Verification mismatch'
					);
					this.consoleLogger.warn(`Warning: Verification mismatch for ${path.basename(proposedNewPath)}`);
				}
			}

			this.consoleLogger.log(
				`Fixed: ${path.basename(filePath)} -> ${path.basename(proposedNewPath)} (${detectionResult.method}, ${detectionResult.confidence} confidence)`
			);
			return true;
		} catch (error) {
			this.logger.error({ filePath, error }, 'Processing failed');
			this.consoleLogger.error(
				`Error: ${path.basename(filePath)}: ${error instanceof Error ? error.message : error}`
			);
			return false;
		}
	}

	async sanitizeDirectory(
		directoryPath: string,
		options: {
			recursive?: boolean;
			dryRun?: boolean;
			showProgress?: boolean;
		} = {}
	): Promise<ProcessingResults> {
		this.logger.info({ directoryPath, options }, 'Starting directory processing');
		const startTime = Date.now();
		const results: ProcessingResults = {
			total_files: 0,
			processed: 0,
			failed: 0,
			skipped: 0,
			fixed: 0,
			processing_time: 0,
			errors: [],
		};

		try {
			const resolvedPath = path.resolve(directoryPath);
			if (!(await fsExtra.pathExists(resolvedPath))) {
				throw new ImageSanitiserError(`Directory not found: ${directoryPath}`);
			}

			const imageFiles = await findImageFiles(resolvedPath, this.config, options.recursive);
			results.total_files = imageFiles.length;
			this.logger.info({ totalFiles: results.total_files }, 'Found image files');

			if (results.total_files === 0) {
				this.logger.info('No image files found');
				this.consoleLogger.log('No image files found');
				return results;
			}

			const action = options.dryRun ? 'Analyzing' : 'Sanitizing';
			this.consoleLogger.log(`${action} ${results.total_files} image files...\n`);

			let progressBar: cliProgress.SingleBar | null = null;
			if (options.showProgress !== false && this.config['image-sanitiser'].processing.progressBar) {
				progressBar = new cliProgress.SingleBar({
					format: `${action} |{bar}| {percentage}% | {value}/{total} Files`,
					barCompleteChar: '\u2588',
					barIncompleteChar: '\u2591',
				});
				progressBar.start(results.total_files, 0);
				this.consoleLogger.setProgressBar(progressBar, results.total_files);
			}

			for (let i = 0; i < imageFiles.length; i++) {
				const filePath = imageFiles[i];
				this.consoleLogger.setProgress(i + 1);

				try {
					const success = await this.sanitizeSingleFile(filePath, options.dryRun);
					if (success) {
						results.processed++;

						// Check if file was actually renamed (not just analyzed)
						const analysis = await this.analyzeSingleFile(filePath);
						if (!options.dryRun && analysis.detectionResult.needsRename && !analysis.error) {
							results.fixed++;
						}
					} else {
						results.skipped++;
					}
				} catch (error) {
					results.failed++;
					const errorMsg = error instanceof Error ? error.message : String(error);
					results.errors.push(`${path.basename(filePath)}: ${errorMsg}`);
					this.logger.error({ filePath, error: errorMsg }, 'File processing failed');
				}

				if (progressBar) {
					progressBar.update(i + 1);
				}
			}

			if (progressBar) {
				progressBar.stop();
				this.consoleLogger.setProgressBar(null);
			}

			this.logger.info(
				{
					processed: results.processed,
					failed: results.failed,
					skipped: results.skipped,
					fixed: results.fixed,
				},
				'Directory processing complete'
			);
		} catch (error) {
			this.logger.error({ directoryPath, error }, 'Directory processing failed');
			throw new ImageSanitiserError(`Directory processing failed: ${error}`);
		} finally {
			results.processing_time = (Date.now() - startTime) / 1000;
		}

		return results;
	}

	async cleanup(): Promise<void> {
		await this.detector.cleanup();
	}
}
