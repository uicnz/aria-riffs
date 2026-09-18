/**
 * Strategy interfaces for pluggable chunking system
 * Defines contract that all chunking strategies must implement
 */

import type { Chunk } from '../lib/types.js';

/**
 * Core chunking strategy interface
 * Strategy owns entire preprocessing pipeline: extract → build context → chunk → enrich → return
 */
export interface IChunkingStrategy {
	readonly name: string; // e.g., 'generic.hierarchical', 'aria.heading-enriched'
	readonly domain: string; // e.g., 'generic', 'aria', 'legal'
	readonly method: string; // e.g., 'hierarchical', 'heading-enriched'
	readonly description: string;

	/**
	 * Process document and return ready-to-embed chunks
	 * Strategy handles ALL preprocessing:
	 * 1. Extract metadata (frontmatter + domain-specific)
	 * 2. Build document context (title, metadata)
	 * 3. Parse structure and chunk
	 * 4. Enrich chunks with context
	 * 5. Return enriched chunks ready for embedding
	 *
	 * @param content - Raw markdown content
	 * @param documentId - Document path/identifier
	 * @returns Enriched chunks ready to embed
	 */
	chunk(content: string, documentId: string): Chunk[];

	/**
	 * Validate strategy configuration
	 * Throws if config is invalid or missing required fields
	 */
	validateConfig(): void;
}
