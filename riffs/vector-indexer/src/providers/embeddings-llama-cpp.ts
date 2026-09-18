/**
 * llama.cpp embedding provider implementation
 * Uses llama-server's /v1/embeddings endpoint
 */

import type { Logger } from 'pino';
import type {
	EmbeddingConfig,
	EmbeddingOptions,
	EmbeddingResult,
	IEmbeddingProvider,
	LlamaCppConfig,
} from '../lib/types.js';

interface EmbeddingResponse {
	data: Array<{
		embedding: number[];
		index: number;
	}>;
	model: string;
	usage: {
		prompt_tokens: number;
		total_tokens: number;
	};
}

export class LlamaCppEmbeddingProvider implements IEmbeddingProvider {
	private host: string;
	private timeout: number;
	private logger: Logger;
	private config: EmbeddingConfig;
	private initialized: boolean = false;

	constructor(config: EmbeddingConfig, llamaCppConfig: LlamaCppConfig, logger: Logger) {
		this.config = config;
		this.host = llamaCppConfig.host;
		this.timeout = llamaCppConfig.timeout;
		this.logger = logger;
	}

	/**
	 * Check connection to llama-server on first use
	 */
	private async ensureConnection(): Promise<void> {
		if (this.initialized) return;

		try {
			const response = await fetch(`${this.host}/health`, {
				method: 'GET',
				signal: AbortSignal.timeout(5000),
			});

			if (!response.ok) {
				throw new Error(`llama-server health check failed: ${response.status}`);
			}

			this.logger.info({ host: this.host }, 'llama-server connection verified for embeddings');
			this.initialized = true;
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.logger.error({ host: this.host, error: message }, 'Failed to connect to llama-server');
			throw new Error(
				`llama-server not available at ${this.host}. ` +
					'Ensure llama-server is running with an embedding model (qwen3-embedding). ' +
					`Error: ${message}`
			);
		}
	}

	/**
	 * Generate embedding for a single text
	 */
	async embed(text: string, options?: EmbeddingOptions): Promise<EmbeddingResult> {
		await this.ensureConnection();

		const instruction = options?.instruction ?? this.config.instruction;
		const input = instruction ? `${instruction}: ${text}` : text;

		this.logger.debug({ inputLength: text.length }, 'Generating embedding via llama.cpp');

		try {
			const response = await fetch(`${this.host}/v1/embeddings`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					input,
					model: 'embedding', // llama-server uses generic name
				}),
				signal: AbortSignal.timeout(this.timeout),
			});

			if (!response.ok) {
				throw new Error(`llama-server embedding request failed: ${response.status}`);
			}

			const data = (await response.json()) as EmbeddingResponse;

			if (!data.data || data.data.length === 0) {
				throw new Error('No embedding returned from llama-server');
			}

			const embedding = data.data[0].embedding;
			const tokens = data.usage?.prompt_tokens ?? 0;

			this.logger.debug(
				{
					dimensions: embedding.length,
					tokens,
				},
				'Embedding generated via llama.cpp'
			);

			return {
				embedding,
				tokens,
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.logger.error({ error: message }, 'Failed to generate embedding');
			throw error;
		}
	}

	/**
	 * Generate embeddings for multiple texts
	 */
	async embedBatch(texts: string[], options?: EmbeddingOptions): Promise<EmbeddingResult[]> {
		await this.ensureConnection();

		const instruction = options?.instruction ?? this.config.instruction;
		const inputs = texts.map(t => (instruction ? `${instruction}: ${t}` : t));

		this.logger.debug({ count: texts.length }, 'Generating batch embeddings via llama.cpp');

		try {
			const response = await fetch(`${this.host}/v1/embeddings`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					input: inputs,
					model: 'embedding',
				}),
				signal: AbortSignal.timeout(this.timeout),
			});

			if (!response.ok) {
				throw new Error(`llama-server batch embedding request failed: ${response.status}`);
			}

			const data = (await response.json()) as EmbeddingResponse;

			if (!data.data || data.data.length === 0) {
				throw new Error('No embeddings returned from llama-server');
			}

			// Sort by index to maintain order
			const sorted = data.data.sort((a, b) => a.index - b.index);
			const totalTokens = data.usage?.total_tokens ?? 0;
			const tokensPerEmbedding = Math.floor(totalTokens / texts.length);

			this.logger.debug(
				{
					count: sorted.length,
					totalTokens,
				},
				'Batch embeddings generated via llama.cpp'
			);

			return sorted.map(item => ({
				embedding: item.embedding,
				tokens: tokensPerEmbedding,
			}));
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.logger.error({ error: message }, 'Failed to generate batch embeddings');
			throw error;
		}
	}

	/**
	 * Check if model is available (not applicable for llama.cpp - model is loaded at server start)
	 */
	async checkModelAvailable(_model: string): Promise<boolean> {
		try {
			await this.ensureConnection();
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Select best model (not applicable for llama.cpp - model is fixed at server start)
	 */
	async selectBestModel(): Promise<string> {
		return this.config.model;
	}
}
