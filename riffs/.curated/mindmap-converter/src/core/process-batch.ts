/**
 * Batch processing logic for mindmap conversion
 */

import * as path from 'node:path';
import { glob } from 'glob';
import type { Logger } from 'pino';
import type { DatabaseManager } from '../db/database.js';
import type { MindmapConverterConfig, MindmapNode, MindmapRecord } from '../lib/types.js';
import { detectFormat, readFile, writeFile } from '../utils/utils.js';
import { convertToMarkdown } from './convert-markdown.js';
import { parseMindMap } from './parse-mm.js';
import { parseOpml } from './parse-opml.js';

/**
 * Count total nodes in a mindmap hierarchy
 */
function countNodes(node: MindmapNode): number {
	let count = 1; // Count current node

	for (const child of node.children) {
		count += countNodes(child);
	}

	return count;
}

/**
 * Scan directory for mindmap files
 */
export async function scanDirectory(directory: string): Promise<string[]> {
	const patterns = [path.join(directory, '**/*.opml'), path.join(directory, '**/*.mm')];

	const files: string[] = [];

	for (const pattern of patterns) {
		const matches = await glob(pattern, { nodir: true });
		files.push(...matches);
	}

	return files.sort();
}

/**
 * Process a single mindmap file and save to database
 */
export async function processMindmap(
	filePath: string,
	config: MindmapConverterConfig,
	dbManager: DatabaseManager,
	logger: Logger,
	options?: {
		outputDirectory?: string;
		preserveStructure?: boolean;
		saveToDatabase?: boolean;
	}
): Promise<void> {
	const saveToDb = options?.saveToDatabase ?? true;
	const riff = config['mindmap-converter'];

	try {
		logger.debug({ filePath }, 'Processing mindmap');

		const content = await readFile(filePath);
		const format = detectFormat(filePath);

		const parseResult = format === 'opml' ? parseOpml(content) : parseMindMap(content);

		const nodeCount = countNodes(parseResult.root);
		const title = parseResult.metadata?.title || path.basename(filePath, path.extname(filePath));

		// Convert to Markdown
		const markdown = convertToMarkdown(parseResult.root, {
			maxHeadingLevel: riff.conversion.maxHeadingLevel,
			useBulletPoints: riff.conversion.useBulletPoints,
			preserveHierarchy: riff.conversion.preserveHierarchy,
		});

		// Determine output path
		let outputPath: string | undefined;

		if (options?.outputDirectory) {
			const relativePath = options.preserveStructure
				? path.relative(riff.paths.input.dir, filePath)
				: path.basename(filePath);

			const outputName = path.basename(relativePath, path.extname(relativePath)) + riff.output.fileExtension;
			outputPath = path.join(options.outputDirectory, path.dirname(relativePath), outputName);

			await writeFile(outputPath, markdown);

			logger.debug({ outputPath }, 'Markdown written');
		}

		// Save to database
		if (saveToDb) {
			const record: Omit<MindmapRecord, 'id' | 'created_at' | 'updated_at'> = {
				file_path: filePath,
				format,
				title,
				node_count: nodeCount,
				content_json: JSON.stringify(parseResult.root),
				status: 'completed',
			} as Omit<MindmapRecord, 'id' | 'created_at' | 'updated_at'>;

			if (outputPath) {
				record.converted_path = outputPath;
			}

			await dbManager.saveMindmap(record);

			logger.debug({ filePath }, 'Saved to database');
		}

		logger.info({ filePath, title, nodeCount, outputPath }, 'Mindmap processed successfully');
	} catch (error) {
		logger.error({ filePath, error: (error as Error).message }, 'Failed to process mindmap');

		if (saveToDb) {
			try {
				const record: Omit<MindmapRecord, 'id' | 'created_at' | 'updated_at'> = {
					file_path: filePath,
					format: 'opml', // Default
					node_count: 0,
					content_json: '{}',
					status: 'failed',
					error_message: (error as Error).message,
				};

				await dbManager.saveMindmap(record);
			} catch (dbError) {
				logger.error({ filePath, error: (dbError as Error).message }, 'Failed to save error to database');
			}
		}

		throw error;
	}
}

/**
 * Process batch of mindmap files
 */
export async function processBatch(
	files: string[],
	config: MindmapConverterConfig,
	dbManager: DatabaseManager,
	logger: Logger,
	options?: {
		outputDirectory?: string;
		preserveStructure?: boolean;
	}
): Promise<{ completed: number; failed: number }> {
	let completed = 0;
	let failed = 0;

	const riff = config['mindmap-converter'];
	const batchSize = riff.batch.batchSize;
	const saveInterval = riff.batch.saveInterval;

	logger.info({ total: files.length, batchSize }, 'Starting batch processing');

	for (let i = 0; i < files.length; i++) {
		const file = files[i];
		if (!file) continue;

		try {
			const processOptions: Parameters<typeof processMindmap>[4] = {
				preserveStructure: options?.preserveStructure ?? riff.batch.preserveStructure,
				saveToDatabase: true,
			};

			if (options?.outputDirectory) {
				processOptions.outputDirectory = options.outputDirectory;
			}

			await processMindmap(file, config, dbManager, logger, processOptions);

			completed++;

			// Progress update
			if ((i + 1) % saveInterval === 0) {
				logger.info({ processed: i + 1, total: files.length, completed, failed }, 'Batch progress checkpoint');
			}
		} catch (_error) {
			failed++;
			// Error already logged in processMindmap
		}
	}

	logger.info({ total: files.length, completed, failed }, 'Batch processing completed');

	return { completed, failed };
}
