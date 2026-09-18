/**
 * Aria Dir Differ Output Formatting Module - Logging utilities for directory comparison
 */

import type { Logger } from 'pino';
import type { CompareResult, ContentDifference, DiffItem, DiffOptions, DirectoryPaths } from '../lib/types.js';

/**
 * Print the header information about the comparison
 */
export function printHeader(paths: DirectoryPaths, excludes: string[], logger: Logger): void {
	logger.debug({ dir1: paths.dir1, dir2: paths.dir2, excludes }, 'Comparing directories');
}

/**
 * Print the summary statistics
 */
export function printSummary(result: CompareResult, logger: Logger): void {
	logger.info(
		{
			dirs1: result.dirs1 || 0,
			dirs2: result.dirs2 || 0,
			files1: result.files1 || 0,
			files2: result.files2 || 0,
			identical: result.equal,
			changed: result.distinct,
			onlyInDir1: result.left,
			onlyInDir2: result.right,
		},
		'Comparison summary'
	);
}

/**
 * Print the final result message
 */
export function printFinalResult(result: CompareResult, logger: Logger): void {
	if (result.same) {
		logger.info('Directories are identical');
	} else {
		logger.warn('Directories are different');
	}
}

/**
 * Print detailed differences
 */
export function printDetailedDifferences(
	result: CompareResult,
	paths: DirectoryPaths,
	options: DiffOptions,
	logger: Logger
): void {
	if (result.same) {
		logger.info('Directories are identical');
		return;
	}

	if (options.summaryOnly) {
		logger.warn('Directories are different - use without --summary-only to see details');
		return;
	}

	const sortedDiffs = sortDifferences(result.diffSet);
	const differences = sortedDiffs.filter(diff => diff.state !== 'equal');

	if (differences.length === 0) {
		logger.info('No differences found');
		return;
	}

	for (const diff of differences) {
		printSingleDifference(diff, paths, logger);
	}
}

/**
 * Sort differences by state and name for better readability
 */
function sortDifferences(diffSet: DiffItem[]): DiffItem[] {
	return diffSet.sort((a, b) => {
		if (a.state !== b.state) {
			const stateOrder = { left: 1, right: 2, distinct: 3, equal: 4 };
			return stateOrder[a.state] - stateOrder[b.state];
		}
		return (a.name1 || '').localeCompare(b.name1 || '');
	});
}

/**
 * Print a single difference entry
 */
function printSingleDifference(diff: DiffItem, paths: DirectoryPaths, logger: Logger): void {
	const relativePath = diff.relativePath || '';
	const fileName = diff.name1 || diff.name2 || '';
	const fullPath = relativePath ? `${relativePath}/${fileName}` : fileName;

	if (diff.state === 'left') {
		logger.debug({ dir: paths.dir1, path: fullPath }, 'File only in directory 1');
	} else if (diff.state === 'right') {
		logger.debug({ dir: paths.dir2, path: fullPath }, 'File only in directory 2');
	} else if (diff.state === 'distinct') {
		logger.debug({ path: fullPath }, 'File changed');
	}
}

/**
 * Print content differences for a changed file
 */
export function printContentDifferences(differences: ContentDifference[], logger: Logger, maxDiffs: number = 5): void {
	logger.debug({ count: differences.length }, 'Content differences found');

	const displayDiffs = differences.slice(0, maxDiffs);

	for (const diff of displayDiffs) {
		if (diff.type === 'added') {
			logger.debug({ line: diff.line, added: diff.line2 }, 'Line added');
		} else if (diff.type === 'missing') {
			logger.debug({ line: diff.line, removed: diff.line1 }, 'Line removed');
		} else if (diff.type === 'changed') {
			logger.debug({ line: diff.line, from: diff.line1, to: diff.line2 }, 'Line changed');
		}
	}

	if (differences.length > maxDiffs) {
		logger.debug({ total: differences.length, shown: maxDiffs }, 'Additional differences not shown');
	}
}

/**
 * Print content comparison error
 */
export function printContentError(filePath: string, error: Error, logger: Logger): void {
	const isBinaryOrEncoding = error.message.includes('encoding') || error.message.includes('character');
	logger.error(
		{
			file: filePath,
			error: error.message,
			possibleBinary: isBinaryOrEncoding,
		},
		'Error reading file contents'
	);
}
