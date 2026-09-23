/**
 * Stop word filtering for FTS5 lexical search queries.
 * Removes common words that add noise to search results.
 *
 * Stop words are loaded from config - no hardcoded values.
 */

import type { SearchConfig } from '../lib/types.js';

/**
 * Set of stop words to filter.
 * Initialized via initStopWords() from config.
 */
let stopWordsSet = new Set<string>();

/**
 * Initialize stop words from config.
 * Must be called before using other functions.
 */
export function initStopWords(config: SearchConfig): void {
	stopWordsSet = new Set(config.stopWords.map(w => w.toLowerCase()));
}

/**
 * Remove punctuation characters from a string.
 * Keeps only alphanumeric characters and spaces.
 */
function stripPunctuation(text: string): string {
	return text.replace(/[^\w\s]/g, '');
}

/**
 * Remove stop words and punctuation from a search query.
 * If all words are stop words, keeps the longest word.
 */
export function cleanQuery(query: string): string {
	// Strip punctuation first, then lowercase and tokenize
	const normalized = stripPunctuation(query).toLowerCase();
	const tokens = normalized.split(/\s+/).filter(t => t.length > 0);
	const cleaned = tokens.filter(t => !stopWordsSet.has(t));

	// If we removed everything, keep the longest word
	if (cleaned.length === 0 && tokens.length > 0) {
		const longest = tokens.reduce((a, b) => (a.length >= b.length ? a : b));
		return longest;
	}

	return cleaned.join(' ');
}

/**
 * Get the set of stop words for use in field matching.
 * Used by search to filter query terms before matching against fields.
 */
export function getStopWords(): Set<string> {
	return stopWordsSet;
}
