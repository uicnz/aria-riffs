/**
 * File scanning and directory discovery functionality
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Logger } from 'pino';
import type { FileRecord } from '../lib/types.js';

/**
 * Recursively walk directory and yield file paths
 */
export async function* walkDirectory(dir: string): AsyncGenerator<string> {
	const entries = await fs.promises.readdir(dir, { withFileTypes: true });

	for (const entry of entries) {
		// Skip hidden files and directories
		if (entry.name.startsWith('.')) continue;

		const fullPath = path.join(dir, entry.name);

		if (entry.isDirectory()) {
			yield* walkDirectory(fullPath);
		} else if (entry.isFile()) {
			// Skip temporary files
			if (!entry.name.startsWith('~')) {
				yield fullPath;
			}
		}
	}
}

/**
 * Construct download link for a file
 */
export function constructDownloadLink(filePath: string, syncFolder: string, sharePointBase: string): string {
	const relativePath = path.relative(syncFolder, filePath);
	const encodedPath = relativePath.replace(/\//g, '%2F').replace(/ /g, '%20');
	return `${sharePointBase}/${encodedPath}`;
}

/**
 * Construct directory view link for a file
 */
export function constructDirectoryViewLink(filePath: string, syncFolder: string, sharePointBase: string): string {
	const fileDir = path.dirname(filePath);
	const relativeDir = path.relative(syncFolder, fileDir);
	const encodedForId = relativeDir.replace(/ /g, '%20').replace(/\//g, '%2F');

	// Extract the site path from sharePointBase
	const baseUrl = new URL(sharePointBase);
	const pathParts = baseUrl.pathname.split('/').filter(p => p);
	const sitePath = pathParts.slice(0, 2).join('/');
	const docsPath = pathParts.slice(2).join('/');

	const folderPath = `%2F${sitePath}%2F${docsPath}%2F${encodedForId}`;
	return `${baseUrl.origin}/${sitePath}/Shared%20Documents/Forms/AllItems.aspx?id=${folderPath}`;
}

/**
 * Perform initial scan of directory structure
 */
export async function scanFiles(syncFolder: string, sharePointBase: string, logger: Logger): Promise<FileRecord[]> {
	logger.info({ syncFolder }, 'Phase 1: Fast Initial Scan - Starting directory scan');

	const records: FileRecord[] = [];
	let fileCount = 0;

	for await (const filePath of walkDirectory(syncFolder)) {
		fileCount++;

		if (fileCount % 100 === 0) {
			logger.debug({ fileCount }, `Scanned ${fileCount} files...`);
		}

		const stats = await fs.promises.stat(filePath);
		const relativePath = path.relative(syncFolder, filePath);
		const fileExtension = path.extname(filePath).toLowerCase();

		const record: Partial<FileRecord> = {
			name: path.basename(filePath),
			path: relativePath,
			full_path: filePath,
			file_extension: fileExtension,
			download_link: constructDownloadLink(filePath, syncFolder, sharePointBase),
			directory_view_link: constructDirectoryViewLink(filePath, syncFolder, sharePointBase),
			web_view_link: '',
			web_view_status: 'pending',
			size_mb: Math.round((stats.size / (1024 * 1024)) * 100) / 100,
			modified: stats.mtime.toISOString(),
		};

		records.push(record as FileRecord);
	}

	// Sort by path
	records.sort((a, b) => a.path.localeCompare(b.path));

	logger.info({ totalFiles: records.length }, 'Initial scan complete');

	return records;
}
