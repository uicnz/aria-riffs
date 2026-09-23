/**
 * Utility functions for image meta processor
 */

import * as fsPromises from 'node:fs/promises';
import * as path from 'node:path';
import { loadConfig } from '../lib/config.js';
import { createLogger } from '../lib/logger.js';
import { FilePermissionError } from '../lib/types.js';

// Load config once at module level
const appConfig = loadConfig();
const riff = appConfig['image-metadata'];
const logger = createLogger({
	level: appConfig.logging.level,
	verbose: appConfig.logging.verbose,
	file: appConfig.logging.file,
	maxFileSizeMb: appConfig.logging.maxFileSizeMb,
	maxFiles: appConfig.logging.maxFiles,
});

export function isSupportedImage(filePath: string): boolean {
	const supportedExtensions = riff.images.supportedExtensions;
	const ext = path.extname(filePath).toLowerCase();
	return supportedExtensions.includes(ext);
}

export async function findImageFiles(directoryPath: string, recursive: boolean = false): Promise<string[]> {
	const imageFiles: string[] = [];

	async function scanDirectory(dirPath: string): Promise<void> {
		try {
			const entries = await fsPromises.readdir(dirPath, { withFileTypes: true });

			for (const entry of entries) {
				const fullPath = path.join(dirPath, entry.name);

				if (entry.isFile() && isSupportedImage(fullPath)) {
					imageFiles.push(fullPath);
				} else if (entry.isDirectory() && recursive) {
					await scanDirectory(fullPath);
				}
			}
		} catch (error) {
			logger.warn({ dirPath, error }, 'Could not read directory while scanning images');
		}
	}

	await scanDirectory(directoryPath);
	return imageFiles.sort();
}

export async function encodeImageToBase64(filePath: string): Promise<string> {
	try {
		const imageBuffer = await fsPromises.readFile(filePath);
		return imageBuffer.toString('base64');
	} catch (error) {
		throw new FilePermissionError(`Failed to read image file: ${error}`);
	}
}

export function sleep(seconds: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

export async function retryWithBackoff<T>(
	fn: () => Promise<T>,
	maxAttempts: number,
	initialDelay: number = 1
): Promise<T> {
	let lastError: Error | undefined;

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		try {
			return await fn();
		} catch (error) {
			lastError = error as Error;

			if (attempt === maxAttempts) {
				throw lastError;
			}

			const delay = initialDelay * 2 ** (attempt - 1);
			await sleep(delay);
		}
	}

	throw lastError || new Error('Retry failed with unknown error');
}
