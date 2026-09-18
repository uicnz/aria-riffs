/**
 * Unit tests for SparseVectorProvider
 */

import pino from 'pino';
import { beforeEach, describe, expect, it } from 'vitest';
import type { SparseConfig } from '../../src/lib/types.js';
import { SparseVectorProvider } from '../../src/providers/sparse-vectors.js';

describe('SparseVectorProvider', () => {
	let provider: SparseVectorProvider;
	let logger: pino.Logger;
	let config: SparseConfig;

	beforeEach(() => {
		logger = pino({ level: 'silent' });
		config = {
			enabled: true,
			k1: 1.5,
			b: 0.75,
		};
		provider = new SparseVectorProvider(config, logger);
	});

	describe('generateSparseVector', () => {
		it('should generate sparse vector from text', () => {
			const text = 'This is a test document';
			const vector = provider.generateSparseVector(text);

			expect(vector.indices).toBeDefined();
			expect(vector.values).toBeDefined();
			expect(vector.indices.length).toBe(vector.values.length);
			expect(vector.indices.length).toBeGreaterThan(0);
		});

		it('should generate different vectors for different text', () => {
			const text1 = 'First document with unique content';
			const text2 = 'Second document with different words';

			const vector1 = provider.generateSparseVector(text1);
			const vector2 = provider.generateSparseVector(text2);

			// Vectors should be different
			expect(vector1.indices).not.toEqual(vector2.indices);
		});

		it('should handle empty text', () => {
			const text = '';
			const vector = provider.generateSparseVector(text);

			expect(vector.indices).toBeDefined();
			expect(vector.values).toBeDefined();
		});

		it('should use feature hashing (stateless, no vocabulary tracking)', () => {
			// Feature hashing is deterministic - same text produces same vector
			const vector1 = provider.generateSparseVector('first document');
			const vector2 = provider.generateSparseVector('first document');

			expect(vector1.indices).toEqual(vector2.indices);
			expect(vector1.values).toEqual(vector2.values);

			// Vocabulary is only built via buildVocabulary(), not generateSparseVector()
			expect(provider.getVocabularySize()).toBe(0);
		});
	});

	describe('buildVocabulary', () => {
		it('should build vocabulary from corpus', async () => {
			const corpus = [
				'First document about technology',
				'Second document about science',
				'Third document about research',
			];

			await provider.buildVocabulary(corpus);

			const vocabSize = provider.getVocabularySize();
			expect(vocabSize).toBeGreaterThan(0);
		});

		it('should handle empty corpus', async () => {
			await provider.buildVocabulary([]);

			const vocabSize = provider.getVocabularySize();
			expect(vocabSize).toBe(0);
		});
	});

	describe('reset', () => {
		it('should reset vocabulary built via buildVocabulary', async () => {
			// Build vocabulary explicitly (generateSparseVector uses feature hashing, not vocabulary)
			// BM25 requires at least 3 documents for consolidation
			await provider.buildVocabulary(['first document', 'second document', 'third document']);
			expect(provider.getVocabularySize()).toBeGreaterThan(0);

			provider.reset();

			expect(provider.getVocabularySize()).toBe(0);
		});
	});

	describe('getConfig', () => {
		it('should return configuration', () => {
			const returnedConfig = provider.getConfig();

			expect(returnedConfig).toEqual(config);
			expect(returnedConfig.k1).toBe(1.5);
			expect(returnedConfig.b).toBe(0.75);
		});
	});
});
