import * as fs from 'node:fs/promises';
import path from 'node:path';
import { glob } from 'glob';
import { DatabaseManager } from '../db/database.js';
import type {
	Database,
	DocIndexer,
	DocumentMetadata,
	EmbeddingProvider,
	IndexerConfig,
	Logger,
	SqliteConnection,
} from '../lib/types.js';
import {
	EmbeddingService,
	type EmbeddingServiceConfig,
	type UnifiedEmbeddingConfig,
} from '../providers/embedding-client.js';
import { parseFrontmatter } from './frontmatter-parser.js';

/**
 * Represents a child chunk extracted from a parent section
 */
interface ChildChunk {
	heading: string; // The H3 heading text
	content: string; // The content under this heading
	startLine: number; // Line number where this chunk starts
	endLine: number; // Line number where this chunk ends
}

/**
 * Extract the title from H2 heading in markdown content
 */
function parseTitle(md: string): string | undefined {
	const m = md.match(/^#\s+(.+)$/m);
	return m?.[1]?.trim();
}

/**
 * Extract the parent section title (H2) from content
 */
function parseParentTitle(md: string): string | undefined {
	const m = md.match(/^##\s+(.+)$/m);
	return m?.[1]?.trim();
}

/**
 * Split content into child chunks at H3 boundaries.
 * Returns the children and whether the parent has meaningful subsections.
 *
 * A section is split if:
 * - It contains at least 2 H3 headings
 * - Each H3 section has meaningful content (not just a heading)
 */
function splitIntoChildren(content: string): ChildChunk[] {
	const lines = content.split('\n');
	const h3Regex = /^###\s+(.+)$/;
	const children: ChildChunk[] = [];

	let currentHeading: string | null = null;
	let currentContent: string[] = [];
	let currentStartLine = 0;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i] ?? '';
		const match = h3Regex.exec(line);

		if (match) {
			// Save previous chunk if exists
			if (currentHeading !== null && currentContent.length > 0) {
				const trimmedContent = currentContent.join('\n').trim();
				if (trimmedContent.length > 50) {
					// Only keep chunks with meaningful content
					children.push({
						heading: currentHeading,
						content: trimmedContent,
						startLine: currentStartLine,
						endLine: i - 1,
					});
				}
			}

			// Start new chunk
			currentHeading = match[1]?.trim() ?? '';
			currentContent = [];
			currentStartLine = i;
		} else if (currentHeading !== null) {
			// Add line to current chunk
			currentContent.push(line);
		}
	}

	// Save final chunk
	if (currentHeading !== null && currentContent.length > 0) {
		const trimmedContent = currentContent.join('\n').trim();
		if (trimmedContent.length > 50) {
			children.push({
				heading: currentHeading,
				content: trimmedContent,
				startLine: currentStartLine,
				endLine: lines.length - 1,
			});
		}
	}

	// Only return children if we have at least 2 meaningful subsections
	return children.length >= 2 ? children : [];
}

/**
 * Build a hierarchy path for contextual embedding.
 * Example: "Health and Safety Guide > Equipment and Guidelines > Dunedin"
 */
function buildHierarchyPath(parentTitle: string | undefined, childHeading: string): string {
	const parts: string[] = [];
	if (parentTitle) parts.push(parentTitle);
	parts.push(childHeading);
	return parts.join(' > ');
}

/**
 * Convert a file path to searchable text by extracting meaningful terms.
 * Transforms "policies/leave/annual-leave.md" -> "policies leave annual leave"
 */
function pathToSearchText(filePath: string): string {
	return filePath
		.replace(/\.md$/i, '') // Remove .md extension
		.split(/[/\\]/) // Split on path separators
		.map(segment =>
			segment
				.replace(/[-_]/g, ' ') // Replace dashes/underscores with spaces
				.replace(/\d+[-_]?/g, '') // Remove leading numbers (e.g., "01-intro" -> "intro")
				.trim()
		)
		.filter(segment => segment.length > 0) // Remove empty segments
		.join(' ');
}

