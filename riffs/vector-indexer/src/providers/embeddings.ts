/**
 * Embedding provider manager
 * Routes to specific provider implementations based on config
 */

import type { Logger } from 'pino';
import type { EmbeddingOptions, EmbeddingResult, IEmbeddingProvider, VectorIndexerConfig } from '../lib/types.js';
import { LlamaCppEmbeddingProvider } from './embeddings-llama-cpp.js';
import { OllamaEmbeddingProvider } from './embeddings-ollama.js';

export class EmbeddingProvider implements IEmbeddingProvider {
	private provider: IEmbeddingProvider;
	private logger: Logger;

	constructor(config: VectorIndexerConfig, logger: Logger) {
		this.logger = logger;

		// Select provider based on config
		const providerType = config.embedding.provider ?? 'ollama';

		switch (providerType) {
			case 'llama-cpp':
				this.logger.info({ provider: 'llama-cpp' }, 'Initializing llama.cpp embedding provider');
				this.provider = new LlamaCppEmbeddingProvider(config.embedding, config.llamaCppEmbeddings, logger);
				break;
			default:
				this.logger.info({ provider: 'ollama' }, 'Initializing Ollama embedding provider');
				this.provider = new OllamaEmbeddingProvider(config.embedding, config.ollama.host, logger);
				break;
		}
	}

	/**
	 * Generate embedding for a single text
	 */
	async embed(text: string, options?: EmbeddingOptions): Promise<EmbeddingResult> {
		return this.provider.embed(text, options);
	}

	/**
	 * Generate embeddings for multiple texts
	 */
	async embedBatch(texts: string[], options?: EmbeddingOptions): Promise<EmbeddingResult[]> {
		return this.provider.embedBatch(texts, options);
	}

	/**
	 * Check if a model is available
	 */
	async checkModelAvailable(model: string): Promise<boolean> {
		if (this.provider.checkModelAvailable) {
			return this.provider.checkModelAvailable(model);
		}
		return true;
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
