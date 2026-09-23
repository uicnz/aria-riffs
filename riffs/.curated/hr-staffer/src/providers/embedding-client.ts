/**
 * Embedding service using AI SDK.
 * Provides abstraction over OpenAI, Gemini, and Ollama embedding APIs.
 * Returns Float32Array for compatibility with hr-staffer database storage.
 *
 * API keys can be set via:
 * - Config file (config.yaml)
 * - Environment variables: OPENAI_API_KEY, GOOGLE_API_KEY
 */

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { type EmbeddingModel, embed } from 'ai';
import { createOllama } from 'ai-sdk-ollama';
import type { EmbeddingProvider } from '../core/indexer.js';
import type { HrStafferEmbeddings } from '../lib/schema.js';

/**
 * Error thrown when embedding operations fail.
 */
export class EmbeddingError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'EmbeddingError';
	}
}

/**
 * Resolve API key from config or environment variable.
 * Environment variables take precedence over config values.
 */
function resolveApiKey(configKey: string, envVar: string): string {
	return process.env[envVar] || configKey;
}

/**
 * Embedding service implementation using Vercel AI SDK.
 * Supports OpenAI, Gemini, and Ollama providers.
 */
export class EmbeddingService implements EmbeddingProvider {
	private config: HrStafferEmbeddings;
	private model: EmbeddingModel;
	private modelName: string;
	private dimensions: number;
	private maxChars: number;

	constructor(config: HrStafferEmbeddings) {
		this.config = config;
		this.maxChars = config.maxChars;
		const { model, modelName, dimensions } = this.initializeModel();
		this.model = model;
		this.modelName = modelName;
		this.dimensions = dimensions;
	}

	private initializeModel(): { model: EmbeddingModel; modelName: string; dimensions: number } {
		if (this.config.provider === 'openai') {
			const apiKey = resolveApiKey(this.config.openai.apiKey, 'OPENAI_API_KEY');
			if (!apiKey) {
				throw new EmbeddingError(
					'OpenAI API key not configured. Set OPENAI_API_KEY environment variable or configure in config file.'
				);
			}
			const provider = createOpenAI({ apiKey });
			return {
				model: provider.embeddingModel(this.config.openai.model),
				modelName: this.config.openai.model,
				dimensions: this.config.openai.dimensions,
			};
		}

		if (this.config.provider === 'gemini') {
			const apiKey = resolveApiKey(this.config.gemini.apiKey, 'GOOGLE_API_KEY');
			if (!apiKey) {
				throw new EmbeddingError(
					'Gemini API key not configured. Set GOOGLE_API_KEY environment variable or configure in config file.'
				);
			}
			const provider = createGoogleGenerativeAI({ apiKey });
			return {
				model: provider.embeddingModel(this.config.gemini.model),
				modelName: this.config.gemini.model,
				dimensions: this.config.gemini.dimensions,
			};
		}

		if (this.config.provider === 'ollama') {
			const provider = createOllama({
				baseURL: this.config.ollama.endpoint,
			});
			return {
				model: provider.textEmbeddingModel(this.config.ollama.model),
				modelName: this.config.ollama.model,
				dimensions: this.config.ollama.dimensions,
			};
		}

		// TypeScript exhaustive check
		const _exhaustive: never = this.config.provider;
		throw new EmbeddingError(`Unsupported embedding provider: ${_exhaustive}`);
	}

	/**
	 * Generate embedding for a single text.
	 * Returns Float32Array for efficient storage and computation.
	 */
	async embedSingle(text: string): Promise<Float32Array> {
		try {
			// Truncate to max chars
			const truncated = text.length > this.maxChars ? text.slice(0, this.maxChars) : text;

			const response = await embed({
				model: this.model,
				value: truncated,
			});

			return new Float32Array(response.embedding);
		} catch (error) {
			throw new EmbeddingError(
				`Failed to generate embedding: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}

	/**
	 * Get the model name being used.
	 */
	getModelName(): string {
		return this.modelName;
	}

	/**
	 * Get the embedding dimensions.
	 */
	getDimensions(): number {
		return this.dimensions;
	}
}

/**
 * Factory function to create an embedding service from config.
 */
export function createEmbeddingService(config: HrStafferEmbeddings): EmbeddingService {
	return new EmbeddingService(config);
}
