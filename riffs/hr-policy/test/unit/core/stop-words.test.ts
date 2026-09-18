import { describe, expect, it } from 'vitest';
import { cleanQuery } from '../../../src/core/stop-words.js';

describe('cleanQuery', () => {
	it('given query with stop words, when cleanQuery called, then removes stop words', () => {
		const result = cleanQuery('the quick brown fox');
		expect(result).toBe('quick brown fox');
	});

	it('given query with multiple stop words, when cleanQuery called, then removes all stop words', () => {
		const result = cleanQuery('what is the policy for leave');
		expect(result).toBe('policy leave');
	});

	it('given query with only stop words, when cleanQuery called, then keeps longest word', () => {
		const result = cleanQuery('the and or');
		expect(result).toBe('the');
	});

	it('given query with mixed case, when cleanQuery called, then handles case insensitively', () => {
		const result = cleanQuery('The QUICK Brown FOX');
		expect(result).toBe('quick brown fox');
	});

	it('given query with no stop words, when cleanQuery called, then returns all words', () => {
		const result = cleanQuery('defibrillator emergency procedure');
		expect(result).toBe('defibrillator emergency procedure');
	});

	it('given empty query, when cleanQuery called, then returns empty string', () => {
		const result = cleanQuery('');
		expect(result).toBe('');
	});

	it('given single meaningful word, when cleanQuery called, then returns that word', () => {
		const result = cleanQuery('policy');
		expect(result).toBe('policy');
	});

	it('given query with prepositions, when cleanQuery called, then removes prepositions', () => {
		const result = cleanQuery('policy for employees in office');
		expect(result).toBe('policy employees office');
	});

	it('given query with auxiliary verbs, when cleanQuery called, then removes auxiliary verbs', () => {
		const result = cleanQuery('what would employees have');
		expect(result).toBe('employees');
	});

	it('given query with question mark, when cleanQuery called, then strips punctuation', () => {
		const result = cleanQuery('where is the aed in the dunedin office?');
		expect(result).toBe('aed dunedin office');
	});

	it('given query with various punctuation, when cleanQuery called, then strips all punctuation', () => {
		const result = cleanQuery("what's the policy, rules & guidelines!");
		// "what's" becomes "whats" after punctuation stripping (different from stop word "what")
		expect(result).toBe('whats policy rules guidelines');
	});

	it('given query with hyphens, when cleanQuery called, then removes hyphens', () => {
		const result = cleanQuery('full-time work-life balance');
		expect(result).toBe('fulltime worklife balance');
	});

	it('given query with question words, when cleanQuery called, then removes question words but keeps longest', () => {
		const result = cleanQuery('what where why how when who');
		// All are stop words, so keeps longest (where/when are both 5 chars, where comes first)
		expect(result).toBe('where');
	});

	it('given query with question words and meaningful words, when cleanQuery called, then removes only question words', () => {
		const result = cleanQuery('what is the policy where employees work');
		expect(result).toBe('policy employees work');
	});

	it('given query with who/whom/whose, when cleanQuery called, then removes all forms', () => {
		const result = cleanQuery('who is this employee whose job is critical');
		expect(result).toBe('employee job critical');
	});
});
