/**
 * File generator for RFP decomposed documents
 */

import path from 'node:path';
import type { Logger } from 'pino';
import { RESPONSE_TEMPLATES } from '../lib/config.js';
import type { AssetReferences, MatchedPair } from '../lib/types.js';
import { copyAsset, findReferencedAssets, updateAssetPaths } from '../utils/manage-assets.js';
import { ensureDirectory, ensureTrailingNewline, toKebabCase, writeFile } from '../utils/utils.js';

/**
 * Generate all RFP response files
 */
export async function generateFiles(
	matchedPairs: MatchedPair[],
	rfpContent: string,
	outputDir: string,
	assetRefs: AssetReferences,
	mainRfpTitle: string,
	logger: Logger
): Promise<void> {
	for (const pair of matchedPairs) {
		if (!pair.Category || !pair.Department) {
			logger.warn({ identifier: pair.Identifier }, 'Skipping pair - missing category or department');
			continue;
		}

		await generateFile(pair, rfpContent, outputDir, assetRefs, mainRfpTitle, logger);
	}
}

/**
 * Generate a single RFP response file
 */
export async function generateFile(
	pair: MatchedPair,
	rfpContent: string,
	outputDir: string,
	assetRefs: AssetReferences,
	mainRfpTitle: string,
	logger: Logger
): Promise<void> {
	const {
		Title,
		Identifier,
		Priority,
		Category,
		Department,
		Leader,
		Customise,
		importantBlock,
		Request,
		Response,
		Description,
		contentRange,
	} = pair;

	// Create the file path - use descriptive title for filename if available
	const fileNameBase = toKebabCase(Description || Title);
	const fileName = `${Identifier}-${fileNameBase}.md`;
	const filePath = path.join(outputDir, Category, Department, fileName);

	// Extract the full content for this pair to find asset references
	const pairFullContent = rfpContent.substring(contentRange.start, contentRange.end);

	// Find assets referenced in this content section
	const referencedAssets = findReferencedAssets(pairFullContent, assetRefs);

	// Copy assets and build path mappings
	const assetMappings = new Map<string, string>();
	for (const assetInfo of referencedAssets) {
		const result = await copyAsset(assetInfo, path.join(outputDir, Category, Department), Identifier);

		if (result.success && result.newPath) {
			assetMappings.set(assetInfo.originalPath, result.newPath);
			// Also map by filename in case it's referenced that way
			assetMappings.set(assetInfo.assetName, result.newPath);
		} else {
			logger.error({ asset: assetInfo.assetName, error: result.error }, 'Error copying asset');
		}
	}

	// Update request and response content with new asset paths
	const processedRequest = updateAssetPaths(Request.trim(), assetMappings);
	const processedResponse = updateAssetPaths(Response.trim(), assetMappings);

	// Create display title: descriptive title from metadata + main RFP title
	const displayTitle = Description ? `${Description} - ${mainRfpTitle}` : `${Title} - ${mainRfpTitle}`;

	// Build the file content
	const content = buildFileContent({
		displayTitle,
		Department,
		Identifier,
		Description,
		Priority,
		Category,
		Leader,
		Customise,
		importantBlock,
		processedRequest,
		processedResponse,
	});

	// Write the file
	await writeFile(filePath, content);
}

/**
 * Build the markdown content for a file
 */
function buildFileContent(params: {
	displayTitle: string;
	Department: string;
	Identifier: string;
	Description?: string;
	Priority: string;
	Category: string;
	Leader: string;
	Customise: boolean;
	importantBlock: string;
	processedRequest: string;
	processedResponse: string;
}): string {
	const {
		displayTitle,
		Department,
		Identifier,
		Description,
		Priority,
		Category,
		Leader,
		Customise,
		importantBlock,
		processedRequest,
		processedResponse,
	} = params;

	// Use category value directly
	const displayCategory = Category;

	const contentParts = [
		`# ${displayTitle}`,
		'',
		`[← Back to ${Department} Department Index](../README.md)`,
		'',
		'> [!TIP]',
		'> Metadata:',
		'>',
		`> - Identifier: \`${Identifier}\``,
		`> - Description: \`${Description ?? 'N/A'}\``,
		`> - Priority: \`${Priority}\``,
		`> - Category: \`${displayCategory}\``,
		`> - Department: \`${Department}\``,
		`> - Leader: \`${Leader}\``,
		`> - Customise: \`${Customise ? 'yes' : 'no'}\``,
		'',
		'## Request',
		'',
		importantBlock,
		'',
		processedRequest,
		'',
		'### Response',
		'',
		'> [!NOTE]',
		'>',
		`> - ${RESPONSE_TEMPLATES.companyName} ${RESPONSE_TEMPLATES.complianceStatement}`,
		`> - See ${RESPONSE_TEMPLATES.companyName} response to ${Identifier}`,
		'',
		processedResponse,
	];

	return ensureTrailingNewline(contentParts.join('\n'));
}

/**
 * Create output directory structure
 */
export async function createOutputDirs(matchedPairs: MatchedPair[], outputDir: string): Promise<void> {
	// Create the main output directory
	await ensureDirectory(outputDir);

	// Get unique categories and departments
	const categories = [...new Set(matchedPairs.map(p => p.Category).filter(Boolean))];

	for (const category of categories) {
		const categoryDir = path.join(outputDir, category);
		await ensureDirectory(categoryDir);

		// Get departments for this category
		const departments = [
			...new Set(
				matchedPairs
					.filter(p => p.Category === category)
					.map(p => p.Department)
					.filter(Boolean)
			),
		];

		for (const department of departments) {
			const departmentDir = path.join(categoryDir, department);
			await ensureDirectory(departmentDir);

			// Create assets directory
			const assetsDir = path.join(departmentDir, 'assets');
			await ensureDirectory(assetsDir);
		}
	}
}
