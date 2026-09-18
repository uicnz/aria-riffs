/**
 * Aria Dir Differ - Directory Validation Module - Directory validation and path utilities
 */

import * as fs from 'node:fs';
import type { DirectoryPaths, ValidationResult } from '../lib/types.js';

/**
 * Validate that both directories exist and are readable
 */
export function validateDirectories(paths: DirectoryPaths): ValidationResult {
	if (!fs.existsSync(paths.dir1)) {
		return {
			valid: false,
			error: `Directory not found: ${paths.dir1}`,
		};
	}

	if (!fs.existsSync(paths.dir2)) {
		return {
			valid: false,
			error: `Directory not found: ${paths.dir2}`,
		};
	}

	try {
		fs.accessSync(paths.dir1, fs.constants.R_OK);
	} catch {
		return {
			valid: false,
			error: `Directory not readable: ${paths.dir1}`,
		};
	}

	try {
		fs.accessSync(paths.dir2, fs.constants.R_OK);
	} catch {
		return {
			valid: false,
			error: `Directory not readable: ${paths.dir2}`,
		};
	}

	return { valid: true };
}

/**
 * Read file content for content comparison
 */
export function readFileContent(filePath: string): string {
	try {
		return fs.readFileSync(filePath, 'utf8');
	} catch (error) {
		throw new Error(`Failed to read file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
}

/**
 * Check if a path represents a file (vs directory)
 */
export function isFile(filePath: string): boolean {
	try {
		return fs.statSync(filePath).isFile();
	} catch {
		return false;
	}
}
