/**
 * Utility functions for mindmap-converter
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { OUTPUT_EXTENSION } from '../lib/config.js';
import type { InputFormat } from '../lib/types.js';

/**
 * Detect input format from file extension
 */
export function detectFormat(filePath: string): InputFormat {
	const ext = path.extname(filePath).toLowerCase();

	if (ext === '.opml') {
		return 'opml';
	}

	if (ext === '.mm') {
		return 'mm';
	}

	throw new Error(`Unsupported file format: ${ext}. Supported formats: .opml, .mm`);
}

/**
 * Read file content as UTF-8 string
 */
export async function readFile(filePath: string): Promise<string> {
	try {
		return await fs.readFile(filePath, 'utf-8');
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
			throw new Error(`File not found: ${filePath}`);
		}
		throw new Error(`Failed to read file: ${(error as Error).message}`);
	}
}

/**
 * Write content to file, creating parent directories if needed
 */
export async function writeFile(filePath: string, content: string): Promise<void> {
	try {
		const dir = path.dirname(filePath);
		await fs.mkdir(dir, { recursive: true });
		await fs.writeFile(filePath, content, 'utf-8');
	} catch (error) {
		throw new Error(`Failed to write file: ${(error as Error).message}`);
	}
}

/**
 * Generate output filename from input filename
 */
export function generateOutputPath(inputPath: string, outputPath?: string): string {
	if (outputPath) {
		return outputPath;
	}

	const dir = path.dirname(inputPath);
	const basename = path.basename(inputPath, path.extname(inputPath));
	return path.join(dir, basename + OUTPUT_EXTENSION);
}

/**
 * Check if file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
	try {
		await fs.access(filePath);
		return true;
	} catch {
		return false;
	}
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
	if (bytes === 0) return '0 B';

	const units = ['B', 'KB', 'MB', 'GB'];
	const index = Math.floor(Math.log(bytes) / Math.log(1024));
	const size = bytes / 1024 ** index;

	return `${size.toFixed(2)} ${units[index]}`;
}

/**
 * Get file stats for reporting
 */
export async function getFileStats(filePath: string) {
	const stats = await fs.stat(filePath);
	return {
		size: stats.size,
		sizeFormatted: formatFileSize(stats.size),
		modified: stats.mtime,
	};
}
