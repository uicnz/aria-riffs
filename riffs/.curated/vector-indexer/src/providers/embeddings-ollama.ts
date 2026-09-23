/**
 * Ollama embedding provider implementation
 */

import { embed, embedMany } from 'ai';
import { createOllama } from 'ai-sdk-ollama';
import type { Logger } from 'pino';
import type { EmbeddingConfig, EmbeddingOptions, EmbeddingResult, IEmbeddingProvider } from '../lib/types.js';

export class OllamaEmbeddingProvider implements IEmbeddingProvider {
	private ollama: ReturnType<typeof createOllama>;
	private logger: Logger;
	private config: EmbeddingConfig;

	constructor(config: EmbeddingConfig, ollamaHost: string, logger: Logger) {
		this.config = config;
		this.logger = logger;
		this.ollama = createOllama({
			baseURL: ollamaHost,
		});
	}

	/**
	 * Generate embedding for a single text
	 */
	async embed(text: string, options?: EmbeddingOptions): Promise<EmbeddingResult> {
		const model = options?.model ?? this.config.model;
		const instruction = options?.instruction ?? this.config.instruction;
		const input = instruction ? `${instruction}: ${text}` : text;

		this.logger.debug({ model, inputLength: text.length }, 'Generating embedding');

		const { embedding, usage } = await embed({
			model: this.ollama.textEmbeddingModel(model),
			value: input,
		});

		this.logger.debug(
			{
				model,
				dimensions: embedding.length,
				tokens: usage?.tokens,
			},
			'Embedding generated'
		);

		return {
			embedding,
			tokens: usage?.tokens ?? 0,
		};
	}

	/**
	 * Generate embeddings for multiple texts
	 */
	async embedBatch(texts: string[], options?: EmbeddingOptions): Promise<EmbeddingResult[]> {
		const model = options?.model ?? this.config.model;
		const instruction = options?.instruction ?? this.config.instruction;
		const inputs = texts.map(t => (instruction ? `${instruction}: ${t}` : t));

		this.logger.debug({ model, count: texts.length }, 'Generating batch embeddings');

		const { embeddings, usage } = await embedMany({
			model: this.ollama.textEmbeddingModel(model),
			values: inputs,
		});

		this.logger.debug(
			{
				model,
				count: embeddings.length,
				totalTokens: usage?.tokens,
			},
			'Batch embeddings generated'
		);

		const tokensPerEmbedding = Math.floor((usage?.tokens ?? 0) / texts.length);

		return embeddings.map(embedding => ({
			embedding,
			tokens: tokensPerEmbedding,
		}));
	}

	/**
	 * Check if a model is available
	 */
	async checkModelAvailable(model: string): Promise<boolean> {
		try {
			await embed({
				model: this.ollama.textEmbeddingModel(model),
				value: 'test',
			});
			return true;
		} catch (error) {
			this.logger.warn({ model, error }, 'Model not available');
			return false;
		}
	}

	/**
	 * Select best available model
	 */
	async selectBestModel(): Promise<string> {
		// Try primary model first
		if (await this.checkModelAvailable(this.config.model)) {
			this.logger.info({ model: this.config.model }, 'Using primary model');
			return this.config.model;
		}

		// Fall back to fallback model
		this.logger.warn(
			{
				primary: this.config.model,
				fallback: this.config.fallbackModel,
			},
			'Primary model unavailable, using fallback'
		);

		return this.config.fallbackModel;
	}
}
