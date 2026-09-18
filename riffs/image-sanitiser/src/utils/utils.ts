/**
 * Utility functions for image-sanitiser riff
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as fsExtra from 'fs-extra';
import { createLogger } from '../lib/logger.js';
import type { ImageSanitiserConfig } from '../lib/schema.js';
import { FileOperationError, UnsupportedImageFormat } from '../lib/types.js';

export function isSupportedImageExtension(filePath: string, config: ImageSanitiserConfig): boolean {
	const ext = path.extname(filePath).toLowerCase();
	return config['image-sanitiser'].images.supportedExtensions.includes(ext);
}

export async function validateImageFile(filePath: string, config: ImageSanitiserConfig): Promise<void> {
	try {
		await fs.promises.access(filePath, fs.constants.R_OK);

		const stats = await fs.promises.stat(filePath);
		const maxSizeBytes = config['image-sanitiser'].images.maxFileSizeMb * 1024 * 1024;

		if (stats.size > maxSizeBytes) {
			const actualSizeMB = Math.round(stats.size / 1024 / 1024);
			throw new UnsupportedImageFormat(
				`Image file too large: ${actualSizeMB}MB > ${config['image-sanitiser'].images.maxFileSizeMb}MB`
			);
		}

		if (stats.size === 0) {
			throw new UnsupportedImageFormat(`Empty file: ${filePath}`);
		}
	} catch (error: unknown) {
		if (error instanceof UnsupportedImageFormat) {
			throw error;
		}
		if (error && typeof error === 'object' && 'code' in error && error.code === 'EACCES') {
			throw new FileOperationError(`Permission denied accessing file: ${filePath}`);
		}
		if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
			throw new FileOperationError(`File not found: ${filePath}`);
		}
		throw new UnsupportedImageFormat(`Failed to validate file: ${error}`);
	}
}

export function sanitizeFilename(filename: string): string {
	// Remove invalid filesystem characters
	// biome-ignore lint/suspicious/noControlCharactersInRegex: intentionally matching control characters for invalid filesystem names
	const invalidChars = /[<>:"/\\|?*\x00-\x1F]/g;
	let sanitized = filename.replace(invalidChars, '_');

	// Replace multiple spaces with single space and trim
	sanitized = sanitized.replace(/\s+/g, ' ').trim();

	// Handle empty filenames
	if (!sanitized) {
		sanitized = 'sanitized-image';
	}

	// Truncate long filenames
	const maxLength = 200;
	if (sanitized.length > maxLength) {
		sanitized = sanitized.substring(0, maxLength);
	}

	return sanitized;
}

export async function getUniqueFilename(
	originalPath: string,
	newBasename: string,
	newExtension: string
): Promise<string> {
	const dir = path.dirname(originalPath);
	let newPath = path.join(dir, newBasename + newExtension);

	// If the new path is the same as original, no change needed
	if (path.resolve(newPath) === path.resolve(originalPath)) {
		return originalPath;
	}

	let counter = 1;
	while (await fsExtra.pathExists(newPath)) {
		newPath = path.join(dir, `${newBasename}-${counter}${newExtension}`);
		counter++;

		if (counter > 9999) {
			throw new FileOperationError('Could not generate unique filename - too many collisions');
		}
	}

	return newPath;
}

export async function findImageFiles(
	directoryPath: string,
	config: ImageSanitiserConfig,
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

				if (entry.isFile()) {
					// Check if file has any image-like extension or no extension
					const ext = path.extname(fullPath).toLowerCase();
					const hasImageExtension = isSupportedImageExtension(fullPath, config);
					const hasNoExtension = !ext;
					const hasImageLikeName = /\.(jpe?g|png|gif|bmp|tiff?|webp)$/i.test(entry.name);

					if (hasImageExtension || hasNoExtension || hasImageLikeName) {
						imageFiles.push(fullPath);
					}
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

export async function safeFileMove(
	sourcePath: string,
	destinationPath: string,
	config: ImageSanitiserConfig
): Promise<void> {
	const moveRetries = config['image-sanitiser'].fileOperations.safeMoveRetries;
	const moveDelay = config['image-sanitiser'].fileOperations.moveDelaySeconds;

	for (let attempt = 1; attempt <= moveRetries; attempt++) {
		try {
			// First copy the file
			await fsExtra.copy(sourcePath, destinationPath);

			// Verify the copy was successful
			const sourceStats = await fs.promises.stat(sourcePath);
			const destStats = await fs.promises.stat(destinationPath);

			if (sourceStats.size !== destStats.size) {
				throw new Error('File size mismatch after copy');
			}

			// Only delete source after successful verification
			await fs.promises.unlink(sourcePath);
			return;
		} catch (error) {
			// Clean up partial destination file
			if (await fsExtra.pathExists(destinationPath)) {
				try {
					await fs.promises.unlink(destinationPath);
				} catch {
					// Ignore cleanup errors
				}
			}

			if (attempt === moveRetries) {
				throw new FileOperationError(`Failed to move file after ${moveRetries} attempts: ${error}`);
			}
			await sleep(moveDelay);
		}
	}
}

export function sleep(seconds: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

export function getExtensionFromMimeType(mimeType: string): string {
	const mimeToExtMap: Record<string, string> = {
		'image/jpeg': '.jpg',
		'image/jpg': '.jpg',
		'image/png': '.png',
		'image/gif': '.gif',
		'image/bmp': '.bmp',
		'image/tiff': '.tiff',
		'image/webp': '.webp',
		'image/x-ms-bmp': '.bmp',
		'image/vnd.microsoft.icon': '.ico',
	};

	return mimeToExtMap[mimeType.toLowerCase()] || '';
}

export function normalizeExtension(extension: string): string {
	const ext = extension.toLowerCase();
	// Normalize common variations
	if (ext === '.jpeg') return '.jpg';
	if (ext === '.tif') return '.tiff';
	return ext;
}
