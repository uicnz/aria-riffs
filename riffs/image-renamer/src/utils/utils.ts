/**
 * Utility functions for image renamer riff
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as fsExtra from 'fs-extra';
import sharp from 'sharp';
import { createLogger } from '../lib/logger.js';
import type { ImageRenamerConfig } from '../lib/schema.js';
import { FileOperationError, ImageCorrupted } from '../lib/types.js';

export function isSupportedImage(filePath: string, config: ImageRenamerConfig): boolean {
	const supportedExtensions = config['image-renamer'].images.supportedExtensions;
	const ext = path.extname(filePath).toLowerCase();
	return supportedExtensions.includes(ext);
}

export async function verifyImage(filePath: string, config: ImageRenamerConfig): Promise<void> {
	try {
		await fs.promises.access(filePath, fs.constants.R_OK);

		const stats = await fs.promises.stat(filePath);
		const maxSizeMB = config['image-renamer'].images.maxFileSizeMb;
		const maxSizeBytes = maxSizeMB * 1024 * 1024;

		if (stats.size > maxSizeBytes) {
			throw new ImageCorrupted(
				`Image file too large: ${Math.round(stats.size / 1024 / 1024)}MB > ${maxSizeMB}MB`
			);
		}

		if (config['image-renamer'].images.verifyBeforeProcessing) {
			const metadata = await sharp(filePath).metadata();
			if (!metadata.format) {
				throw new ImageCorrupted(`Invalid or corrupted image file: ${filePath}`);
			}
		}
	} catch (error: unknown) {
		if (error instanceof ImageCorrupted) {
			throw error;
		}
		if (error && typeof error === 'object' && 'code' in error && error.code === 'EACCES') {
			throw new FileOperationError(`Permission denied accessing file: ${filePath}`);
		}
		if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
			throw new FileOperationError(`File not found: ${filePath}`);
		}
		throw new ImageCorrupted(`Failed to verify image: ${error}`);
	}
}

export function sanitizeFilename(description: string, config: ImageRenamerConfig): string {
	const filenameConfig = {
		pattern_cleanup: config['image-renamer'].filename.patternCleanup,
		max_length: config['image-renamer'].filename.maxLength,
		remove_punctuation: config['image-renamer'].filename.removePunctuation,
		replace_spaces_with: config['image-renamer'].filename.replaceSpacesWith,
		case_conversion: config['image-renamer'].filename.caseConversion,
	};

	let filename = description.trim();

	if (filenameConfig.pattern_cleanup) {
		filename = filename.replace(/^["']|["']$/g, '');
		const prefixPatterns = [
			/^(the image shows?|this image shows?|the picture shows?|this picture shows?)\s*/i,
			/^(an? image of|an? picture of|an? photo of)\s*/i,
			/^(here is|this is|there is)\s*(an? image of|an? picture of|an? photo of)?\s*/i,
		];

		for (const pattern of prefixPatterns) {
			filename = filename.replace(pattern, '');
		}
	}

	if (filenameConfig.remove_punctuation) {
		filename = filename.replace(/[^\w\s-]/g, '');
	}

	filename = filename.replace(/\s+/g, filenameConfig.replace_spaces_with);
	// biome-ignore lint/suspicious/noControlCharactersInRegex: intentionally matching control characters for invalid filesystem names
	filename = filename.replace(/[<>:"/\\|?*\x00-\x1F]/g, '');

	switch (filenameConfig.case_conversion) {
		case 'lower':
			filename = filename.toLowerCase();
			break;
		case 'upper':
			filename = filename.toUpperCase();
			break;
		case 'title':
			filename = filename
				.split(filenameConfig.replace_spaces_with)
				.map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
				.join(filenameConfig.replace_spaces_with);
			break;
	}

	if (filename.length > filenameConfig.max_length) {
		filename = filename.substring(0, filenameConfig.max_length);
	}

	if (!filename) {
		filename = 'unnamed-image';
	}

	filename = filename.replace(/[-_]+$/, '');
	return filename;
}

export async function getUniqueFilename(originalPath: string, newBasename: string): Promise<string> {
	const dir = path.dirname(originalPath);
	const ext = path.extname(originalPath);
	let newPath = path.join(dir, newBasename + ext);

	if (path.resolve(newPath) === path.resolve(originalPath)) {
		return originalPath;
	}

	let counter = 1;
	while (await fsExtra.pathExists(newPath)) {
		newPath = path.join(dir, `${newBasename}-${counter}${ext}`);
		counter++;

		if (counter > 9999) {
			throw new FileOperationError('Could not generate unique filename - too many collisions');
		}
	}

	return newPath;
}

export async function findImageFiles(
	directoryPath: string,
	config: ImageRenamerConfig,
	recursive: boolean = false
): Promise<string[]> {
	const imageFiles: string[] = [];
	const logger = createLogger({
		level: config.logging.level,
		verbose: config.logging.verbose,
		file: config.logging.file,
		maxFileSizeMb: config.logging.maxFileSizeMb,
		maxFiles: config.logging.maxFiles,
	});

	async function scanDirectory(dirPath: string): Promise<void> {
		try {
			const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

			for (const entry of entries) {
				const fullPath = path.join(dirPath, entry.name);

				if (entry.isFile() && isSupportedImage(fullPath, config)) {
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
		const imageBuffer = await fs.promises.readFile(filePath);
		return imageBuffer.toString('base64');
	} catch (error) {
		throw new FileOperationError(`Failed to read image file: ${error}`);
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
