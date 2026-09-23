/**
 * Aria Image Alttext Processing Module - Main orchestration logic
 */

import * as fs from 'node:fs';
import path from 'node:path';
import type { Logger } from 'pino';
import type { FileContent, ProcessingOptions, ProcessingResult } from '../lib/types.js';

/**
 * Process a markdown file to add alt text from figure captions
 * Main entry point that orchestrates the entire process
 */
export async function processMarkdownFile(
	filePath: string,
	options: ProcessingOptions,
	logger: Logger
): Promise<ProcessingResult> {
	const resolvedPath = path.resolve(filePath);

	// Validate input
	if (!isMarkdownFile(resolvedPath)) {
		throw new Error(`File must be a markdown file (.md or .markdown): ${resolvedPath}`);
	}

	if (!validateFilePath(resolvedPath)) {
		throw new Error(`File not found or not accessible: ${resolvedPath}`);
	}

	// Show processing message
	if (options.verbose || !options.dryRun) {
		logger.debug({ filePath: resolvedPath }, `Processing file: ${resolvedPath}`);
	}

	// Read file content
	const content = readMarkdownFile(resolvedPath);

	// Process the content
	const result = processImageAltText(content, options.verbose, logger);

	if (result.hasChanges) {
		if (options.dryRun) {
			// Don't write, just show what would happen
			logger.info({ filePath: resolvedPath }, 'Changes would be made (dry run mode)');
		} else {
			// Write the updated content back to the file
			writeMarkdownFile(resolvedPath, result.processed);
		}

		return {
			matchCount: countMatches(result.processed, result.original),
			success: true,
			filePath: resolvedPath,
			changes: [],
		};
	} else {
		// No changes made - provide debugging info like original script
		logger.warn(
			{ filePath: resolvedPath },
			'No changes were made. Check if the pattern matches your document format'
		);

		if (options.verbose) {
			const analysis = analyzeImagePatterns(content);

			logger.debug({ filePath: resolvedPath }, 'Sample from file (first 100 lines):');
			logger.debug({ filePath: resolvedPath, sample: analysis.sampleContent }, 'File sample content');

			logger.debug(
				{ filePath: resolvedPath, totalImages: analysis.totalImages },
				`Attempting to find any image patterns... Found ${analysis.totalImages} images in total`
			);

			if (analysis.totalImages > 0) {
				logger.debug({ filePath: resolvedPath, sampleImages: analysis.sampleImages }, 'First 5 images found');
			}
		}

		return {
			matchCount: 0,
			success: true,
			filePath: resolvedPath,
			changes: [],
		};
	}
}

/**
 * Count the number of changes made by comparing processed vs original
 */
function countMatches(processed: string, original: string): number {
	// Count how many ![...] patterns were changed
	const originalEmpty = (original.match(/!\[\]\(/g) || []).length;
	const processedEmpty = (processed.match(/!\[\]\(/g) || []).length;
	return originalEmpty - processedEmpty;
}

/**
 * Regex pattern to find images without alt text followed by figure captions
 * This matches the exact same pattern as the original script:
 * 1. An image with empty alt text: ![](...)
 * 2. Followed by whitespace and newlines
 * 3. Then a figure caption (starting with "Figure X:")
 * 4. Until the next double newline or end of file
 */
const IMAGE_PATTERN = /!\[\]\((media\/image\d+\.(?:png|jpe?g|gif|emf))\)\s*\n\s*\n\s*(Figure\s+\d+:.*?)(?=\n\n|\n*$)/gs;

/**
 * Simple pattern to find any images for debugging
 */
const SIMPLE_IMAGE_PATTERN = /!\[.*?\]\(.*?\)/g;

/**
 * Process markdown content to add alt text from figure captions
 * Matches the exact logic from the original script
 */
function processImageAltText(content: string, verbose: boolean = false, logger?: Logger): FileContent {
	const originalContent = content;
	let matchCount = 0;

	// Replace each occurrence with the image including the figure caption as alt text
	const processedContent = content.replace(IMAGE_PATTERN, (_match, imagePath, caption) => {
		matchCount++;
		const cleanCaption = caption.trim();

		if (verbose && logger) {
			logger.debug(
				{ matchNumber: matchCount, imagePath, caption: cleanCaption },
				`Match #${matchCount}: ${imagePath}`
			);
		}

		return `![${cleanCaption}](${imagePath})\n\n${cleanCaption}`;
	});

	return {
		original: originalContent,
		processed: processedContent,
		hasChanges: processedContent !== originalContent,
	};
}

/**
 * Analyze content for debugging purposes - matches original script debug output
 */
function analyzeImagePatterns(content: string): {
	totalImages: number;
	sampleImages: string[];
	sampleContent: string;
} {
	const simpleMatches = content.match(SIMPLE_IMAGE_PATTERN) || [];
	const sampleLines = content.split('\n').slice(0, 100).join('\n');

	return {
		totalImages: simpleMatches.length,
		sampleImages: simpleMatches.slice(0, 5),
		sampleContent: sampleLines,
	};
}

/**
 * Read markdown file content
 */
function readMarkdownFile(filePath: string): string {
	try {
		return fs.readFileSync(filePath, 'utf8');
	} catch (error) {
		if (error instanceof Error) {
			throw new Error(`Failed to read file ${filePath}: ${error.message}`);
		}
		throw new Error(`Failed to read file ${filePath}: Unknown error`);
	}
}

/**
 * Write processed content back to file
 */
function writeMarkdownFile(filePath: string, content: string): void {
	try {
		fs.writeFileSync(filePath, content);
	} catch (error) {
		if (error instanceof Error) {
			throw new Error(`Failed to write file ${filePath}: ${error.message}`);
		}
		throw new Error(`Failed to write file ${filePath}: Unknown error`);
	}
}

/**
 * Check if file exists and is readable
 */
function validateFilePath(filePath: string): boolean {
	try {
		fs.accessSync(filePath, fs.constants.R_OK | fs.constants.W_OK);
		return true;
	} catch {
		return false;
	}
}

/**
 * Check if path is a markdown file
 */
function isMarkdownFile(filePath: string): boolean {
	return ['.md', '.markdown'].includes(path.extname(filePath).toLowerCase());
}
