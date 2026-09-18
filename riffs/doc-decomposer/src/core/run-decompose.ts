/**
 * Core decompose logic extracted for use by both CLI and TUI
 *
 * This module contains the main decomposition logic without any CLI framework
 * dependencies, allowing it to be imported without triggering argument parsing.
 */

import type { Logger } from 'pino';
import { loadConfig } from '../lib/config.js';
import { createLogger } from '../lib/logger.js';
import type { Config } from '../lib/types.js';
import { findAssetReferences } from '../utils/manage-assets.js';
import { readFile } from '../utils/utils.js';
import { calculateStatistics, generateStatisticsReport, getSummaryStats } from './calculate-stats.js';
import { extractRfpPairs, matchPairsWithMetadata } from './extract-pairs.js';
import { formatMarkdownFiles } from './format-output.js';
import { createOutputDirs, generateFiles } from './generate-files.js';
import { generateIndexFiles } from './index-requests.js';
import { getMetadataStats, parseMetadata } from './parse-metadata.js';

/**
 * Extended config with verbose flag
 */
export interface ExtendedConfig extends Config {
	verbose: boolean;
}

/**
 * Initialize logger with config and CLI verbose flag override
 */
function initLogger(verbose: boolean): Logger {
	const config = loadConfig();
	return createLogger({
		level: config.logging.level,
		verbose: verbose || config.logging.verbose,
		file: config.logging.file,
		maxFileSizeMb: config.logging.maxFileSizeMb,
		maxFiles: config.logging.maxFiles,
	});
}

/**
 * Run the decomposition process
 */
export async function runDecompose(config: ExtendedConfig): Promise<void> {
	const logger = initLogger(config.verbose);
	logger.debug({ config }, 'Configuration loaded');

	logger.info(
		{
			metadataFile: config.metadataFile,
			rfpFile: config.rfpFile,
			outputDir: config.outputDir,
		},
		'Starting RFP decomposition'
	);

	// Step 1: Parse metadata
	logger.debug({ metadataFile: config.metadataFile }, 'Parsing metadata file');
	const metadataLookup = await parseMetadata(config.metadataFile);
	const metaStats = getMetadataStats(metadataLookup);
	logger.info(
		{
			total: metaStats.total,
			categories: Object.keys(metaStats.byCategory),
			departments: Object.keys(metaStats.byDepartment),
			customCount: metaStats.customCount,
		},
		'Metadata parsed'
	);

	// Step 2: Extract RFP pairs
	logger.debug({ rfpFile: config.rfpFile }, 'Extracting RFP pairs');
	const rfpContent = await readFile(config.rfpFile);

	// Extract the main RFP title from the first heading
	const mainTitleMatch = rfpContent.match(/^#\s+(.+)$/m);
	const mainRfpTitle: string = mainTitleMatch?.[1] || 'RFP Document';

	const rfpPairs = extractRfpPairs(rfpContent);
	logger.info({ pairCount: rfpPairs.length, mainTitle: mainRfpTitle }, 'RFP pairs extracted');

	// Step 3: Match pairs with metadata
	logger.debug('Matching pairs with metadata');
	const matchedPairs = matchPairsWithMetadata(rfpPairs, metadataLookup, logger);

	// Filter out pairs without metadata
	const validPairs = matchedPairs.filter(p => p.Category && p.Department);
	const skippedCount = matchedPairs.length - validPairs.length;

	if (skippedCount > 0) {
		logger.warn({ skippedCount }, 'Pairs skipped due to missing metadata');
	}
	logger.info({ matchedCount: validPairs.length, skippedCount }, 'Pairs matched with metadata');

	// Step 4: Find asset references
	logger.debug('Finding asset references');
	const assetRefs = findAssetReferences(rfpContent, config.rfpFile);
	logger.info({ assetCount: Object.keys(assetRefs).length }, 'Asset references found');

	// Step 5: Create output directory structure
	logger.debug({ outputDir: config.outputDir }, 'Creating output directory structure');
	await createOutputDirs(validPairs, config.outputDir);
	logger.info({ outputDir: config.outputDir }, 'Directory structure created');

	// Step 6: Generate files
	logger.debug('Generating individual response files');
	await generateFiles(validPairs, rfpContent, config.outputDir, assetRefs, mainRfpTitle, logger);
	logger.info({ fileCount: validPairs.length }, 'Response files generated');

	// Step 7: Generate index files
	logger.debug('Generating index files');
	await generateIndexFiles(validPairs, config.outputDir, config.descriptionsDir);
	logger.info('Index files generated');

	// Step 8: Generate statistics
	logger.debug('Generating statistics report');
	await generateStatisticsReport(validPairs, config.outputDir);
	const stats = calculateStatistics(validPairs);
	logger.info({ stats }, 'Statistics report generated');

	// Step 9: Format markdown files
	logger.debug({ outputDir: config.outputDir }, 'Formatting markdown files');
	await formatMarkdownFiles(config.outputDir, logger);
	logger.info('Markdown formatting complete');

	logger.info({ summary: getSummaryStats(stats) }, 'Summary statistics');

	logger.info(
		{ outputDir: config.outputDir, totalPairs: validPairs.length },
		'RFP decomposition completed successfully'
	);
}
