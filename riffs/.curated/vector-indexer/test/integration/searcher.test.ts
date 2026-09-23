/**
 * Integration tests for Searcher
 * These tests require Ollama and Qdrant to be running
 */

import pino from 'pino';
import { beforeAll, describe, expect, it } from 'vitest';
import { Searcher } from '../../src/core/searcher.js';
import { getDefaultConfig } from '../../src/lib/config.js';

describe.skip('Searcher Integration', () => {
	let searcher: Searcher;
	let logger: pino.Logger;
	const testCollection = 'test-search';

	beforeAll(() => {
		logger = pino({ level: 'silent' });
		const config = getDefaultConfig();
		searcher = new Searcher(config, logger);
	});

	it('should search indexed documents', async () => {
		const results = await searcher.search('test query', {
			collection: testCollection,
			topK: 10,
			finalK: 5,
			denseWeight: 0.7,
			sparseWeight: 0.3,
			rerank: false,
		});

		expect(Array.isArray(results)).toBe(true);
		expect(results.length).toBeLessThanOrEqual(5);
	}, 60000);

	it('should return results sorted by score', async () => {
		const results = await searcher.search('test query', {
			collection: testCollection,
			topK: 10,
			finalK: 5,
			denseWeight: 0.7,
			sparseWeight: 0.3,
			rerank: false,
		});

		// Verify scores are in descending order
		for (let i = 1; i < results.length; i++) {
			expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
		}
	}, 60000);

	it('should apply re-ranking when enabled', async () => {
		const withoutRerank = await searcher.search('test query', {
			collection: testCollection,
			topK: 10,
			finalK: 5,
			denseWeight: 0.7,
			sparseWeight: 0.3,
			rerank: false,
		});

		const withRerank = await searcher.search('test query', {
			collection: testCollection,
			topK: 10,
			finalK: 5,
			denseWeight: 0.7,
			sparseWeight: 0.3,
			rerank: true,
		});

		// Results may be different due to re-ranking
		expect(withoutRerank.length).toBeLessThanOrEqual(5);
		expect(withRerank.length).toBeLessThanOrEqual(5);
	}, 120000);
});
