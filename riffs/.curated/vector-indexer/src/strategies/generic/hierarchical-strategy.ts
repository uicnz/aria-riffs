/**
 * Generic hierarchical chunking strategy
 * Chunks documents by markdown heading hierarchy with semantic boundaries
 *
 * Strategy: generic.hierarchical
 * Domain: generic (universal, works with any markdown)
 * Method: hierarchical (respects heading structure)
 *
 * This strategy consolidates logic from both chunker.ts and indexer.ts:
 * - Small document optimization (wholeDocumentThreshold)
 * - Markdown parsing and section extraction
 * - Hierarchical chunking with context preservation
 * - Optional title enrichment
 */

import type { Logger } from 'pino';
import { MarkdownParser } from '../../core/markdown-parser.js';
import { MetadataExtractor } from '../../core/metadata-extractor.js';
import type { Chunk, ChunkingConfig, GenericHierarchicalConfig, MarkdownSection } from '../../lib/types.js';
import { BaseChunkingStrategy } from '../base-strategy.js';

export class GenericHierarchicalStrategy extends BaseChunkingStrategy {
	readonly name = 'generic.hierarchical';
	readonly domain = 'generic';
	readonly method = 'hierarchical';
	readonly description = 'Hierarchical chunking respecting markdown heading structure';

	private strategyConfig: GenericHierarchicalConfig;
	private markdownParser: MarkdownParser;
	private metadataExtractor: MetadataExtractor;

	constructor(config: ChunkingConfig, logger: Logger) {
		super(config, logger);

		this.strategyConfig = config['generic.hierarchical'];
		this.markdownParser = new MarkdownParser(logger);
		this.metadataExtractor = new MetadataExtractor(config.metadataExtraction, logger);

		this.logger.debug({ strategy: this.name }, 'Strategy initialized');
	}

	validateConfig(): void {
		if (!this.strategyConfig) {
			throw new Error('Missing config section: generic.hierarchical');
		}

		if (this.strategyConfig.maxTokens <= 0) {
			throw new Error('maxTokens must be > 0');
		}

		if (this.strategyConfig.minTokens < 0) {
			throw new Error('minTokens must be >= 0');
		}

		if (this.strategyConfig.minTokens > this.strategyConfig.maxTokens) {
			throw new Error('minTokens cannot be greater than maxTokens');
		}
	}

	/**
	 * Process document and return ready-to-embed chunks
	 * Handles: small doc optimization → markdown parsing → chunking → enrichment
	 */
	chunk(content: string, documentId: string): Chunk[] {
		const startTime = performance.now();

		this.logger.debug(
			{
				documentId,
				contentLength: content.length,
				contentLines: content.split('\n').length,
				strategy: this.name,
			},
			'Starting hierarchical chunking'
		);

		// 1. Extract frontmatter metadata
		const frontmatter = this.metadataExtractor.extractFrontmatter(content);

		// 2. Extract document title
		const title = this.extractTitle(content, documentId, frontmatter);

		// 3. Check small document optimization
		const documentTokens = this.estimateTokens(content);
		const threshold = this.strategyConfig.wholeDocumentThreshold;

		if (documentTokens <= threshold) {
			this.logger.debug(
				{ documentId, tokens: documentTokens, threshold },
				'Small document - indexing as single chunk'
			);

			const chunk = this.createWholeDocumentChunk(content, documentId, title, frontmatter);
			const durationMs = performance.now() - startTime;

			this.logger.info(
				{
					documentId,
					strategy: this.name,
					durationMs,
					chunksCreated: 1,
					totalTokens: documentTokens,
				},
				'Chunking complete - single chunk'
			);

			return [chunk];
		}

		// 4. Parse markdown structure
		const sections = this.markdownParser.parse(content);
		const flattened = this.markdownParser.flattenSections(sections);

		// 5. Chunk sections hierarchically
		const rawChunks = this.chunkSections(flattened, documentId);

		// 6. Enrich chunks with document context if configured
		const enrichedChunks = this.strategyConfig.includeContext
			? rawChunks.map(chunk => ({
					...chunk,
					content: this.enrichWithTitle(chunk, title),
				}))
			: rawChunks;

		const totalDurationMs = performance.now() - startTime;
		const totalTokens = enrichedChunks.reduce((sum, c) => sum + c.tokens, 0);

		this.logger.info(
			{
				documentId,
				strategy: this.name,
				durationMs: totalDurationMs,
				throughputCharsPerSec: Math.round(content.length / (totalDurationMs / 1000)),
				chunksCreated: enrichedChunks.length,
				totalTokens,
				avgTokensPerChunk: Math.round(totalTokens / enrichedChunks.length),
			},
			'Chunking complete - chunks ready for embedding'
		);

		return enrichedChunks;
	}

