/**
 * Utility functions for image OCR riff
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as fsExtra from 'fs-extra';
import type { ImageOcrRiffConfig } from '../lib/schema.js';
import { FileOperationError, UnsupportedFileFormat } from '../lib/types.js';

export function isSupportedFile(filePath: string, config: ImageOcrRiffConfig): boolean {
	const ext = path.extname(filePath).toLowerCase();
	return config.files.supportedExtensions.includes(ext);
}

export async function validateFile(filePath: string, config: ImageOcrRiffConfig): Promise<void> {
	if (!isSupportedFile(filePath, config)) {
		throw new UnsupportedFileFormat(`Unsupported file format: ${path.extname(filePath)}`);
	}

	if (!(await fsExtra.pathExists(filePath))) {
		throw new FileOperationError(`File does not exist: ${filePath}`);
	}

	const stats = await fs.promises.stat(filePath);
	const maxSizeMb = config.files.maxFileSizeMb;
	const maxSizeBytes = maxSizeMb * 1024 * 1024;

	if (stats.size > maxSizeBytes) {
		throw new FileOperationError(
			`File size (${(stats.size / 1024 / 1024).toFixed(1)}MB) exceeds maximum allowed size (${maxSizeMb}MB)`
		);
	}
}

export async function findFiles(
	directoryPath: string,
	config: ImageOcrRiffConfig,
	recursive: boolean = false
): Promise<string[]> {
	const files: string[] = [];

	async function scanDirectory(dirPath: string): Promise<void> {
		const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

		for (const entry of entries) {
			const fullPath = path.join(dirPath, entry.name);

			if (entry.isDirectory() && recursive) {
				await scanDirectory(fullPath);
			} else if (entry.isFile() && isSupportedFile(fullPath, config)) {
				files.push(fullPath);
			}
		}
	}

	await scanDirectory(directoryPath);
	return files.sort();
}

export function generateOutputPath(inputPath: string, config: ImageOcrRiffConfig): string {
	const outputExtension = config.files.outputExtension;
	const parsed = path.parse(inputPath);
	return path.join(parsed.dir, parsed.name + outputExtension);
}

export async function sleep(seconds: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}
