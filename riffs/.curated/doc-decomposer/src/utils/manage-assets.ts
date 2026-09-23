/**
 * Asset handling for RFP documents
 */

import path from 'node:path';
import { ASSET_DIRECTORY_NAMES, MIME_TYPES } from '../lib/config.js';
import type { AssetInfo, AssetReferences } from '../lib/types.js';
import { copyFile, ensureDirectory, fileExists } from './utils.js';

/**
 * Find all asset references in RFP content
 */
export function findAssetReferences(rfpContent: string, rfpFilePath: string): AssetReferences {
	const assetRefs: AssetReferences = {};
	const rfpDir = path.dirname(rfpFilePath);

	// Find all image references
	const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
	let match: RegExpExecArray | null;

	// biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex exec pattern
	while ((match = imageRegex.exec(rfpContent)) !== null) {
		const [, altText, assetPath] = match;

		if (assetPath && !assetPath.startsWith('http')) {
			// Resolve the full path
			const fullPath = path.isAbsolute(assetPath) ? assetPath : path.resolve(rfpDir, assetPath);

			const assetName = path.basename(fullPath);
			const ext = path.extname(fullPath).toLowerCase();
			const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

			assetRefs[assetPath] = {
				originalPath: assetPath,
				fullPath,
				assetName,
				mimeType,
				altText: altText || undefined, // Preserve alt text if provided
			};
		}
	}

	return assetRefs;
}

/**
 * Find asset directories in a given path
 */
export async function findAssetDirectories(basePath: string): Promise<string[]> {
	const assetDirs: string[] = [];

	for (const dirName of ASSET_DIRECTORY_NAMES) {
		const dirPath = path.join(basePath, dirName);
		if (await fileExists(dirPath)) {
			assetDirs.push(dirPath);
		}
	}

	// Also check parent directory
	const parentPath = path.dirname(basePath);
	for (const dirName of ASSET_DIRECTORY_NAMES) {
		const dirPath = path.join(parentPath, dirName);
		if (await fileExists(dirPath)) {
			assetDirs.push(dirPath);
		}
	}

	return assetDirs;
}

/**
 * Find assets referenced in a content section
 */
export function findReferencedAssets(content: string, assetRefs: AssetReferences): AssetInfo[] {
	const referencedAssets: AssetInfo[] = [];

	for (const [originalPath, assetInfo] of Object.entries(assetRefs)) {
		// Check if this asset is referenced in the content
		if (content.includes(originalPath) || content.includes(assetInfo.assetName)) {
			referencedAssets.push(assetInfo);
		}
	}

	return referencedAssets;
}

/**
 * Copy asset to destination and return the new relative path
 */
export async function copyAsset(
	assetInfo: AssetInfo,
	destDir: string,
	identifier: string
): Promise<{ success: boolean; newPath?: string; error?: string }> {
	try {
		// Check if source file exists
		if (!(await fileExists(assetInfo.fullPath))) {
			// Try to find the asset in common directories
			const alternativePath = await findAssetAlternative(assetInfo);
			if (alternativePath) {
				assetInfo.fullPath = alternativePath;
			} else {
				return {
					success: false,
					error: `Asset not found: ${assetInfo.fullPath}`,
				};
			}
		}

		// Create destination path
		const assetDestDir = path.join(destDir, 'assets', identifier);
		await ensureDirectory(assetDestDir);

		const destPath = path.join(assetDestDir, assetInfo.assetName);

		// Copy the file
		await copyFile(assetInfo.fullPath, destPath);

		// Return the new relative path for use in markdown
		const newRelativePath = `assets/${identifier}/${assetInfo.assetName}`;

		return {
			success: true,
			newPath: newRelativePath,
		};
	} catch (error) {
		return {
			success: false,
			error: `Failed to copy asset: ${error}`,
		};
	}
}

/**
 * Try to find asset in alternative locations
 */
async function findAssetAlternative(assetInfo: AssetInfo): Promise<string | null> {
	// Common alternative paths to check
	const alternatives = [
		path.join('assets', assetInfo.assetName),
		path.join('images', assetInfo.assetName),
		path.join('media', assetInfo.assetName),
		path.join('..', 'assets', assetInfo.assetName),
		path.join('..', 'images', assetInfo.assetName),
	];

	for (const alt of alternatives) {
		if (await fileExists(alt)) {
			return alt;
		}
	}

	return null;
}

/**
 * Update content with new asset paths
 */
export function updateAssetPaths(content: string, assetMappings: Map<string, string>): string {
	let updatedContent = content;

	for (const [originalPath, newPath] of assetMappings) {
		// Replace all occurrences of the original path
		const regex = new RegExp(escapeRegex(originalPath), 'g');
		updatedContent = updatedContent.replace(regex, newPath);
	}

	return updatedContent;
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Extract asset paths from markdown content
 */
export function extractAssetPaths(content: string): string[] {
	const paths: string[] = [];
	const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
	let match: RegExpExecArray | null;

	// biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex exec pattern
	while ((match = imageRegex.exec(content)) !== null) {
		const assetPath = match[2];
		if (assetPath && !assetPath.startsWith('http')) {
			paths.push(assetPath);
		}
	}

	return paths;
}
