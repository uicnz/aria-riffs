import type { EmbeddingProvider } from '../../src/lib/types.js';

/**
 * Mock embedding service for testing.
 * Implements EmbeddingProvider interface for type-safe testing without real embedding API calls.
 * Returns consistent fixed-size embeddings based on text hash.
 */
export class MockEmbeddingService implements EmbeddingProvider {
	private dimensions: number;

	constructor(dimensions = 384) {
		this.dimensions = dimensions;
	}

	async embedAll(texts: string[]): Promise<number[][]> {
		return texts.map(text => this.generateEmbedding(text));
	}

	async embedSingle(text: string): Promise<number[]> {
		return this.generateEmbedding(text);
	}

	vectorToBuffer(vec: number[]): Buffer {
		const float32 = new Float32Array(vec);
		return Buffer.from(float32.buffer);
	}

	bufferToVector(buffer: Buffer | Uint8Array | ArrayBuffer): Float32Array {
		if (buffer instanceof ArrayBuffer) {
			return new Float32Array(buffer);
		}
		// Handle Buffer and Uint8Array (both have buffer, byteOffset, byteLength)
		return new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);
	}

	cosineSimilarity(a: number[] | Float32Array, b: number[] | Float32Array): number {
		let dotProduct = 0;
		let normA = 0;
		let normB = 0;

		const minLen = Math.min(a.length, b.length);
		for (let i = 0; i < minLen; i++) {
			const aVal = a[i] ?? 0;
			const bVal = b[i] ?? 0;
			dotProduct += aVal * bVal;
			normA += aVal * aVal;
			normB += bVal * bVal;
		}

		const denominator = Math.sqrt(normA) * Math.sqrt(normB);
		if (denominator === 0) return 0;
		return dotProduct / denominator;
	}

	getModelName(): string {
		return 'mock-model';
	}

	getDimensions(): number {
		return this.dimensions;
	}

	getProvider(): string {
		return 'mock';
	}

	generateEmbedding(text: string): number[] {
		// Generate a pseudo-random embedding based on text hash
		let hash = 0;
		for (let i = 0; i < text.length; i++) {
			const char = text.charCodeAt(i);
			hash = (hash << 5) - hash + char;
			hash = hash & hash; // Convert to 32bit integer
		}

		const embedding: number[] = [];
		let seed = Math.abs(hash);
		for (let i = 0; i < this.dimensions; i++) {
			// Xorshift32 PRNG
			seed ^= seed << 13;
			seed ^= seed >> 17;
			seed ^= seed << 5;
			const value = ((seed & 0x7fffffff) / 0x7fffffff) * 2 - 1;
			embedding.push(value);
		}

		// Normalize to unit vector
		let norm = 0;
		for (const val of embedding) {
			norm += val * val;
		}
		norm = Math.sqrt(norm);
		return embedding.map(v => v / norm);
	}
}
