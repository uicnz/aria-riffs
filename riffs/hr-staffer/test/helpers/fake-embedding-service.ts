/**
 * Fake embedding service for testing.
 * Returns consistent fixed-size embeddings based on text hash.
 * No real API calls - fully deterministic for testing.
 */
export interface EmbeddingProvider {
	embedSingle(text: string): Promise<Float32Array>;
	getModelName(): string;
	getDimensions(): number;
}

export class FakeEmbeddingService implements EmbeddingProvider {
	private dimensions: number;
	private callCount = 0;
	private lastText = '';

	constructor(dimensions = 384) {
		this.dimensions = dimensions;
	}

	async embedSingle(text: string): Promise<Float32Array> {
		this.callCount++;
		this.lastText = text;
		return new Float32Array(this.generateEmbedding(text));
	}

	getModelName(): string {
		return 'fake-embedding-model';
	}

	getDimensions(): number {
		return this.dimensions;
	}

	// Test helpers
	getCallCount(): number {
		return this.callCount;
	}

	getLastText(): string {
		return this.lastText;
	}

	resetCallCount(): void {
		this.callCount = 0;
	}

	private generateEmbedding(text: string): number[] {
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
