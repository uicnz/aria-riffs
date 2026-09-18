/**
 * Main image renaming functionality
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import cliProgress from 'cli-progress';
import * as fsExtra from 'fs-extra';
import type { Logger } from 'pino';
import type { ImageRenamerConfig } from '../lib/schema.js';
import {
	FileOperationError,
	ImageRenameError,
	type LLMClient,
	LlmConnectionError,
	type ProcessingResults,
	type WasModified,
} from '../lib/types.js';
import {
	findImageFiles,
	getUniqueFilename,
	isSupportedImage,
	sanitizeFilename,
	sleep,
	verifyImage,
} from '../utils/utils.js';

export class ImageRenamer {
	private logger: Logger;
	private llmClient: LLMClient;
	private config: ImageRenamerConfig;
	private databaseManager:
		| {
				saveDescription: (filePath: string, description: string) => Promise<void>;
				updateFilePath: (oldPath: string, newPath: string) => Promise<WasModified>;
				close: () => void;
		  }
		| undefined;

	constructor(
		logger: Logger,
		llmClient: LLMClient,
		databaseManager:
			| {
					saveDescription: (filePath: string, description: string) => Promise<void>;
					updateFilePath: (oldPath: string, newPath: string) => Promise<WasModified>;
					close: () => void;
			  }
			| undefined,
		config: ImageRenamerConfig
	) {
		this.logger = logger;
		this.llmClient = llmClient;
		this.databaseManager = databaseManager;
		this.config = config;
	}

	async generateNewFilename(imagePath: string, customPrompt?: string): Promise<string> {
		const filename = path.basename(imagePath);
		this.logger.debug({ imagePath, customPrompt }, `Generating filename for ${filename}`);
		try {
			const description = await this.llmClient.generateFilename(imagePath, customPrompt);
			const sanitizedName = sanitizeFilename(description, this.config);
			const uniquePath = await getUniqueFilename(imagePath, sanitizedName);

			// Save description to database before renaming
			if (this.databaseManager) {
				try {
					await this.databaseManager.saveDescription(imagePath, description);
					this.logger.debug({ imagePath, description }, `Saved description to database for ${filename}`);
				} catch (dbError) {
					this.logger.warn({ imagePath, error: String(dbError) }, `Failed to save description to database`);
				}
			}

			this.logger.info(
				{ imagePath, newPath: uniquePath, description },
				`Generated filename: ${path.basename(uniquePath)}`
			);
			return uniquePath;
		} catch (error) {
			if (error instanceof LlmConnectionError) {
				this.logger.error({ imagePath, error: error.message }, `LLM connection error for ${filename}`);
				throw error;
			}
			this.logger.error({ imagePath, error: String(error) }, `Failed to generate filename for ${filename}`);
			throw new ImageRenameError(`Failed to generate filename for ${filename}: ${error}`);
		}
	}

	async testConnection(): Promise<boolean> {
		this.logger.debug('Testing LLM connection');
		const result = await this.llmClient.testConnection();
		if (result) {
			this.logger.info('LLM connection successful');
		} else {
			this.logger.warn('LLM connection failed');
		}
		return result;
	}

	async safeFileMove(sourcePath: string, destinationPath: string): Promise<void> {
		const moveRetries = this.config['image-renamer'].fileOperations.safeMoveRetries;
		const moveDelay = this.config['image-renamer'].fileOperations.moveDelaySeconds;
		const sourceFilename = path.basename(sourcePath);

		this.logger.debug({ sourcePath, destinationPath }, `Moving file: ${sourceFilename}`);

		for (let attempt = 1; attempt <= moveRetries; attempt++) {
			try {
				await fsExtra.copy(sourcePath, destinationPath);
				const sourceStats = await fs.promises.stat(sourcePath);
				const destStats = await fs.promises.stat(destinationPath);

				if (sourceStats.size !== destStats.size) {
					throw new Error('File size mismatch after copy');
				}

				await fs.promises.unlink(sourcePath);
				this.logger.debug({ sourcePath, destinationPath }, `File moved successfully: ${sourceFilename}`);
				return;
			} catch (error) {
				this.logger.warn(
					{ sourcePath, attempt, maxRetries: moveRetries, error: String(error) },
					`Move attempt ${attempt} failed for ${sourceFilename}`
				);

				if (await fsExtra.pathExists(destinationPath)) {
					try {
						await fs.promises.unlink(destinationPath);
					} catch {
						// Ignore cleanup errors
					}
				}

				if (attempt === moveRetries) {
					this.logger.error(
						{ sourcePath, destinationPath, attempts: moveRetries },
						`Failed to move file after ${moveRetries} attempts`
					);
					throw new FileOperationError(`Failed to move file after ${moveRetries} attempts: ${error}`);
				}
				await sleep(moveDelay);
			}
		}
	}

	async safeFileMoveWithDatabaseUpdate(sourcePath: string, destinationPath: string): Promise<WasModified> {
		await this.safeFileMove(sourcePath, destinationPath);

		if (this.databaseManager) {
			const result = await this.databaseManager.updateFilePath(sourcePath, destinationPath);
			this.logger.debug({ sourcePath, destinationPath, wasModified: result }, 'Database updated after file move');
			return result;
		}

		return 'NotModified';
	}

	async renameSingleImage(
		imagePath: string,
		dryRun: boolean = false,
		customPrompt?: string,
		progressBar?: cliProgress.SingleBar | null,
		currentProgress?: number
	): Promise<boolean> {
		const filename = path.basename(imagePath);
		this.logger.debug({ imagePath, dryRun }, `Processing image: ${filename}`);

		// Helper to log with progress bar management
		const safeLog = (message: string) => {
			if (progressBar) {
				progressBar.stop();
				this.logger.debug({ imagePath }, message);
				progressBar.start(progressBar.getTotal(), currentProgress || 0);
			} else {
				this.logger.debug({ imagePath }, message);
			}
		};

		const safeError = (message: string) => {
			if (progressBar) {
				progressBar.stop();
				this.logger.error({ imagePath }, message);
				progressBar.start(progressBar.getTotal(), currentProgress || 0);
			} else {
				this.logger.error({ imagePath }, message);
			}
		};

		try {
			if (!isSupportedImage(imagePath, this.config)) {
				this.logger.debug({ imagePath }, `Skipping unsupported file: ${filename}`);
				safeLog(`Skipping unsupported file: ${filename}`);
				return false;
			}

			await verifyImage(imagePath, this.config);
			const newPath = await this.generateNewFilename(imagePath, customPrompt);

			if (path.resolve(imagePath) === path.resolve(newPath)) {
				this.logger.debug({ imagePath }, `No rename needed: ${filename}`);
				safeLog(`No rename needed: ${filename}`);
				return true;
			}

			if (dryRun) {
				this.logger.info({ imagePath, newPath }, `DRY RUN: ${filename} -> ${path.basename(newPath)}`);
				safeLog(`DRY RUN: ${filename} -> ${path.basename(newPath)}`);
				return true;
			}

			// Move file and update database
			try {
				const wasModified = await this.safeFileMoveWithDatabaseUpdate(imagePath, newPath);
				if (wasModified === 'Modified') {
					this.logger.debug({ imagePath }, `Database updated for ${filename}`);
					safeLog(`Database updated for ${filename}`);
				} else if (this.databaseManager) {
					this.logger.debug({ imagePath }, `Database not updated (no existing record) for ${filename}`);
					safeLog(`Database not updated (no existing record) for ${filename}`);
				}
			} catch (error) {
				// If it's a file operation error, rethrow it
				if (error instanceof FileOperationError) {
					throw error;
				}
				// Log database errors but don't fail the rename operation
				this.logger.warn({ imagePath, error: String(error) }, `Failed to update database for ${filename}`);
			}

			this.logger.info({ imagePath, newPath }, `Renamed: ${filename} -> ${path.basename(newPath)}`);
			safeLog(`${filename} -> ${path.basename(newPath)}`);
			return true;
		} catch (error) {
			this.logger.error(
				{ imagePath, error: error instanceof Error ? error.message : String(error) },
				`Failed to rename: ${filename}`
			);
			safeError(`${filename}: ${error instanceof Error ? error.message : error}`);
			return false;
		}
	}

	async renameDirectory(
		directoryPath: string,
		options: {
			recursive?: boolean;
			dryRun?: boolean;
			showProgress?: boolean;
			customPrompt?: string;
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

		this.logger.info({ directoryPath, options }, `Starting directory processing: ${directoryPath}`);

		try {
			const resolvedPath = path.resolve(directoryPath);
			if (!(await fsExtra.pathExists(resolvedPath))) {
				this.logger.error({ directoryPath }, `Directory not found: ${directoryPath}`);
				throw new ImageRenameError(`Directory not found: ${directoryPath}`);
			}

			const imageFiles = await findImageFiles(resolvedPath, this.config, options.recursive);
			results.total_files = imageFiles.length;
			this.logger.info(
				{ directoryPath, fileCount: results.total_files, recursive: options.recursive },
				`Found ${results.total_files} image files`
			);

			if (results.total_files === 0) {
				this.logger.warn({ directoryPath }, 'No supported image files found');
				return results;
			}

			const action = options.dryRun ? 'Analyzing' : 'Renaming';
			this.logger.info(
				{ action, totalFiles: results.total_files },
				`${action} ${results.total_files} image files`
			);

			let progressBar: cliProgress.SingleBar | null = null;
			if (options.showProgress !== false && this.config['image-renamer'].processing.progressBar) {
				progressBar = new cliProgress.SingleBar({
					format: `${action} |{bar}| {percentage}% | {value}/{total} Files`,
					barCompleteChar: '\u2588',
					barIncompleteChar: '\u2591',
				});
				progressBar.start(results.total_files, 0);
			}

			for (let i = 0; i < imageFiles.length; i++) {
				const filePath = imageFiles[i];
				if (filePath === undefined) continue;

				try {
					const success = await this.renameSingleImage(
						filePath,
						options.dryRun,
						options.customPrompt,
						progressBar,
						i + 1
					);
					if (success) {
						results.processed++;
					} else {
						results.skipped++;
					}
				} catch (error) {
					results.failed++;
					const errorMsg = error instanceof Error ? error.message : String(error);
					results.errors.push(`${path.basename(filePath)}: ${errorMsg}`);
				}

				if (progressBar) {
					progressBar.update(i + 1);
				}
			}

			if (progressBar) {
				progressBar.stop();
			}
		} catch (error) {
			this.logger.error({ directoryPath, error: String(error) }, 'Directory processing failed');
			throw new ImageRenameError(`Directory processing failed: ${error}`);
		} finally {
			results.processing_time = (Date.now() - startTime) / 1000;
		}

		this.logger.info(
			{
				directoryPath,
				totalFiles: results.total_files,
				processed: results.processed,
				failed: results.failed,
				skipped: results.skipped,
				processingTime: results.processing_time,
			},
			`Directory processing complete: ${results.processed} processed, ${results.failed} failed, ${results.skipped} skipped in ${results.processing_time.toFixed(1)}s`
		);

		return results;
	}

	get llm(): LLMClient {
		return this.llmClient;
	}
}
