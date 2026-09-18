/**
 * Sparse vector generation using feature hashing
 * Uses deterministic hashing so index/search produce matching term IDs
 */

import type { Logger } from 'pino';
import BM25 from 'wink-bm25-text-search';
import type { SparseConfig, SparseVector } from '../lib/types.js';

// Hash space size (1 million buckets - good balance of collision avoidance vs memory)
const HASH_SPACE = 1_000_000;

export class SparseVectorProvider {
	private bm25: typeof BM25.prototype;
	private logger: Logger;
	private _config: SparseConfig;
	private vocabulary: Map<string, number>;
	private nextTermId: number;

	constructor(config: SparseConfig, logger: Logger) {
		this._config = config;
		this.logger = logger;
		this.bm25 = BM25();
		this.vocabulary = new Map();
		this.nextTermId = 0;

		// Configure BM25 parameters with field weights
		this.bm25.defineConfig({
			fldWeights: { content: 1 },
			bm25Params: {
				k1: config.k1,
				b: config.b,
				k: 1.2,
			},
		});

		// Define simple tokenization pipeline
		const prepTask = (text: string) => {
			return text
				.toLowerCase()
				.split(/\s+/)
				.filter(token => token.length > 2)
				.map(token => token.replace(/[^a-z0-9]/g, ''))
				.filter(token => token.length > 0);
		};

		this.bm25.definePrepTasks([prepTask]);
	}

	/**
	 * Hash a token to a deterministic index (feature hashing / hashing trick)
	 * Same token always produces same index, no vocabulary persistence needed
	 */
	private hashToken(token: string): number {
		let hash = 0;
		for (let i = 0; i < token.length; i++) {
			const char = token.charCodeAt(i);
			hash = (hash * 31 + char) >>> 0; // unsigned 32-bit
		}
		return hash % HASH_SPACE;
	}

	/**
	 * Generate sparse vector for text
	 * Uses feature hashing for deterministic term IDs
	 */
	generateSparseVector(text: string): SparseVector {
		// Tokenize text
		const tokens = this.tokenize(text);

		// Build term frequency map using hash-based IDs
		const termFreq = new Map<number, number>();

		for (const token of tokens) {
			const termId = this.hashToken(token);
			termFreq.set(termId, (termFreq.get(termId) || 0) + 1);
		}

		// Convert to sparse vector format (sorted by index for consistency)
		const indices: number[] = [];
		const values: number[] = [];

		const sortedEntries = Array.from(termFreq.entries()).sort((a, b) => a[0] - b[0]);

		for (const [termId, freq] of sortedEntries) {
			indices.push(termId);
			values.push(freq);
		}

		this.logger.debug(
			{
				textLength: text.length,
				uniqueTerms: indices.length,
			},
			'Generated sparse vector'
		);

		return { indices, values };
	}

	/**
	 * Tokenize text using simple tokenization
	 */
	private tokenize(text: string): string[] {
		return text
			.toLowerCase()
			.split(/\s+/)
			.filter(token => token.length > 2)
			.map(token => token.replace(/[^a-z0-9]/g, ''))
			.filter(token => token.length > 0);
	}

	/**
	 * Build vocabulary from corpus
	 */
	async buildVocabulary(corpus: string[]): Promise<void> {
		this.logger.info({ corpusSize: corpus.length }, 'Building vocabulary');

		// Handle empty corpus
		if (corpus.length === 0) {
			return;
		}

		// Add all documents to BM25 index
		for (const [index, text] of corpus.entries()) {
			this.bm25.addDoc({ content: text }, index);
		}

		this.bm25.consolidate();

		// Extract vocabulary from corpus
		for (const text of corpus) {
			const tokens = this.tokenize(text);
			for (const token of tokens) {
				if (!this.vocabulary.has(token)) {
					this.vocabulary.set(token, this.nextTermId++);
				}
			}
		}

		this.logger.info({ vocabularySize: this.vocabulary.size }, 'Vocabulary built');
	}

	/**
	 * Get vocabulary size
	 */
	getVocabularySize(): number {
		return this.vocabulary.size;
	}

	/**
	 * Reset vocabulary
	 */
	reset(): void {
		this.vocabulary.clear();
		this.nextTermId = 0;
		this.bm25 = BM25();
		this.logger.debug('Sparse vector provider reset');
	}

	/**
	 * Get current configuration (for debugging/validation)
	 */
	getConfig(): SparseConfig {
		return this._config;
	}
}
