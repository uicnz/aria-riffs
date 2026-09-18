/**
 * File system watcher for automatic image renaming
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as fsExtra from 'fs-extra';
import type { Logger } from 'pino';
import watch from 'watcher';
import type { ImageRenamerConfig } from '../lib/schema.js';
import { type LLMClient, WatcherError, type WatchStats } from '../lib/types.js';
import { findImageFiles, isSupportedImage, sleep } from '../utils/utils.js';
import { ImageRenamer } from './rename-images.js';

export class ImageWatcher {
	private logger: Logger;
	private config: ImageRenamerConfig;
	private renamer: ImageRenamer;
	private recursive: boolean;
	private quiet: boolean;
	private stopOnError: boolean;
	private debounceSeconds: number;
	private fileSettleTime: number;

	// Stateful tracking to prevent race conditions
	private existingFiles: Set<string> = new Set();
	private processingFiles: Set<string> = new Set();
	private processedFiles: Set<string> = new Set();

	// Watch statistics
	private filesProcessed = 0;
	private filesFailed = 0;
	private startTime = 0;
	private running = false;
	private watcher: InstanceType<typeof watch> | null = null;

	constructor(
		logger: Logger,
		config: ImageRenamerConfig,
		options: {
			llmClient?: LLMClient;
			databaseManager?: {
				saveDescription: (filePath: string, description: string) => Promise<void>;
				updateFilePath: (oldPath: string, newPath: string) => Promise<'Modified' | 'NotModified'>;
				close: () => void;
			};
			recursive?: boolean;
			quiet?: boolean;
			stopOnError?: boolean;
		} = {}
	) {
		if (!options.llmClient) {
			throw new Error('ImageWatcher requires llmClient to be provided');
		}
		this.logger = logger;
		this.config = config;
		this.renamer = new ImageRenamer(logger, options.llmClient, options.databaseManager, config);
		this.recursive = options.recursive || false;
		this.quiet = options.quiet || false;
		this.stopOnError = options.stopOnError || false;
		this.debounceSeconds = config['image-renamer'].watcher.debounceSeconds;
		this.fileSettleTime = config['image-renamer'].watcher.fileSettleTime;

		this.logger.debug(
			{ recursive: this.recursive, quiet: this.quiet, stopOnError: this.stopOnError },
			'Image watcher initialized'
		);
		if (!this.quiet) {
			this.logger.info('Image watcher initialized');
		}
	}

	private async scanExistingFiles(directoryPath: string): Promise<void> {
		this.logger.debug({ directoryPath }, 'Scanning existing files');
		try {
			const existingFiles = await findImageFiles(directoryPath, this.config, this.recursive);

			for (const filePath of existingFiles) {
				this.existingFiles.add(path.resolve(filePath));
			}

			this.logger.info(
				{ directoryPath, fileCount: existingFiles.length },
				`Found ${existingFiles.length} existing image files to ignore`
			);
		} catch (error) {
			this.logger.error({ directoryPath, error: String(error) }, 'Failed to scan existing files');
		}
	}

	private shouldIgnoreFile(filePath: string): boolean {
		const resolvedPath = path.resolve(filePath);

		return (
			!isSupportedImage(filePath, this.config) ||
			this.existingFiles.has(resolvedPath) ||
			this.processingFiles.has(resolvedPath) ||
			this.processedFiles.has(resolvedPath)
		);
	}

	private async processNewFile(filePath: string): Promise<void> {
		const filename = path.basename(filePath);

		if (this.shouldIgnoreFile(filePath)) {
			this.logger.debug({ filePath }, `Ignoring file: ${filename}`);
			return;
		}

		const resolvedPath = path.resolve(filePath);
		this.processingFiles.add(resolvedPath);
		this.logger.info({ filePath }, `Processing new file: ${filename}`);

		try {
			// Test connection first
			if (!(await this.renamer.testConnection())) {
				throw new Error('Cannot connect to Ollama API');
			}

			// Wait for file to settle (in case it's still being written)
			await sleep(this.fileSettleTime);
			// Generate new filename first to know what the final path will be
			const newPath = await this.renamer.generateNewFilename(filePath);
			if (!newPath) {
				this.filesFailed++;
				this.logger.error({ filePath }, `Failed to generate filename for: ${filename}`);
				if (this.stopOnError) {
					throw new WatcherError(`Filename generation failed for ${filename}`);
				}
				return;
			}

			// Add both original and new paths to processed set BEFORE renaming
			// This prevents the rename event from triggering reprocessing
			this.processedFiles.add(resolvedPath);
			if (path.resolve(newPath) !== resolvedPath) {
				this.processedFiles.add(path.resolve(newPath));
			}

			// Check if rename is needed
			if (path.resolve(filePath) === path.resolve(newPath)) {
				this.logger.debug({ filePath }, `No rename needed: ${filename}`);
				this.filesProcessed++;
				return;
			}

			// Perform the file move and update database
			try {
				await this.renamer.safeFileMoveWithDatabaseUpdate(filePath, newPath);
				this.filesProcessed++;
				this.logger.info(
					{ filePath, newPath },
					`Successfully processed: ${filename} -> ${path.basename(newPath)}`
				);
			} catch (error) {
				this.filesFailed++;
				// Remove from processed set if rename failed
				this.processedFiles.delete(resolvedPath);
				if (path.resolve(newPath) !== resolvedPath) {
					this.processedFiles.delete(path.resolve(newPath));
				}
				throw error;
			}
		} catch (error) {
			this.filesFailed++;
			this.logger.error({ filePath, error: String(error) }, `Failed to process ${filename}`);

			if (this.stopOnError) {
				throw new WatcherError(`Stopping watch due to processing error: ${error}`);
			}
		} finally {
			this.processingFiles.delete(resolvedPath);
		}
	}

	async startWatching(directoryPath: string): Promise<void> {
		this.logger.info({ directoryPath, recursive: this.recursive }, `Starting to watch directory: ${directoryPath}`);
		try {
			const resolvedPath = path.resolve(directoryPath);

			// Validate directory
			if (!(await fsExtra.pathExists(resolvedPath))) {
				this.logger.error({ directoryPath }, `Directory not found: ${directoryPath}`);
				throw new WatcherError(`Directory not found: ${directoryPath}`);
			}

			const stats = await fs.promises.stat(resolvedPath);
			if (!stats.isDirectory()) {
				this.logger.error({ directoryPath }, `Path is not a directory: ${directoryPath}`);
				throw new WatcherError(`Path is not a directory: ${directoryPath}`);
			}

			// Test Ollama connection
			if (!(await this.renamer.testConnection())) {
				this.logger.error('Cannot connect to Ollama API');
				throw new WatcherError('Cannot connect to Ollama API - ensure Ollama is running');
			}

			// Scan existing files
			await this.scanExistingFiles(resolvedPath);

			// Start watching
			this.startTime = Date.now();
			this.running = true;

			const watchOptions = {
				recursive: this.recursive,
				ignoreInitial: true,
				debounce: this.debounceSeconds * 1000,
			};

			this.watcher = new watch(resolvedPath, watchOptions, async (eventType: string, filePath: string) => {
				this.logger.debug({ eventType, filePath }, `File event: ${eventType}`);
				if (eventType === 'add' || eventType === 'change') {
					try {
						await this.processNewFile(filePath);
					} catch (error) {
						if (error instanceof WatcherError && this.stopOnError) {
							this.logger.error({ error: error.message }, `Stopping watcher: ${error.message}`);
							await this.stopWatching();
							return;
						}
					}
				}
			});

			const mode = this.recursive ? '(recursive)' : '(non-recursive)';
			this.logger.info({ directoryPath: resolvedPath, mode }, `Started watching ${resolvedPath} ${mode}`);
			if (!this.quiet) {
				this.logger.info('Press Ctrl+C to stop watching');
			}

			// Keep the process running
			await new Promise<void>(resolve => {
				process.on('SIGINT', () => {
					this.logger.info('Received SIGINT, stopping watch');
					resolve();
				});

				process.on('SIGTERM', () => {
					this.logger.info('Received SIGTERM, stopping watch');
					resolve();
				});
			});
		} catch (error) {
			if (error instanceof WatcherError) {
				throw error;
			}
			this.logger.error({ directoryPath, error: String(error) }, `Could not watch directory ${directoryPath}`);
			throw new WatcherError(`Could not watch directory ${directoryPath}: ${error}`);
		} finally {
			await this.stopWatching();
		}
	}

	async stopWatching(): Promise<void> {
		if (this.watcher) {
			this.watcher.close();
			this.watcher = null;
		}

		this.running = false;

		const stats = this.getWatchStats();
		this.logger.info(
			{
				filesProcessed: this.filesProcessed,
				filesFailed: this.filesFailed,
				watchTime: stats.watch_time,
			},
			`Stopped watching. Processed: ${this.filesProcessed}, Failed: ${this.filesFailed}, Time: ${stats.watch_time.toFixed(1)}s`
		);
	}

	getWatchStats(): WatchStats {
		const watchTime = this.startTime > 0 ? (Date.now() - this.startTime) / 1000 : 0;

		return {
			files_processed: this.filesProcessed,
			files_failed: this.filesFailed,
			watch_time: watchTime,
		};
	}

	get isRunning(): boolean {
		return this.running;
	}
}