function stripMarkdown(md: string): string {
	return (
		md
			// code fences
			.replace(/```[\s\S]*?```/g, ' ')
			// inline code
			.replace(/`([^`]*)`/g, '$1')
			// images ![alt](url)
			.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
			// links [text](url) -> text
			.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
			// strip admonition markers like [!IMPORTANT], [!NOTE], [!TIP]
			.replace(/\[![^\]]+\]/g, '')
			// drop blockquote markers
			.replace(/^>\s*/gm, '')
			// remove leading heading markers
			.replace(/^\s*#{1,6}\s*/gm, '')
			// remove list bullets
			.replace(/^\s*[-*+]\s+/gm, '')
			// normalize whitespace
			.replace(/[\t\r\f]+/g, ' ')
			.replace(/\s{2,}/g, ' ')
			.replace(/\s*\n\s*/g, ' ')
			.trim()
	);
}

export interface DocIndexerConfig extends Partial<IndexerConfig> {
	embeddingConfig: UnifiedEmbeddingConfig;
}

export class DocIndexerImpl implements DocIndexer {
	private logger: Logger;
	private dbManager: Database;
	private embeddingService: EmbeddingProvider;
	private config: IndexerConfig;

	constructor(
		logger: Logger,
		dbFile: string,
		config: DocIndexerConfig,
		dbManager?: Database,
		embeddingService?: EmbeddingProvider
	) {
		this.logger = logger;
		const defaultConfig: IndexerConfig = {
			model: config.embeddingConfig.model,
			dimensions: config.embeddingConfig.dimensions,
			maxEmbedChars: config.maxEmbedChars ?? 20000,
			sections: config.sections ?? 'both',
			weightResponse: config.weightResponse ?? 1.8,
			useFts: config.useFts ?? true,
			hybrid: config.hybrid ?? true,
			alpha: config.alpha ?? 0.1,
			pathWeight: config.pathWeight ?? 0.15,
			showMetadata: config.showMetadata ?? true,
			highlight: config.highlight ?? true,
			snippetContextLines: config.snippetContextLines ?? 2,
			maxSnippetLength: config.maxSnippetLength ?? 150,
			// NOTE: highlightColor removed - TUI uses semantic theme colors, CLI uses Pino
		};

		this.config = { ...defaultConfig };
		this.dbManager = dbManager ?? new DatabaseManager(dbFile, this.config.useFts);

		const embeddingServiceConfig: EmbeddingServiceConfig = {
			embeddingConfig: config.embeddingConfig,
			maxChars: config.maxEmbedChars ?? 20000,
			batchSize: 64,
		};
		this.embeddingService = embeddingService ?? new EmbeddingService(embeddingServiceConfig);
	}

	private buildMetadata(filePath: string, content: string, _baseDir: string): DocumentMetadata {
		const relativePath = path.relative(process.cwd(), filePath);
		const parts = relativePath.split(path.sep);
		// Use last 3 path components as relevant path
		const relevant = parts.slice(-3);

		const title = parseTitle(content);
		const frontmatter = parseFrontmatter(content);

		const metadata: DocumentMetadata = {
			id: path.basename(filePath, '.md'),
			relative_path: relevant.join('/'),
			full_path: filePath,
			indexed_at: new Date().toISOString(),
			embedding_model: this.config.model,
			dimensions: this.config.dimensions,
		};

		// Add optional fields only if they have values
		if (title) metadata.title = title;

		// Extract source metadata from frontmatter if available, otherwise use document path
		if (frontmatter) {
			metadata.source_path = frontmatter.source_file;
			metadata.source_lines = frontmatter.line_range;
		} else {
			// Fallback to document path if no frontmatter
			metadata.source_path = filePath;
		}

		return metadata;
	}

	async index(directory: string, reset: boolean): Promise<void> {
		this.dbManager.connect();
		try {
			if (reset) {
				this.dbManager.reset();
			}

			const files = await glob(path.join(directory, '**/*.md'), {
				ignore: ['**/assets/**', '**/node_modules/**'],
			});

			const contents: string[] = [];
			const embedTexts: string[] = [];
			const metadatas: DocumentMetadata[] = [];
			const ids: string[] = [];
			const parentIds: (string | null)[] = [];
			const hierarchyPaths: (string | null)[] = [];

			let totalParents = 0;
			let totalChildren = 0;

			for (const [i, file] of files.entries()) {
				const content = await fs.readFile(file, 'utf-8');
				if (!content.trim()) continue;

				const md = this.buildMetadata(file, content, directory);
				const parentId = `${md.id}_${i}`;
				const parentTitle = parseParentTitle(content) || md.title;

				// Check if this document has H3 subsections that should be split
				const children = splitIntoChildren(content);

				if (children.length > 0) {
					// HIERARCHICAL MODE: Create both parent and child chunks

					// First, index the parent document (for context retrieval)
					contents.push(content);
					metadatas.push(md);
					ids.push(parentId);
					parentIds.push(null); // Parent has no parent
					hierarchyPaths.push(parentTitle ?? null);

					const parentEmbedParts: string[] = [];
					const pathText = pathToSearchText(md.relative_path);
					if (pathText) parentEmbedParts.push(`Path: ${pathText}`);
					if (md.title) parentEmbedParts.push(`# ${md.title}`);
					parentEmbedParts.push(stripMarkdown(content));
					embedTexts.push(parentEmbedParts.join('\n\n').slice(0, this.config.maxEmbedChars));
					totalParents++;

					// Then, index each child chunk with contextual embedding
					for (const [childIdx, child] of children.entries()) {
						const childId = `${parentId}_child_${childIdx}`;
						const hierarchyPath = buildHierarchyPath(parentTitle, child.heading);

						// Build child metadata
						const childMetadata: DocumentMetadata = {
							...md,
							id: childId,
							title: child.heading,
						};
						// Only set source_lines if parent has them
						if (md.source_lines) {
							childMetadata.source_lines = [
								md.source_lines[0] + child.startLine,
								md.source_lines[0] + child.endLine,
							];
						}

						// Build contextual embedding text
						// KEY: Prepend hierarchy path so the embedding understands context
						const childEmbedParts: string[] = [];
						childEmbedParts.push(`Context: ${hierarchyPath}`);
						if (pathText) childEmbedParts.push(`Path: ${pathText}`);
						childEmbedParts.push(`### ${child.heading}`);
						childEmbedParts.push(stripMarkdown(child.content));

						const childContent = `### ${child.heading}\n\n${child.content}`;

						contents.push(childContent);
						metadatas.push(childMetadata);
						ids.push(childId);
						parentIds.push(parentId);
						hierarchyPaths.push(hierarchyPath);
						embedTexts.push(childEmbedParts.join('\n\n').slice(0, this.config.maxEmbedChars));
						totalChildren++;
					}
				} else {
					// FLAT MODE: No subsections, index as single document
					contents.push(content);
					metadatas.push(md);
					ids.push(parentId);
					parentIds.push(null);
					hierarchyPaths.push(md.title ?? null);

					const embedTextParts: string[] = [];
					const pathText = pathToSearchText(md.relative_path);
					if (pathText) embedTextParts.push(`Path: ${pathText}`);
					if (md.title) embedTextParts.push(`# ${md.title}`);
					embedTextParts.push(stripMarkdown(content));
					embedTexts.push(embedTextParts.join('\n\n').slice(0, this.config.maxEmbedChars));
					totalParents++;
				}
			}

			const embeddings = await this.embeddingService.embedAll(embedTexts);

			this.dbManager.insertDocuments(
				ids,
				contents,
				embeddings,
				metadatas,
				embedTexts,
				(embedding: number[]) => this.embeddingService.vectorToBuffer(embedding),
				parentIds,
				hierarchyPaths
			);

			this.logger.info(
				{ totalDocuments: ids.length, parents: totalParents, children: totalChildren },
				'Indexed documents with hierarchical chunking'
			);
		} finally {
			this.dbManager.close();
		}
	}

	withDatabase<T>(fn: (db: SqliteConnection) => T | Promise<T>): T | Promise<T> {
		return this.dbManager.withConnection(fn);
	}

	getEmbeddingService() {
		return this.embeddingService;
	}

	getConfig() {
		return this.config;
	}
}
