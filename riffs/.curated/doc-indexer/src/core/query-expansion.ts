/**
 * Query expansion for RFP document searches.
 * Provides synonym groups for IT/business terms and abbreviations
 * to improve search recall.
 *
 * All mappings are loaded from config - no hardcoded values.
 */

import type { SearchConfig } from '../lib/types.js';

/**
 * Search config with abbreviations and synonyms.
 * Set via initQueryExpansion() before using other functions.
 */
let searchConfig: SearchConfig = {
	abbreviations: {},
	synonyms: [],
	stopWords: [],
};

/**
 * Synonym index for fast lookup.
 * Maps each term to its group index.
 */
let synonymIndex = new Map<string, number>();

/**
 * Initialize query expansion with config.
 * Must be called before using expansion functions.
 */
export function initQueryExpansion(config: SearchConfig): void {
	searchConfig = config;

	// Build synonym index
	synonymIndex = new Map<string, number>();
	for (let i = 0; i < searchConfig.synonyms.length; i++) {
		const group = searchConfig.synonyms[i];
		if (group) {
			for (const term of group) {
				synonymIndex.set(term.toLowerCase(), i);
			}
		}
	}
}

/**
 * Expand abbreviation to its full terms.
 */
export function expandAbbreviation(term: string): string[] {
	return searchConfig.abbreviations[term.toLowerCase()] ?? [];
}

/**
 * Get synonyms for a single term.
 * Returns an array including the original term plus any synonyms.
 */
export function getSynonyms(term: string): string[] {
	const normalized = term.toLowerCase();
	const groupIndex = synonymIndex.get(normalized);

	if (groupIndex === undefined) {
		return [term];
	}

	const group = searchConfig.synonyms[groupIndex];
	if (!group) {
		return [term];
	}

	// Return all terms from the group (includes original)
	return [...group];
}

/**
 * Expand a query by adding synonyms and abbreviation expansions.
 * Returns an array of all terms deduplicated.
 */
export function expandQuery(query: string): string[] {
	const terms = query
		.toLowerCase()
		.split(/\s+/)
		.filter(t => t.length > 0);

	const expanded = new Set<string>();

	for (const term of terms) {
		expanded.add(term);

		const synonyms = getSynonyms(term);
		for (const syn of synonyms) {
			expanded.add(syn);
		}

		const abbrevExpansion = expandAbbreviation(term);
		for (const exp of abbrevExpansion) {
			expanded.add(exp);
		}
	}

	return Array.from(expanded);
}

/**
 * Check if a query contains terms that can be expanded.
 * Useful for deciding whether to run an expanded search pass.
 */
export function hasExpandableTerms(query: string): boolean {
	const terms = query
		.toLowerCase()
		.split(/\s+/)
		.filter(t => t.length > 0);

	for (const term of terms) {
		if (synonymIndex.has(term)) {
			return true;
		}
		if (searchConfig.abbreviations[term]) {
			return true;
		}
	}

	return false;
}

/**
 * Get original query terms without stop words.
 * Used for the base FTS pass.
 */
export function getQueryTerms(query: string): string[] {
	return query
		.toLowerCase()
		.split(/\s+/)
		.filter(t => t.length > 2);
}
