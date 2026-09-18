import OpenAI from 'openai';

interface EmbeddingData {
	embedding: number[];
}

interface EmbeddingResponse {
	data: EmbeddingData[];
}

export class EmbeddingService {
	private openai: OpenAI | null = null;
	private model: string;
	private dimensions: number;
	private maxChars: number;

	constructor(apiKey: string | undefined, model = 'text-embedding-3-large', dimensions = 3072, maxChars = 20000) {
		const key = apiKey || process.env.OPENAI_API_KEY;
		if (key) {
			this.openai = new OpenAI({ apiKey: key });
		}
		this.model = model;
		this.dimensions = dimensions;
		this.maxChars = maxChars;
	}

	async embedAll(texts: string[]): Promise<number[][]> {
		if (texts.length === 0) return [];
		if (!this.openai) throw new Error('OPENAI_API_KEY is required for embedding operations');

		// Truncate each input defensively and batch requests
		const sanitized = texts.map(t => (t.length > this.maxChars ? t.slice(0, this.maxChars) : t));
		const batchSize = 64;
		const out: number[][] = [];

		for (let i = 0; i < sanitized.length; i += batchSize) {
			const batch = sanitized.slice(i, i + batchSize);
			const resp = (await this.openai.embeddings.create({
				model: this.model,
				input: batch,
				dimensions: this.dimensions,
			})) as EmbeddingResponse;
			for (const d of resp.data) {
				out.push(d.embedding as number[]);
			}
		}
		return out;
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
}
