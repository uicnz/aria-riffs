/**
 * JSONL export module for mindmap records
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { InputFormat, MindmapNode } from '../lib/types.js';

/**
 * JSONL record structure for mindmap export
 */
export interface JsonlMindmapRecord {
	file_path: string;
	format: InputFormat;
	title: string | undefined;
	node_count: number;
	tree: MindmapNode;
	exported_at: string;
}

/**
 * Count total nodes in a mindmap hierarchy
 */
function countNodes(node: MindmapNode): number {
	let count = 1;
	for (const child of node.children) {
		count += countNodes(child);
	}
	return count;
}

/**
 * Export mindmap to JSONL format (single line)
 */
export function convertToJsonl(tree: MindmapNode, filePath: string, format: InputFormat, title?: string): string {
	const nodeCount = countNodes(tree);

	const record: JsonlMindmapRecord = {
		file_path: filePath,
		format,
		title,
		node_count: nodeCount,
		tree,
		exported_at: new Date().toISOString(),
	};

	return JSON.stringify(record);
}

/**
 * Append JSONL record to file
 */
export async function appendToJsonl(jsonlPath: string, record: string): Promise<void> {
	// Ensure directory exists
	const dir = path.dirname(jsonlPath);
	await fs.mkdir(dir, { recursive: true });

	// Append record with newline
	await fs.appendFile(jsonlPath, `${record}\n`, 'utf-8');
}

/**
 * Read all records from JSONL file
 */
export async function readJsonl(jsonlPath: string): Promise<JsonlMindmapRecord[]> {
	try {
		const content = await fs.readFile(jsonlPath, 'utf-8');
		const lines = content
			.trim()
			.split('\n')
			.filter(line => line.length > 0);

		return lines.map(line => JSON.parse(line) as JsonlMindmapRecord);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
			return []; // File doesn't exist yet
		}
		throw error;
	}
}

/**
 * Search JSONL records by query
 */
export async function searchJsonl(jsonlPath: string, query: string): Promise<JsonlMindmapRecord[]> {
	const records = await readJsonl(jsonlPath);
	const lowerQuery = query.toLowerCase();

	return records.filter(record => {
		const titleMatch = record.title?.toLowerCase().includes(lowerQuery);
		const pathMatch = record.file_path.toLowerCase().includes(lowerQuery);
		const treeMatch = JSON.stringify(record.tree).toLowerCase().includes(lowerQuery);

		return titleMatch || pathMatch || treeMatch;
	});
}
