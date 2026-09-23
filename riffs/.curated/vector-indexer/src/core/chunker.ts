/**
 * Thin wrapper for chunking strategies
 * Delegates all work to selected strategy
 */

import type { Logger } from 'pino';
import type { Chunk, ChunkingConfig } from '../lib/types.js';
import { createStrategy } from '../strategies/index.js';
import type { IChunkingStrategy } from '../strategies/types.js';

export class Chunker {
	private strategy: IChunkingStrategy;

	constructor(config: ChunkingConfig, logger: Logger) {
		// Create strategy via factory (validates config)
		this.strategy = createStrategy(config.strategy, config, logger);
	}

	/**
	 * Delegate to strategy - returns ready-to-embed chunks
	 * Strategy handles: extract metadata → parse → chunk → enrich → return
	 */
	chunk(content: string, documentId: string): Chunk[] {
		return this.strategy.chunk(content, documentId);
	}
}
