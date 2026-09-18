/**
 * Stop word filtering for FTS5 lexical search queries.
 * Removes common words that add noise to search results.
 */

const STOP_WORDS = new Set([
	// Articles
	'a',
	'an',
	'the',
	// Conjunctions
	'and',
	'or',
	'but',
	'nor',
	'yet',
	'so',
	'because',
	'since',
	'although',
	'unless',
	'if',
	'as',
	// Prepositions
	'at',
	'by',
	'for',
	'from',
	'in',
	'into',
	'of',
	'on',
	'to',
	'with',
	'without',
	'under',
	'over',
	'through',
	'after',
	'before',
	'above',
	'below',
	'between',
	'during',
	'while',
	'about',
	'against',
	'among',
	'until',
	// Pronouns
	'i',
	'me',
	'my',
	'we',
	'our',
	'you',
	'your',
	'he',
	'she',
	'it',
	'they',
	'them',
	'their',
	// Be verbs
	'is',
	'are',
	'was',
	'were',
	'am',
	'been',
	'being',
	'be',
	// Auxiliary verbs
	'have',
	'has',
	'had',
	'do',
	'does',
	'did',
	'will',
	'would',
	'could',
	'should',
	'may',
	'might',
	'must',
	'can',
	// Common adverbs
	'not',
	'just',
	'only',
	'very',
	'really',
	'still',
	'also',
	'even',
	'ever',
	'never',
	'too',
	// Question words
	'what',
	'when',
	'where',
	'who',
	'whom',
	'whose',
	'why',
	'how',
	'which',
	// Demonstratives and quantifiers
	'this',
	'that',
	'these',
	'those',
	'all',
	'any',
	'both',
	'each',
	'few',
	'more',
	'most',
	'other',
	'some',
	'such',
	'than',
	'then',
	'there',
]);

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
	const cleaned = tokens.filter(t => !STOP_WORDS.has(t));

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
	return STOP_WORDS;
}
