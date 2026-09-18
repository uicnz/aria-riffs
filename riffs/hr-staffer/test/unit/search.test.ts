import { describe, expect, it } from 'vitest';
import { bufferToVector, calculateNameScore, calculateTitleScore, cosineSimilarity } from '../../src/core/search.js';
import { cleanQuery } from '../../src/core/stop-words.js';

describe('cosineSimilarity', () => {
	it('given identical vectors, when cosineSimilarity called, then returns 1', () => {
		const a = new Float32Array([1, 0, 0]);
		const b = new Float32Array([1, 0, 0]);
		expect(cosineSimilarity(a, b)).toBeCloseTo(1, 5);
	});

	it('given orthogonal vectors, when cosineSimilarity called, then returns 0', () => {
		const a = new Float32Array([1, 0, 0]);
		const b = new Float32Array([0, 1, 0]);
		expect(cosineSimilarity(a, b)).toBeCloseTo(0, 5);
	});

	it('given opposite vectors, when cosineSimilarity called, then returns -1', () => {
		const a = new Float32Array([1, 0, 0]);
		const b = new Float32Array([-1, 0, 0]);
		expect(cosineSimilarity(a, b)).toBeCloseTo(-1, 5);
	});
});

describe('bufferToVector', () => {
	it('given buffer from Float32Array, when bufferToVector called, then returns original values', () => {
		const original = new Float32Array([0.1, 0.2, 0.3]);
		const buffer = Buffer.from(original.buffer);
		const result = bufferToVector(buffer);
		expect(result.length).toBe(3);
		expect(result[0]).toBeCloseTo(0.1, 5);
		expect(result[1]).toBeCloseTo(0.2, 5);
		expect(result[2]).toBeCloseTo(0.3, 5);
	});
});

describe('calculateTitleScore', () => {
	it('given exact match, when calculateTitleScore called, then returns 1.0', () => {
		expect(calculateTitleScore('Network Engineer', 'Network Engineer')).toBe(1.0);
	});

	it('given query contained in title, when calculateTitleScore called, then returns 0.9', () => {
		expect(calculateTitleScore('Engineer', 'Network Engineer')).toBe(0.9);
	});

	it('given no match, when calculateTitleScore called, then returns 0', () => {
		expect(calculateTitleScore('Shane Holloman', 'Head of AI')).toBe(0);
	});

	it('given empty title, when calculateTitleScore called, then returns 0', () => {
		expect(calculateTitleScore('anything', '')).toBe(0);
	});
});

describe('calculateNameScore', () => {
	it('given exact name in doc ID and content, when calculateNameScore called, then returns 1.0', () => {
		const score = calculateNameScore('Shane Holloman', '0028-shane-holloman', '# Shane Holloman\n\nHead of AI');
		expect(score).toBe(1.0);
	});

	it('given partial name match, when calculateNameScore called, then returns partial score', () => {
		const score = calculateNameScore('Shane', '0028-shane-holloman', '# Shane Holloman\n\nHead of AI');
		expect(score).toBeGreaterThan(0);
		expect(score).toBeLessThanOrEqual(1);
	});

	it('given no name match, when calculateNameScore called, then returns 0', () => {
		const score = calculateNameScore('Jane Smith', '0028-shane-holloman', '# Shane Holloman\n\nHead of AI');
		expect(score).toBe(0);
	});
});

describe('cleanQuery', () => {
	it('given query with stop words, when cleanQuery called, then removes stop words', () => {
		const result = cleanQuery('what is the policy for leave');
		expect(result).toBe('policy leave');
	});

	it('given query with only stop words, when cleanQuery called, then keeps longest word', () => {
		const result = cleanQuery('what is the');
		expect(result).toBe('what');
	});

	it('given query with punctuation, when cleanQuery called, then strips punctuation', () => {
		const result = cleanQuery('find the policy?');
		expect(result).toBe('find policy');
	});
});
