/**
 * Search pipeline orchestration with hybrid search and re-ranking
 */

import type { Logger } from 'pino';
import type { SearchOptions, SearchResult, VectorIndexerConfig } from '../lib/types.js';
import { EmbeddingProvider } from '../providers/embeddings.js';
import { QdrantProvider } from '../providers/qdrant.js';
import { Reranker } from '../providers/reranker.js';
import { SparseVectorProvider } from '../providers/sparse-vectors.js';

export class Searcher {
	private logger: Logger;
	private _config: VectorIndexerConfig;
	private embeddingProvider: EmbeddingProvider;
	private sparseVectorProvider: SparseVectorProvider;
	private qdrantProvider: QdrantProvider;
	private reranker: Reranker;

	constructor(config: VectorIndexerConfig, logger: Logger) {
		this._config = config;
		this.logger = logger;

		// Initialize components
		this.embeddingProvider = new EmbeddingProvider(config, logger);
		this.sparseVectorProvider = new SparseVectorProvider(config.sparse, logger);
		this.qdrantProvider = new QdrantProvider(config.qdrant, logger);
		this.reranker = new Reranker(config, logger);
	}

	/**
	 * Search with hybrid retrieval and optional re-ranking
	 */
	async search(query: string, options: SearchOptions): Promise<SearchResult[]> {
		this.logger.info(
			{
				query,
				collection: options.collection,
				topK: options.topK,
				rerank: options.rerank,
			},
			'Starting search'
		);

		try {
			// 1. Generate query embeddings
			const { embedding: denseVector } = await this.embeddingProvider.embed(query);

			// 2. Generate sparse vector
			const sparseVector = this.sparseVectorProvider.generateSparseVector(query);

			// 3. Hybrid search
			const results = await this.qdrantProvider.hybridSearch(options.collection, {
				denseVector,
				sparseVector,
				denseWeight: options.denseWeight,
				sparseWeight: options.sparseWeight,
				limit: options.topK,
				filter: options.filter,
			});

			this.logger.debug({ resultCount: results.length }, 'Initial results retrieved');

			// 4. Re-rank if enabled
			if (options.rerank && results.length > 0) {
				const reranked = await this.reranker.rerank(
					query,
					results.map(r => ({
						content: r.content,
						metadata: r.metadata,
					})),
					{
						topK: options.finalK,
						model: options.rerankerModel,
					}
				);

				this.logger.info({ rerankedCount: reranked.length }, 'Results re-ranked');

				return reranked.map(r => ({
					id: results[r.index].id,
					score: r.score,
					content: r.content,
					metadata: r.metadata,
				}));
			}

			// Return initial results if no re-ranking
			return results.slice(0, options.finalK);
		} catch (error) {
			this.logger.error({ error }, 'Search failed');
			throw error;
		}
	}

	/**
	 * Get current configuration (for debugging/validation)
	 */
	getConfig(): VectorIndexerConfig {
		return this._config;
	}
}
