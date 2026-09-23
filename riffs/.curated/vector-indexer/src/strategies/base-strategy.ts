/**
 * Base class for all chunking strategies
 * Provides common utilities: token estimation, UUID generation, title extraction
 */

import { createHash } from 'node:crypto';
import type { Logger } from 'pino';
import type { Chunk, ChunkingConfig } from '../lib/types.js';
import type { IChunkingStrategy } from './types.js';

export abstract class BaseChunkingStrategy implements IChunkingStrategy {
	abstract readonly name: string;
	abstract readonly domain: string;
	abstract readonly method: string;
	abstract readonly description: string;

	constructor(
		protected config: ChunkingConfig,
		protected logger: Logger
	) {
		// Note: Cannot log strategy name here because abstract properties
		// aren't initialized until subclass constructor runs
	}

	/**
	 * Concrete strategies implement this
	 * Must return ready-to-embed chunks (already enriched)
	 */
	abstract chunk(content: string, documentId: string): Chunk[];

	/**
	 * Validate strategy-specific configuration
	 * Throws if config is invalid or missing required fields
	 */
	abstract validateConfig(): void;

	/**
	 * Estimate token count (rough approximation: ~4 chars per token)
	 * Strategies can override for more accurate estimation
	 */
	protected estimateTokens(text: string): number {
		return Math.ceil(text.length / 4);
	}

	/**
	 * Generate deterministic UUID from semantic ID
	 * Same inputs always produce same UUID (enables idempotent indexing)
	 */
	protected semanticIdToUuid(semanticId: string): string {
		const hash = createHash('md5').update(semanticId).digest('hex');
		return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
	}

	/**
	 * Extract document title using fallback hierarchy
	 * Priority: frontmatter.title → first H1 → filename
	 */
	protected extractTitle(content: string, documentId: string, frontmatter: Record<string, unknown>): string {
		// Priority 1: Frontmatter title
		if (frontmatter.title && typeof frontmatter.title === 'string') {
			this.logger.trace({ source: 'frontmatter', title: frontmatter.title }, 'Title from frontmatter');
			return frontmatter.title;
		}

		// Priority 2: First H1 heading
		const h1Match = content.match(/^#\s+(.+)$/m);
		if (h1Match) {
			const title = h1Match[1].trim();
			this.logger.trace({ source: 'h1', title }, 'Title from H1 heading');
			return title;
		}

		// Priority 3: Filename
		const title = documentId.split('/').pop()?.replace(/\.md$/, '') || 'Untitled';
		this.logger.trace({ source: 'filename', title }, 'Title from filename');
		return title;
	}
}
