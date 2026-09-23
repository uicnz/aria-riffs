/**
 * File scanner for discovering and reading documents
 */

import { readFile, stat } from 'node:fs/promises';
import { relative } from 'node:path';
import { glob } from 'glob';
import type { Logger } from 'pino';
import type { ScannedFile, ScanOptions } from '../lib/types.js';

export class FileScanner {
	private logger: Logger;

	constructor(logger: Logger) {
		this.logger = logger;
	}

	/**
	 * Scan directory for files matching patterns
	 */
	async scan(directory: string, options: ScanOptions): Promise<ScannedFile[]> {
		this.logger.info({ directory, patterns: options.patterns }, 'Scanning directory');

		const files: ScannedFile[] = [];

		// Find all matching files
		for (const pattern of options.patterns) {
			const matches = await glob(pattern, {
				cwd: directory,
				ignore: options.ignore,
				absolute: true,
			});

			for (const path of matches) {
				try {
					const stats = await stat(path);

					// Skip if file is too large
					if (options.maxFileSize && stats.size > options.maxFileSize) {
						this.logger.warn({ path, size: stats.size }, 'Skipping oversized file');
						continue;
					}

					// Read file content
					const content = await readFile(path, 'utf-8');

					files.push({
						path,
						relativePath: relative(directory, path),
						content,
						size: stats.size,
						modifiedAt: stats.mtime,
					});

					this.logger.debug({ path }, 'File scanned');
				} catch (error) {
					this.logger.warn({ path, error }, 'Failed to read file');
				}
			}
		}

		this.logger.info({ count: files.length }, 'Directory scan complete');

		return files;
	}

	/**
	 * Get file statistics
	 */
	async getFileStats(path: string): Promise<{ size: number; modifiedAt: Date }> {
		const stats = await stat(path);
		return {
			size: stats.size,
			modifiedAt: stats.mtime,
		};
	}
}
