/**
 * Aria Dir Differ Processing Module - Main directory comparison orchestration
 */

import path from 'node:path';
import dircompare from 'dir-compare';
import type { Logger } from 'pino';
import type { CompareResult, DiffItem, DiffOptions, DirectoryPaths } from '../lib/types.js';
import {
	printContentDifferences,
	printContentError,
	printDetailedDifferences,
	printFinalResult,
	printHeader,
	printSummary,
} from '../utils/format-output.js';
import { compareFileContent } from './compare-content.js';
import { validateDirectories } from './validate-dirs.js';

/**
 * Main function to compare two directories
 */
export async function compareDirectories(
	paths: DirectoryPaths,
	options: DiffOptions = {},
	logger: Logger
): Promise<boolean> {
	// Validate directories exist
	const validation = validateDirectories(paths);
	if (!validation.valid) {
		logger.error({ error: validation.error }, 'Directory validation failed');
		throw new Error(validation.error);
	}
	logger.debug({ dir1: paths.dir1, dir2: paths.dir2 }, 'Directories validated');

	// Set up exclude patterns
	const defaultExcludes = ['.DS_Store', '*.md.bak', '.git', 'node_modules'];
	const excludes = [...defaultExcludes, ...(options.exclude || [])];
	logger.debug({ excludes }, 'Exclude patterns configured');

	// Print header
	printHeader(paths, excludes, logger);

	// Configure comparison options
	const compareOptions: dircompare.Options = {
		compareContent: true,
		excludeFilter: excludes.join(','),
		compareSize: true,
		compareDate: false,
		recursive: true,
	};

	try {
		// Perform the comparison
		logger.debug('Starting directory comparison');
		const result = (await dircompare.compare(paths.dir1, paths.dir2, compareOptions)) as CompareResult;
		logger.debug(
			{
				same: result.same,
				equal: result.equal,
				distinct: result.distinct,
				left: result.left,
				right: result.right,
			},
			'Comparison complete'
		);

		// Print summary
		printSummary(result, logger);

		// Print detailed differences
		await printDetailedDifferencesWithContent(result, paths, options, logger);

		// Print final result
		printFinalResult(result, logger);

		return result.same;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		logger.error({ error: errorMessage }, 'Error comparing directories');
		throw new Error(`Error comparing directories: ${errorMessage}`);
	}
}

/**
 * Print detailed differences with optional content comparison
 */
async function printDetailedDifferencesWithContent(
	result: CompareResult,
	paths: DirectoryPaths,
	options: DiffOptions,
	logger: Logger
): Promise<void> {
	if (result.same) {
		logger.debug('Directories are identical, no details to print');
		return;
	}

	if (options.summaryOnly) {
		logger.debug('Summary-only mode, skipping detailed output');
		printDetailedDifferences(result, paths, options, logger);
		return;
	}

	logger.debug('Showing detailed differences');

	const sortedDiffs = sortDifferences(result.diffSet);
	const differences = sortedDiffs.filter(diff => diff.state !== 'equal');

	if (differences.length === 0) {
		logger.info('No differences found');
		return;
	}

	logger.debug({ differenceCount: differences.length }, 'Processing differences');

	// Print each difference with optional content comparison
	for (const diff of differences) {
		await printSingleDifferenceWithContent(diff, paths, options, logger);
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
 * Print a single difference with optional content comparison
 */
async function printSingleDifferenceWithContent(
	diff: DiffItem,
	paths: DirectoryPaths,
	options: DiffOptions,
	logger: Logger
): Promise<void> {
	const relativePath = diff.relativePath || '';
	const fileName = diff.name1 || diff.name2 || '';
	const fullPath = relativePath ? path.join(relativePath, fileName) : fileName;

	if (!fullPath) {
		return; // Skip if no valid path
	}

	logger.debug({ fullPath, state: diff.state }, 'Processing difference');

	if (diff.state === 'left') {
		logger.debug({ dir: paths.dir1, path: fullPath }, 'File only in directory 1');
	} else if (diff.state === 'right') {
		logger.debug({ dir: paths.dir2, path: fullPath }, 'File only in directory 2');
	} else if (diff.state === 'distinct') {
		logger.debug({ path: fullPath }, 'File changed');

		// Show content differences if requested and both are files
		if (options.content && diff.type1 === 'file' && diff.type2 === 'file') {
			try {
				logger.debug({ fullPath }, 'Comparing file contents');
				const differences = compareFileContent(paths.dir1, paths.dir2, fullPath);
				printContentDifferences(differences, logger);
			} catch (error) {
				logger.warn({ fullPath, error: (error as Error).message }, 'Error comparing file contents');
				printContentError(fullPath, error as Error, logger);
			}
		}
	}
}
