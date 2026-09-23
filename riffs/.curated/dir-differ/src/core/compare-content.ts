/**
 * Aria Dir Differ Content Comparison Module - File content comparison utilities
 */

import path from 'node:path';
import type { ContentDifference } from '../lib/types.js';
import { readFileContent } from './validate-dirs.js';

/**
 * Compare content between two files and return differences
 */
export function compareFileContent(dir1: string, dir2: string, relativePath: string): ContentDifference[] {
	const fullPath1 = path.join(dir1, relativePath);
	const fullPath2 = path.join(dir2, relativePath);

	try {
		const content1 = readFileContent(fullPath1);
		const content2 = readFileContent(fullPath2);

		return findContentDifferences(content1, content2);
	} catch (error) {
		throw new Error(
			`Error comparing file contents for ${relativePath}: ${error instanceof Error ? error.message : 'Unknown error'}`
		);
	}
}

/**
 * Find differences between two file contents line by line
 */
export function findContentDifferences(content1: string, content2: string, maxDiffs: number = 5): ContentDifference[] {
	const lines1 = content1.split('\n');
	const lines2 = content2.split('\n');
	const differences: ContentDifference[] = [];

	const maxLines = Math.max(lines1.length, lines2.length);
	let diffCount = 0;

	for (let i = 0; i < maxLines && diffCount < maxDiffs; i++) {
		const line1 = i < lines1.length ? lines1[i] : null;
		const line2 = i < lines2.length ? lines2[i] : null;

		if (line1 !== line2) {
			diffCount++;

			if (line1 === null) {
				differences.push({
					line: i + 1,
					line1: null,
					line2,
					type: 'added',
				});
			} else if (line2 === null) {
				differences.push({
					line: i + 1,
					line1,
					line2: null,
					type: 'missing',
				});
			} else {
				differences.push({
					line: i + 1,
					line1,
					line2,
					type: 'changed',
				});
			}
		}
	}

	return differences;
}
