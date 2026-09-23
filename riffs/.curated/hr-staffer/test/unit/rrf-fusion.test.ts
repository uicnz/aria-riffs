import { describe, expect, it } from 'vitest';
import {
	calculateRRFScore,
	ftsResultsToRanked,
	fuseRankings,
	normalizeRRFScores,
	semanticResultsToRanked,
} from '../../src/core/rrf-fusion.js';

describe('calculateRRFScore', () => {
	it('given single rank, when calculateRRFScore called, then returns correct RRF score', () => {
		// RRF formula: 1 / (k + rank) where k = 60
		const score = calculateRRFScore([1]);
		expect(score).toBeCloseTo(1 / 61, 5); // 1 / (60 + 1)
	});

	it('given multiple ranks, when calculateRRFScore called, then sums individual scores', () => {
		const score = calculateRRFScore([1, 2]);
		// 1/(60+1) + 1/(60+2) = 1/61 + 1/62
		expect(score).toBeCloseTo(1 / 61 + 1 / 62, 5);
	});

	it('given higher ranks, when calculateRRFScore called, then returns lower scores', () => {
		const scoreRank1 = calculateRRFScore([1]);
		const scoreRank10 = calculateRRFScore([10]);
		expect(scoreRank1).toBeGreaterThan(scoreRank10);
	});
});

describe('fuseRankings', () => {
	it('given single pass, when fuseRankings called, then returns documents sorted by RRF score', () => {
		const passes = [
			[
				{ id: 'doc1', rank: 1 },
				{ id: 'doc2', rank: 2 },
				{ id: 'doc3', rank: 3 },
			],
		];

		const results = fuseRankings(passes);

		expect(results).toHaveLength(3);
		expect(results[0]?.id).toBe('doc1');
		expect(results[1]?.id).toBe('doc2');
		expect(results[2]?.id).toBe('doc3');
	});

	it('given multiple passes, when fuseRankings called, then fuses scores correctly', () => {
		const passes = [
			[
				{ id: 'doc1', rank: 1 },
				{ id: 'doc2', rank: 2 },
			],
			[
				{ id: 'doc2', rank: 1 },
				{ id: 'doc1', rank: 2 },
			],
		];

		const results = fuseRankings(passes);

		// Both documents appear in both passes, so they should have equal scores
		expect(results).toHaveLength(2);
		expect(results[0]?.passCount).toBe(2);
		expect(results[1]?.passCount).toBe(2);
	});

	it('given document in only one pass, when fuseRankings called, then has lower passCount', () => {
		const passes = [
			[
				{ id: 'doc1', rank: 1 },
				{ id: 'doc2', rank: 2 },
			],
			[{ id: 'doc1', rank: 1 }],
		];

		const results = fuseRankings(passes);

		const doc1 = results.find(r => r.id === 'doc1');
		const doc2 = results.find(r => r.id === 'doc2');

		expect(doc1?.passCount).toBe(2);
		expect(doc2?.passCount).toBe(1);
	});

	it('given empty passes, when fuseRankings called, then returns empty array', () => {
		const results = fuseRankings([]);
		expect(results).toEqual([]);
	});
});

describe('normalizeRRFScores', () => {
	it('given results with varying scores, when normalizeRRFScores called, then normalizes to 0-1', () => {
		const results = [
			{ id: 'doc1', rrfScore: 0.1, passCount: 2 },
			{ id: 'doc2', rrfScore: 0.05, passCount: 1 },
			{ id: 'doc3', rrfScore: 0.02, passCount: 1 },
		];

		const normalized = normalizeRRFScores(results);

		// Best score should be 1, worst should be 0
		expect(normalized[0]?.rrfScore).toBe(1);
		expect(normalized[2]?.rrfScore).toBe(0);
		expect(normalized[1]?.rrfScore).toBeGreaterThan(0);
		expect(normalized[1]?.rrfScore).toBeLessThan(1);
	});

	it('given results with same score, when normalizeRRFScores called, then all get score of 1', () => {
		const results = [
			{ id: 'doc1', rrfScore: 0.05, passCount: 1 },
			{ id: 'doc2', rrfScore: 0.05, passCount: 1 },
		];

		const normalized = normalizeRRFScores(results);

		expect(normalized[0]?.rrfScore).toBe(1);
		expect(normalized[1]?.rrfScore).toBe(1);
	});

	it('given empty results, when normalizeRRFScores called, then returns empty array', () => {
		const normalized = normalizeRRFScores([]);
		expect(normalized).toEqual([]);
	});
});

describe('ftsResultsToRanked', () => {
	it('given FTS results with BM25 scores, when ftsResultsToRanked called, then sorts by rank ascending', () => {
		// BM25 returns negative scores where more negative = better match
		const ftsResults = [
			{ id: 'doc2', rank: -4.5 },
			{ id: 'doc1', rank: -5.0 }, // Best match (most negative)
			{ id: 'doc3', rank: -3.0 },
		];

		const ranked = ftsResultsToRanked(ftsResults);

		// Should be sorted by original rank ascending (most negative first)
		expect(ranked[0]?.id).toBe('doc1'); // -5.0 is most negative
		expect(ranked[1]?.id).toBe('doc2'); // -4.5
		expect(ranked[2]?.id).toBe('doc3'); // -3.0
	});

	it('given FTS results, when ftsResultsToRanked called, then assigns 1-based ranks', () => {
		const ftsResults = [
			{ id: 'doc1', rank: -5.0 },
			{ id: 'doc2', rank: -4.0 },
		];

		const ranked = ftsResultsToRanked(ftsResults);

		expect(ranked[0]?.rank).toBe(1);
		expect(ranked[1]?.rank).toBe(2);
	});
});

describe('semanticResultsToRanked', () => {
	it('given semantic results with similarity scores, when semanticResultsToRanked called, then sorts descending', () => {
		const semanticResults = [
			{ id: 'doc2', score: 0.7 },
			{ id: 'doc1', score: 0.9 }, // Best match (highest)
			{ id: 'doc3', score: 0.5 },
		];

		const ranked = semanticResultsToRanked(semanticResults);

		// Should be sorted by score descending (highest first)
		expect(ranked[0]?.id).toBe('doc1'); // 0.9
		expect(ranked[1]?.id).toBe('doc2'); // 0.7
		expect(ranked[2]?.id).toBe('doc3'); // 0.5
	});

	it('given semantic results, when semanticResultsToRanked called, then assigns 1-based ranks', () => {
		const semanticResults = [
			{ id: 'doc1', score: 0.9 },
			{ id: 'doc2', score: 0.7 },
		];

		const ranked = semanticResultsToRanked(semanticResults);

		expect(ranked[0]?.rank).toBe(1);
		expect(ranked[1]?.rank).toBe(2);
	});
});
