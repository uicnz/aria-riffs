/**
 * Unified embedding client using AI SDK
 * Provides abstraction over OpenAI, Gemini, and Ollama embedding APIs
 */

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { type EmbeddingModel, embedMany } from 'ai';
import { createOllama } from 'ai-sdk-ollama';
import type { EmbeddingProvider } from '../lib/types.js';

/**
 * Type definitions for AI SDK embedding abstraction
 */

export type EmbeddingProviderName = 'openai' | 'gemini' | 'ollama';

export interface EmbeddingProviderConfig {
	provider: EmbeddingProviderName;
	model: string;
	dimensions: number;
	timeout: number;
	max_retries?: number;
}

export interface OpenAIEmbeddingConfig extends EmbeddingProviderConfig {
	provider: 'openai';
	api_key: string;
	base_url: string | undefined;
}

export interface GeminiEmbeddingConfig extends EmbeddingProviderConfig {
	provider: 'gemini';
	api_key: string;
	base_url: string | undefined;
}

export interface OllamaEmbeddingConfig extends EmbeddingProviderConfig {
	provider: 'ollama';
	endpoint: string;
	keep_alive: number | undefined;
}

export type UnifiedEmbeddingConfig = OpenAIEmbeddingConfig | GeminiEmbeddingConfig | OllamaEmbeddingConfig;

export interface EmbeddingServiceConfig {
	embeddingConfig: UnifiedEmbeddingConfig;
	maxChars?: number;
	batchSize?: number;
}

class EmbeddingError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'EmbeddingError';
	}
}

class EmbeddingConnectionError extends EmbeddingError {
	constructor(message: string) {
		super(message);
		this.name = 'EmbeddingConnectionError';
	}
}

/**
 * Embedding service using AI SDK.
 * Supports OpenAI, Gemini, and Ollama embedding providers.
 * @internal
 */
export class EmbeddingService implements EmbeddingProvider {
	private config: UnifiedEmbeddingConfig;
	private model: EmbeddingModel;
	private maxChars: number;
	private batchSize: number;

	constructor(
		configOrEmbeddingConfig: EmbeddingServiceConfig | UnifiedEmbeddingConfig,
		maxChars = 20000,
		batchSize = 64
	) {
		// Support both EmbeddingServiceConfig and UnifiedEmbeddingConfig for backward compatibility
		if ('embeddingConfig' in configOrEmbeddingConfig) {
			const serviceConfig = configOrEmbeddingConfig as EmbeddingServiceConfig;
			this.config = serviceConfig.embeddingConfig;
			this.maxChars = serviceConfig.maxChars ?? 20000;
			this.batchSize = serviceConfig.batchSize ?? 64;
		} else {
			this.config = configOrEmbeddingConfig as UnifiedEmbeddingConfig;
			this.maxChars = maxChars;
			this.batchSize = batchSize;
		}
		this.model = this.initializeModel();
	}

	private initializeModel(): EmbeddingModel {
		if (this.config.provider === 'openai') {
			const provider = createOpenAI({
				apiKey: this.config.api_key,
				...(this.config.base_url && { baseURL: this.config.base_url }),
			});
			return provider.embeddingModel(this.config.model);
		} else if (this.config.provider === 'gemini') {
			const provider = createGoogleGenerativeAI({
				apiKey: this.config.api_key,
			});
			return provider.embeddingModel(this.config.model);
		} else if (this.config.provider === 'ollama') {
			const ollamaConfig = this.config as OllamaEmbeddingConfig;
			const provider = createOllama({
				baseURL: ollamaConfig.endpoint,
			});
			return provider.textEmbeddingModel(ollamaConfig.model);
		}

		const _exhaustive: never = this.config;
		throw new EmbeddingConnectionError(`Unsupported embedding provider: ${_exhaustive}`);
	}

	async embedAll(texts: string[]): Promise<number[][]> {
		if (texts.length === 0) {
			return [];
		}

		try {
			// Truncate each input to max characters
			const sanitized = texts.map(t => (t.length > this.maxChars ? t.slice(0, this.maxChars) : t));

			// Process in batches to handle rate limits and memory constraints
			const results: number[][] = [];

			for (let i = 0; i < sanitized.length; i += this.batchSize) {
				const batch = sanitized.slice(i, i + this.batchSize);

				const response = await embedMany({
					model: this.model,
					values: batch,
				});

				// Extract embeddings from response
				for (const embedding of response.embeddings) {
					results.push(embedding);
				}
			}

			if (results.length !== texts.length) {
				throw new EmbeddingConnectionError(
					`Embedding count mismatch: expected ${texts.length}, got ${results.length}`
				);
			}

			return results;
		} catch (error) {
			throw new EmbeddingConnectionError(
				`Failed to generate embeddings: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}

	async embedSingle(text: string): Promise<number[]> {
		const embeddings = await this.embedAll([text]);
		return embeddings[0] ?? [];
	}

	/**
	 * Convert a number array to a Buffer using native endian format.
	 * Uses Float32Array for native endian, consistent with bufferToVector.
	 */
	vectorToBuffer(vec: number[]): Buffer {
		const float32 = new Float32Array(vec);
		return Buffer.from(float32.buffer);
	}

	/**
	 * Convert a Buffer or ArrayBuffer (from SQLite BLOB) back to a Float32Array.
	 * libsql may return BLOB data as ArrayBuffer or Uint8Array, not Node.js Buffer.
	 */
	bufferToVector(buffer: Buffer | Uint8Array | ArrayBuffer): Float32Array {
		if (buffer instanceof ArrayBuffer) {
			return new Float32Array(buffer);
		}
		// Handle Buffer and Uint8Array (both have buffer, byteOffset, byteLength)
		return new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);
	}

	cosineSimilarity(a: number[] | Float32Array, b: number[] | Float32Array): number {
		let dot = 0;
		let na = 0;
		let nb = 0;
		for (let i = 0; i < a.length; i++) {
			const av = a[i];
			const bv = b[i];
			if (av !== undefined && bv !== undefined) {
				dot += av * bv;
				na += av * av;
				nb += bv * bv;
			}
		}
		return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-9);
	}

	getModelName(): string {
		return this.config.model;
	}

	getDimensions(): number {
		return this.config.dimensions;
	}

	getProvider(): string {
		return this.config.provider;
	}
}
