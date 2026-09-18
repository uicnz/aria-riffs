/**
 * Re-ranker provider manager
 * Routes to specific provider implementations based on config
 */

import type { Logger } from 'pino';
import type { IRerankerProvider, RerankOptions, RerankResult, VectorIndexerConfig } from '../lib/types.js';
import { LlamaCppReranker } from './reranker-llama-cpp.js';
import { OllamaReranker } from './reranker-ollama.js';

export class Reranker implements IRerankerProvider {
	private provider: IRerankerProvider;
	private logger: Logger;

	constructor(config: VectorIndexerConfig, logger: Logger) {
		this.logger = logger;

		// Select provider based on config
		const providerType = config.reranker.provider ?? 'ollama';

		switch (providerType) {
			case 'llama-cpp':
				this.logger.info({ provider: 'llama-cpp' }, 'Initializing llama.cpp reranker provider');
				this.provider = new LlamaCppReranker(config.reranker, config.llamaCppReranker, logger);
				break;
			default:
				this.logger.info({ provider: 'ollama' }, 'Initializing Ollama reranker provider');
				this.provider = new OllamaReranker(config.reranker, config.ollama.host, logger);
				break;
		}
	}

	/**
	 * Re-rank documents based on query relevance
	 */
	async rerank(
		query: string,
		documents: Array<{ content: string; metadata: Record<string, unknown> }>,
		options?: RerankOptions
	): Promise<RerankResult[]> {
		return this.provider.rerank(query, documents, options);
	}

	/**
	 * Select best available model
	 */
	async selectBestModel(): Promise<string> {
		if (this.provider.selectBestModel) {
			return this.provider.selectBestModel();
		}
		throw new Error('Provider does not support model selection');
	}
}
