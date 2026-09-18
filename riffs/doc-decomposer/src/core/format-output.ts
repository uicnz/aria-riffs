/**
 * Markdown formatter using markdownlint
 */

import { applyFixes } from 'markdownlint';
import { lint } from 'markdownlint/promise';
import type { Logger } from 'pino';
import { getFiles, readFile, writeFile } from '../utils/utils.js';

/**
 * Format all markdown files in the output directory
 */
export async function formatMarkdownFiles(outputDir: string, logger: Logger): Promise<void> {
	logger.debug({ outputDir }, 'Formatting markdown files');

	// Get all markdown files
	const mdFiles = await getFiles(outputDir, /\.md$/);

	// Use default configuration - same as markdownlint-cli2 --fix
	const config = {
		default: true,
	};

	let fixedCount = 0;

	// Process each file
	for (const file of mdFiles) {
		const content = await readFile(file);

		// Lint and get results
		const results = await lint({
			strings: { [file]: content },
			config,
		});

		// Check if there are fixable errors
		const errors = results[file] || [];
		const fixableErrors = errors.filter(error => typeof error === 'object' && error !== null && 'fixInfo' in error);

		if (fixableErrors.length > 0) {
			// Apply fixes
			const fixed = applyFixes(content, errors);

			if (fixed !== content) {
				await writeFile(file, fixed);
				fixedCount++;
			}
		}
	}

	if (fixedCount > 0) {
		logger.info({ fixedCount }, 'Fixed formatting in markdown files');
	}
}
