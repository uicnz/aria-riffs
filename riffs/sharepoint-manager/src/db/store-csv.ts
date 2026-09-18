/**
 * CSV file operations for SharePoint data
 */

import * as fs from 'node:fs';
import path from 'node:path';
import csv from 'csv-parser';
import type { FileRecord } from '../lib/types.js';
import { createObjectCsvWriter } from './csv-writer-wrapper.js';

/**
 * Load records from CSV file
 */
export async function loadRecords(csvPath: string): Promise<FileRecord[]> {
	return new Promise((resolve, reject) => {
		const records: FileRecord[] = [];

		fs.createReadStream(csvPath)
			.pipe(csv())
			.on('data', data => {
				records.push(data as FileRecord);
			})
			.on('end', () => resolve(records))
			.on('error', reject);
	});
}

/**
 * Save records to CSV file
 */
export async function saveRecords(csvPath: string, records: FileRecord[]): Promise<void> {
	// Ensure directory exists
	const dir = path.dirname(csvPath);
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true });
	}

	const csvWriter = await createObjectCsvWriter({
		path: csvPath,
		header: [
			{ id: 'name', title: 'name' },
			{ id: 'path', title: 'path' },
			{ id: 'full_path', title: 'full_path' },
			{ id: 'file_extension', title: 'file_extension' },
			{ id: 'download_link', title: 'download_link' },
			{ id: 'directory_view_link', title: 'directory_view_link' },
			{ id: 'web_view_link', title: 'web_view_link' },
			{ id: 'web_view_status', title: 'web_view_status' },
			{ id: 'error_message', title: 'error_message' },
			{ id: 'resource_id', title: 'resource_id' },
			{ id: 'extraction_method', title: 'extraction_method' },
			{ id: 'parent_resource_id', title: 'parent_resource_id' },
			{ id: 'etag', title: 'etag' },
			{ id: 'size_mb', title: 'size_mb' },
			{ id: 'modified', title: 'modified' },
		],
		fieldDelimiter: ',',
		recordDelimiter: '\n',
		alwaysQuote: false,
	});

	await csvWriter.writeRecords(records);
}

/**
 * Check if CSV file exists
 */
export function csvExists(csvPath: string): boolean {
	return fs.existsSync(csvPath);
}
