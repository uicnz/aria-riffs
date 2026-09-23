/**
 * Aria heading-enriched chunking strategy
 * Extracts metadata from callout blocks and enriches chunks with template-based context
 *
 * Strategy: aria.heading-enriched
 * Domain: aria (Aria project-specific RFP formats)
 * Method: heading-enriched (extracts callout metadata, enriches with template)
 *
 * This strategy is optimized for Aria RFP documents that use callout blocks
 * (> [!TIP]) to store structured metadata like identifier, department, category, etc.
 */

import type { Logger } from 'pino';
import { MarkdownParser } from '../../core/markdown-parser.js';
import { MetadataExtractor } from '../../core/metadata-extractor.js';
import type {
	AriaCalloutFields,
	AriaHeadingEnrichedConfig,
	Chunk,
	ChunkingConfig,
	MarkdownSection,
	MetadataPattern,
} from '../../lib/types.js';
import { BaseChunkingStrategy } from '../base-strategy.js';

// Extracted callout metadata
interface CalloutMetadata {
	identifier?: string;
	description?: string;
	priority?: string;
	category?: string;
	department?: string;
	leader?: string;
	customise?: string;
	[key: string]: string | undefined;
}

export class AriaHeadingEnrichedStrategy extends BaseChunkingStrategy {
	readonly name = 'aria.heading-enriched';
	readonly domain = 'aria';
	readonly method = 'heading-enriched';
	readonly description = 'Aria RFP strategy with callout metadata extraction and template enrichment';

	private strategyConfig: AriaHeadingEnrichedConfig;
	private markdownParser: MarkdownParser;
	private metadataExtractor: MetadataExtractor;

	constructor(config: ChunkingConfig, logger: Logger) {
		super(config, logger);

		const ariaConfig = config['aria.heading-enriched'];
		if (!ariaConfig) {
			throw new Error('Missing config section: aria.heading-enriched');
		}
		this.strategyConfig = ariaConfig;
		this.markdownParser = new MarkdownParser(logger);
		this.metadataExtractor = new MetadataExtractor(config.metadataExtraction, logger);

		this.logger.debug({ strategy: this.name }, 'Strategy initialized');
	}

	validateConfig(): void {
		if (!this.strategyConfig) {
			throw new Error('Missing config section: aria.heading-enriched');
		}

		if (!this.strategyConfig.calloutPattern) {
			throw new Error('aria.heading-enriched requires calloutPattern');
		}

		if (!this.strategyConfig.enrichmentTemplate) {
			throw new Error('aria.heading-enriched requires enrichmentTemplate');
		}

		if (this.strategyConfig.maxTokens <= 0) {
			throw new Error('maxTokens must be > 0');
		}

		if (this.strategyConfig.minTokens < 0) {
			throw new Error('minTokens must be >= 0');
		}
	}

