/**
 * Utility functions for Doc Decomposer Riff
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * Convert a string to kebab-case
 */
export function toKebabCase(str: string): string {
	return str
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.replace(/-+/g, '-');
}

/**
 * Ensure a string ends with exactly one newline
 */
export function ensureTrailingNewline(content: string): string {
	return content.replace(/\n*$/, '\n');
}

/**
 * Extract a value from text using a regex pattern
 */
export function extractValue(text: string, regex: RegExp): string {
	const match = text.match(regex);
	return match?.[1] ?? '';
}

/**
 * Check if a file exists
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
 * Create directory if it doesn't exist
 */
export async function ensureDirectory(dirPath: string): Promise<void> {
	await fs.mkdir(dirPath, { recursive: true });
}

/**
 * Read file with error handling
 */
export async function readFile(filePath: string): Promise<string> {
	try {
		return await fs.readFile(filePath, 'utf-8');
	} catch (error) {
		throw new Error(`Failed to read file ${filePath}: ${error}`);
	}
}

/**
 * Write file with directory creation
 */
export async function writeFile(filePath: string, content: string): Promise<void> {
	const dir = path.dirname(filePath);
	await ensureDirectory(dir);
	await fs.writeFile(filePath, content, 'utf-8');
}

/**
 * Copy file with directory creation
 */
export async function copyFile(source: string, destination: string): Promise<void> {
	const dir = path.dirname(destination);
	await ensureDirectory(dir);
	await fs.copyFile(source, destination);
}

/**
 * Get all files matching a pattern
 */
export async function getFiles(dir: string, pattern: RegExp): Promise<string[]> {
	const files: string[] = [];

	async function walk(currentDir: string): Promise<void> {
		const entries = await fs.readdir(currentDir, { withFileTypes: true });

		for (const entry of entries) {
			const fullPath = path.join(currentDir, entry.name);

			if (entry.isDirectory()) {
				await walk(fullPath);
			} else if (entry.isFile() && pattern.test(entry.name)) {
				files.push(fullPath);
			}
		}
	}

	await walk(dir);
	return files;
}

/**
 * Sort an array of objects by a key
 */
export function sortBy<T>(array: T[], key: keyof T): T[] {
	return [...array].sort((a, b) => {
		const aVal = a[key];
		const bVal = b[key];

		if (aVal < bVal) return -1;
		if (aVal > bVal) return 1;
		return 0;
	});
}

/**
 * Group an array of objects by a key
 */
export function groupBy<T>(array: T[], key: keyof T): Map<T[keyof T], T[]> {
	const groups = new Map<T[keyof T], T[]>();

	for (const item of array) {
		const groupKey = item[key];
		const group = groups.get(groupKey) || [];
		group.push(item);
		groups.set(groupKey, group);
	}

	return groups;
}

/**
 * Get unique values from an array
 */
export function unique<T>(array: T[]): T[] {
	return [...new Set(array)];
}

/**
 * Filter out null/undefined values
 */
export function filterDefined<T>(array: (T | null | undefined)[]): T[] {
	return array.filter((item): item is T => item != null);
}

/**
 * Calculate percentage
 */
export function percentage(value: number, total: number): string {
	if (total === 0) return '0.0';
	return ((value / total) * 100).toFixed(1);
}

/**
 * Validate that required fields are present
 */
export function validateRequired<T extends object>(
	obj: T,
	required: (keyof T)[]
): { valid: boolean; missing: string[] } {
	const missing: string[] = [];

	for (const field of required) {
		if (!(field in obj) || obj[field] == null || obj[field] === '') {
			missing.push(String(field));
		}
	}

	return {
		valid: missing.length === 0,
		missing,
	};
}
