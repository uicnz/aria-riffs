import { readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import type { Logger } from 'pino';
import type { HrStafferDatabase } from '../db/database.js';

/**
 * Document metadata for indexing
 */
export interface DocumentMetadata {
	id: string;
	relative_path: string;
	title: string | undefined;
	indexed_at: string;
	source_path: string;
	source_lines?: [number, number];
	department?: string;
	job_title?: string;
	manager?: string;
	city?: string;
	country?: string;
}

/**
 * Extract YAML frontmatter from markdown content.
 * Returns parsed object or undefined if no frontmatter.
 */
function parseFrontmatter(content: string): Record<string, unknown> | undefined {
	const match = content.match(/^---\n([\s\S]*?)\n---/);
	if (!match) return undefined;

	// Simple YAML parsing for our known fields
	const yaml = match[1];
	const result: Record<string, unknown> = {};

	for (const line of yaml.split('\n')) {
		const colonIndex = line.indexOf(':');
		if (colonIndex === -1) continue;

		const key = line.slice(0, colonIndex).trim();
		let value: unknown = line.slice(colonIndex + 1).trim();

		// Parse arrays like [10, 25]
		if (typeof value === 'string' && value.startsWith('[') && value.endsWith(']')) {
			value = JSON.parse(value);
		}

		result[key] = value;
	}

	return result;
}

/**
 * Build document metadata from file path and content.
 */
export function buildMetadata(filePath: string, content: string): DocumentMetadata {
	const filename = basename(filePath);
	const id = filename.replace(/\.md$/, '');

	// Get last 3 path components for relative_path
	const parts = filePath.split('/');
	const relativePath = parts.slice(-3).join('/');

	// Extract source info from frontmatter if present
	const frontmatter = parseFrontmatter(content);
	const sourcePath = (frontmatter?.['source_file'] as string) ?? filePath;
	const sourceLines = frontmatter?.['line_range'] as [number, number] | undefined;

	// Extract staff fields from content
	const staffFields = extractStaffFields(content);

	const metadata: DocumentMetadata = {
		id,
		relative_path: relativePath,
		title: parseTitle(content),
		indexed_at: new Date().toISOString(),
		source_path: sourcePath,
		...staffFields,
	};

	if (sourceLines !== undefined) {
		metadata.source_lines = sourceLines;
	}

	return metadata;
}

/**
 * Extract the first H1 title from markdown content.
 * Returns undefined if no H1 is found.
 */
export function parseTitle(md: string): string | undefined {
	const match = md.match(/^# (.+)$/m);
	return match ? match[1] : undefined;
}

/**
 * Extract staff fields from markdown content.
 * Parses lines like "- Department: Business Operations" or "- Title: Head of AI"
 */
function extractStaffFields(content: string): {
	department?: string;
	job_title?: string;
	manager?: string;
	city?: string;
	country?: string;
} {
	const fields: ReturnType<typeof extractStaffFields> = {};

	// Match patterns like "- Department: Business Operations"
	const departmentMatch = content.match(/^-\s*Department:\s*(.+)$/m);
	if (departmentMatch) fields.department = departmentMatch[1].trim();

	const titleMatch = content.match(/^-\s*Title:\s*(.+)$/m);
	if (titleMatch) fields.job_title = titleMatch[1].trim();

	const managerMatch = content.match(/^-\s*Manager:\s*(.+)$/m);
	if (managerMatch) fields.manager = managerMatch[1].trim();

	const cityMatch = content.match(/^-\s*City:\s*(.+)$/m);
	if (cityMatch) fields.city = cityMatch[1].trim();

	const countryMatch = content.match(/^-\s*Country:\s*(.+)$/m);
	if (countryMatch) fields.country = countryMatch[1].trim();

	return fields;
}

/**
 * Embedding provider interface for dependency injection.
 */
export interface EmbeddingProvider {
	embedSingle(text: string): Promise<Float32Array>;
	getModelName(): string;
}

/**
 * Options for indexSections function.
 */
export interface IndexSectionsOptions {
	sectionsDir: string;
	db: HrStafferDatabase;
	embeddingService: EmbeddingProvider;
	logger: Logger;
	reset?: boolean;
	maxEmbedChars?: number;
}

/**
 * Result from indexSections function.
 */
export interface IndexSectionsResult {
	documentCount: number;
}

/**
 * Index all markdown section files in a directory.
 * Reads each .md file, generates embeddings, and stores in database.
 */
export async function indexSections(options: IndexSectionsOptions): Promise<IndexSectionsResult> {
	const { sectionsDir, db, embeddingService, logger, reset = false, maxEmbedChars = 20000 } = options;

	if (reset) {
		db.resetDocuments();
	}

	// Read all .md files from sections directory
	const files = readdirSync(sectionsDir).filter(f => f.endsWith('.md'));

	let documentCount = 0;

	for (const file of files) {
		const filePath = join(sectionsDir, file);
		const content = readFileSync(filePath, 'utf-8');

		// Skip empty files
		if (content.trim().length === 0) {
			continue;
		}

		// Build metadata
		const metadata = buildMetadata(filePath, content);

		// Log before embedding
		logger.info({ file }, 'Processing file for embedding');

		// Prepare text for embedding (truncate if needed)
		const textForEmbedding = content.length > maxEmbedChars ? content.slice(0, maxEmbedChars) : content;

		if (content.length > maxEmbedChars) {
			logger.warn({ file, originalLength: content.length, limit: maxEmbedChars }, 'Embedding text truncated');
		}

		// Generate embedding
		const embedding = await embeddingService.embedSingle(textForEmbedding);

		// Insert into database
		db.insertDocument(metadata.id, content, embedding, metadata as unknown as Record<string, unknown>);

		// Insert into FTS if table exists
		if (db.tableExists('documents_fts')) {
			db.insertDocumentFts(metadata.id, content);
		}

		documentCount++;
	}

	// Record index metadata
	const modelName = embeddingService.getModelName();
	db.recordIndexMetadata(sectionsDir, documentCount, modelName);

	logger.info({ sectionsDir, documentCount, modelName }, 'Indexing complete');

	return { documentCount };
}