	/**
	 * Create single chunk for entire document (small document optimization)
	 * Preserves metadata.wholeDocument: true for identification
	 */
	private createWholeDocumentChunk(
		content: string,
		documentId: string,
		title: string,
		frontmatter: Record<string, unknown>
	): Chunk {
		const uuid = this.semanticIdToUuid(documentId);

		// Enrich with title if configured
		const enrichedContent = this.strategyConfig.includeContext ? `[${title}]\n\n${content}` : content;

		return {
			id: uuid,
			documentId,
			level: 0, // Level 0 indicates whole document
			heading: title,
			content: enrichedContent,
			context: [],
			tokens: this.estimateTokens(enrichedContent),
			metadata: {
				wholeDocument: true,
				semanticId: documentId,
				...frontmatter,
			},
		};
	}

	/**
	 * Chunk markdown sections hierarchically
	 * Ported from original chunker.ts
	 */
	private chunkSections(sections: MarkdownSection[], documentId: string): Chunk[] {
		this.logger.debug({ sectionCount: sections.length }, 'Chunking sections');

		const chunks: Chunk[] = [];

		for (const section of sections) {
			if (section.tokens >= this.strategyConfig.minTokens && section.tokens <= this.strategyConfig.maxTokens) {
				// Section is perfect size
				chunks.push(this.createChunkFromSection(section, documentId, chunks.length));
			} else if (section.tokens > this.strategyConfig.maxTokens) {
				// Section too large, split into paragraphs
				const subchunks = this.splitIntoParagraphs(section, documentId, chunks.length);
				chunks.push(...subchunks);
			} else if (section.subsections.length === 0) {
				// Section too small and has no subsections, include anyway
				chunks.push(this.createChunkFromSection(section, documentId, chunks.length));
			}
			// If section is too small but has subsections, skip it (subsections will be processed)
		}

		this.logger.debug({ chunkCount: chunks.length }, 'Section chunking complete');

		return chunks;
	}

	/**
	 * Create chunk from markdown section
	 */
	private createChunkFromSection(section: MarkdownSection, documentId: string, _index: number): Chunk {
		const context = this.buildContext(section);
		const semanticId = `${documentId}-${section.level}-${section.heading}`;
		const uuid = this.semanticIdToUuid(semanticId);

		return {
			id: uuid,
			documentId,
			level: section.level,
			heading: section.heading,
			content: section.content,
			context,
			tokens: section.tokens,
			metadata: {
				semanticId,
			},
		};
	}

	/**
	 * Build context array from parent sections
	 */
	private buildContext(section: MarkdownSection): string[] {
		const context: string[] = [];
		let current = section.parent;

		while (current) {
			context.unshift(current.heading);
			current = current.parent;
		}

		return context;
	}

	/**
	 * Split large section into paragraph-based chunks
	 */
	private splitIntoParagraphs(section: MarkdownSection, documentId: string, _startIndex: number): Chunk[] {
		const paragraphs = section.content.split('\n\n').filter(p => p.trim());
		const chunks: Chunk[] = [];

		let currentChunk: string[] = [];
		let currentTokens = 0;

		for (const paragraph of paragraphs) {
			const paragraphTokens = this.estimateTokens(paragraph);

			if (currentTokens + paragraphTokens > this.strategyConfig.maxTokens) {
				// Save current chunk
				if (currentChunk.length > 0) {
					const semanticId = `${documentId}-${section.level}-${section.heading}-${chunks.length}`;
					chunks.push({
						id: this.semanticIdToUuid(semanticId),
						documentId,
						level: section.level,
						heading: section.heading,
						content: currentChunk.join('\n\n'),
						context: this.buildContext(section),
						tokens: currentTokens,
						metadata: {
							semanticId,
						},
					});
				}

				// Start new chunk
				currentChunk = [paragraph];
				currentTokens = paragraphTokens;
			} else {
				currentChunk.push(paragraph);
				currentTokens += paragraphTokens;
			}
		}

		// Save last chunk
		if (currentChunk.length > 0) {
			const semanticId = `${documentId}-${section.level}-${section.heading}-${chunks.length}`;
			chunks.push({
				id: this.semanticIdToUuid(semanticId),
				documentId,
				level: section.level,
				heading: section.heading,
				content: currentChunk.join('\n\n'),
				context: this.buildContext(section),
				tokens: currentTokens,
				metadata: {
					semanticId,
				},
			});
		}

		return chunks;
	}

	/**
	 * Enrich chunk content with document title prefix
	 */
	private enrichWithTitle(chunk: Chunk, title: string): string {
		// Build context prefix: [Title] [Parent > Headings] [Current Heading]
		let prefix = `[${title}]`;

		if (chunk.context.length > 0) {
			prefix += `\n[${chunk.context.join(' > ')}]`;
		}

		if (chunk.heading) {
			prefix += `\n[${chunk.heading}]`;
		}

		return `${prefix}\n\n${chunk.content}`;
	}
}