	/**
	 * Process document with callout metadata extraction and template enrichment
	 */
	chunk(content: string, documentId: string): Chunk[] {
		const startTime = performance.now();

		this.logger.debug(
			{
				documentId,
				contentLength: content.length,
				strategy: this.name,
			},
			'Starting aria heading-enriched chunking'
		);

		// 1. Extract frontmatter
		const frontmatter = this.metadataExtractor.extractFrontmatter(content);

		// 2. Extract document title
		const title = this.extractTitle(content, documentId, frontmatter);

		// 3. Extract callout metadata (Aria-specific)
		const calloutMetadata = this.extractCalloutMetadata(content);

		this.logger.debug(
			{
				documentId,
				extractedFields: Object.keys(calloutMetadata).filter(k => calloutMetadata[k]),
			},
			'Callout metadata extracted'
		);

		// 4. Check small document optimization
		const documentTokens = this.estimateTokens(content);
		const threshold = this.strategyConfig.wholeDocumentThreshold;

		if (documentTokens <= threshold) {
			this.logger.debug(
				{ documentId, tokens: documentTokens, threshold },
				'Small document - indexing as single chunk'
			);

			const chunk = this.createWholeDocumentChunk(content, documentId, title, calloutMetadata, frontmatter);
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

		// 5. Parse markdown structure
		const sections = this.markdownParser.parse(content);
		const flattened = this.markdownParser.flattenSections(sections);

		// 6. Chunk sections hierarchically
		const rawChunks = this.chunkSections(flattened, documentId);

		// 7. Enrich chunks with template-based context
		const enrichedChunks = rawChunks.map(chunk => ({
			...chunk,
			content: this.enrichWithTemplate(chunk, title, calloutMetadata),
			metadata: {
				...chunk.metadata,
				...calloutMetadata, // Include extracted metadata in chunk metadata
			},
		}));

		const totalDurationMs = performance.now() - startTime;
		const totalTokens = enrichedChunks.reduce((sum, c) => sum + c.tokens, 0);

		this.logger.info(
			{
				documentId,
				strategy: this.name,
				durationMs: totalDurationMs,
				chunksCreated: enrichedChunks.length,
				totalTokens,
				extractedMetadata: Object.keys(calloutMetadata).filter(k => calloutMetadata[k]),
			},
			'Chunking complete - chunks ready for embedding'
		);

		return enrichedChunks;
	}

	/**
	 * Extract metadata from callout blocks (> [!TIP] sections)
	 */
	private extractCalloutMetadata(content: string): CalloutMetadata {
		const metadata: CalloutMetadata = {};

		// Find callout block using configured pattern
		const calloutRegex = new RegExp(this.strategyConfig.calloutPattern, 'm');
		const calloutMatch = content.match(calloutRegex);

		if (!calloutMatch) {
			this.logger.trace({ pattern: this.strategyConfig.calloutPattern }, 'No callout block found');
			return metadata;
		}

		// Find the full callout block (from > [!TIP] until non-quote line)
		const calloutStart = calloutMatch.index ?? 0;
		const lines = content.slice(calloutStart).split('\n');
		const calloutLines: string[] = [];

		for (const line of lines) {
			if (line.startsWith('>') || line.trim() === '') {
				calloutLines.push(line);
			} else if (calloutLines.length > 0) {
				break;
			}
		}

		const calloutContent = calloutLines.join('\n');

		// Extract each configured field
		const fields = this.strategyConfig.fields;
		for (const [fieldName, pattern] of Object.entries(fields) as [keyof AriaCalloutFields, MetadataPattern][]) {
			const value = this.extractField(calloutContent, pattern);
			if (value) {
				metadata[fieldName] = value;
			} else if (pattern.required) {
				this.logger.warn({ field: fieldName, pattern: pattern.regex }, 'Required field not found');
			}
		}

		return metadata;
	}

	/**
	 * Extract a single field using its pattern
	 */
	private extractField(content: string, pattern: MetadataPattern): string | undefined {
		try {
			const regex = new RegExp(pattern.regex, 'gm');
			const match = regex.exec(content);

			if (match?.[pattern.captureGroup]) {
				const value = match[pattern.captureGroup].trim();
				this.logger.trace({ field: pattern.name, value }, 'Field extracted');
				return value;
			}
		} catch (error) {
			this.logger.warn({ pattern: pattern.regex, error }, 'Failed to extract field');
		}

		return undefined;
	}

	/**
	 * Create single chunk for entire document with callout metadata
	 */
	private createWholeDocumentChunk(
		content: string,
		documentId: string,
		title: string,
		calloutMetadata: CalloutMetadata,
		frontmatter: Record<string, unknown>
	): Chunk {
		const uuid = this.semanticIdToUuid(documentId);

		// Enrich with template
		const enrichedContent = this.applyEnrichmentTemplate(title, calloutMetadata, '', content);

		return {
			id: uuid,
			documentId,
			level: 0,
			heading: title,
			content: enrichedContent,
			context: [],
			tokens: this.estimateTokens(enrichedContent),
			metadata: {
				wholeDocument: true,
				semanticId: documentId,
				...frontmatter,
				...calloutMetadata,
			},
		};
	}

	/**
	 * Chunk markdown sections hierarchically
	 */
	private chunkSections(sections: MarkdownSection[], documentId: string): Chunk[] {
		const chunks: Chunk[] = [];

		for (const section of sections) {
			if (section.tokens >= this.strategyConfig.minTokens && section.tokens <= this.strategyConfig.maxTokens) {
				chunks.push(this.createChunkFromSection(section, documentId));
			} else if (section.tokens > this.strategyConfig.maxTokens) {
				const subchunks = this.splitIntoParagraphs(section, documentId, chunks.length);
				chunks.push(...subchunks);
			} else if (section.subsections.length === 0) {
				chunks.push(this.createChunkFromSection(section, documentId));
			}
		}

		return chunks;
	}

	/**
	 * Create chunk from markdown section
	 */
	private createChunkFromSection(section: MarkdownSection, documentId: string): Chunk {
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
	private splitIntoParagraphs(section: MarkdownSection, documentId: string, startIndex: number): Chunk[] {
		const paragraphs = section.content.split('\n\n').filter(p => p.trim());
		const chunks: Chunk[] = [];

		let currentChunk: string[] = [];
		let currentTokens = 0;

		for (const paragraph of paragraphs) {
			const paragraphTokens = this.estimateTokens(paragraph);

			if (currentTokens + paragraphTokens > this.strategyConfig.maxTokens) {
				if (currentChunk.length > 0) {
					const semanticId = `${documentId}-${section.level}-${section.heading}-${startIndex + chunks.length}`;
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

				currentChunk = [paragraph];
				currentTokens = paragraphTokens;
			} else {
				currentChunk.push(paragraph);
				currentTokens += paragraphTokens;
			}
		}

		if (currentChunk.length > 0) {
			const semanticId = `${documentId}-${section.level}-${section.heading}-${startIndex + chunks.length}`;
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
	 * Enrich chunk content using the configured template
	 */
	private enrichWithTemplate(chunk: Chunk, title: string, calloutMetadata: CalloutMetadata): string {
		return this.applyEnrichmentTemplate(title, calloutMetadata, chunk.heading, chunk.content);
	}

	/**
	 * Apply enrichment template with variable substitution
	 * Template format: "[{title} | {identifier} | {department}]\n\n"
	 */
	private applyEnrichmentTemplate(
		title: string,
		metadata: CalloutMetadata,
		heading: string,
		content: string
	): string {
		let enriched = this.strategyConfig.enrichmentTemplate;

		// Replace template variables
		enriched = enriched.replace(/\{title\}/g, title || '');
		enriched = enriched.replace(/\{heading\}/g, heading || '');
		enriched = enriched.replace(/\{identifier\}/g, metadata.identifier || '');
		enriched = enriched.replace(/\{description\}/g, metadata.description || '');
		enriched = enriched.replace(/\{priority\}/g, metadata.priority || '');
		enriched = enriched.replace(/\{category\}/g, metadata.category || '');
		enriched = enriched.replace(/\{department\}/g, metadata.department || '');
		enriched = enriched.replace(/\{leader\}/g, metadata.leader || '');
		enriched = enriched.replace(/\{customise\}/g, metadata.customise || '');

		// Clean up empty pipes/brackets from missing fields
		enriched = enriched.replace(/\|\s*\|/g, '|'); // || -> |
		enriched = enriched.replace(/\[\s*\|/g, '['); // [| -> [
		enriched = enriched.replace(/\|\s*\]/g, ']'); // |] -> ]
		enriched = enriched.replace(/\[\s*\]/g, ''); // [] -> (empty)

		return enriched + content;
	}
}
