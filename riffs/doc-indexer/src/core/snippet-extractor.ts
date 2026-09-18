/**
 * Snippet extraction for search results.
 *
 * Uses a window-based approach to find the most relevant portion of a document
 * for a given search query. The algorithm finds the region with the highest
 * density of query term matches.
 */

import { cleanQuery } from './stop-words.js';

/**
 * Represents a snippet extracted from search results.
 */
export interface SearchResultSnippet {
	/** The extracted text snippet */
	text: string;
	/** Starting line number (0-indexed) */
	startLine: number;
	/** Ending line number (0-indexed, inclusive) */
	endLine: number;
	/** Column where first match starts */
	matchStartCol: number;
	/** Column where first match ends */
	matchEndCol: number;
	/** All match positions in the snippet text */
	matchIndices: Array<{ start: number; end: number }>;
}

/**
 * Match location in the content.
 */
interface MatchLocation {
	lineIndex: number;
	startCol: number;
	endCol: number;
	term: string;
}

/**
 * Find all match locations in the content for query terms.
 */
function findAllMatches(lines: string[], query: string): MatchLocation[] {
	const matches: MatchLocation[] = [];
	const cleaned = cleanQuery(query);
	const terms = cleaned.split(/\s+/).filter(t => t.length > 0);

	for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
		const line = lines[lineIndex];
		if (!line) continue;

		const lineLower = line.toLowerCase();

		for (const term of terms) {
			const termLower = term.toLowerCase();
			let pos = 0;

			while (true) {
				const idx = lineLower.indexOf(termLower, pos);
				if (idx === -1) break;

				matches.push({
					lineIndex,
					startCol: idx,
					endCol: idx + term.length,
					term,
				});
				pos = idx + 1;
			}
		}
	}

	return matches;
}

/**
 * Select the best match based on term count and density.
 * Prefers matches that have multiple terms close together.
 */
function selectBestMatch(_lines: string[], matches: MatchLocation[], _termCount: number): MatchLocation {
	const firstMatch = matches[0];
	if (matches.length === 1 && firstMatch) {
		return firstMatch;
	}

	// Group matches by line
	const lineMatches = new Map<number, MatchLocation[]>();
	for (const match of matches) {
		const existing = lineMatches.get(match.lineIndex) ?? [];
		existing.push(match);
		lineMatches.set(match.lineIndex, existing);
	}

	// Find line with most unique terms
	let bestLine = firstMatch?.lineIndex ?? 0;
	let bestUniqueTerms = 0;

	for (const [lineIndex, lineMatchList] of lineMatches) {
		const uniqueTerms = new Set(lineMatchList.map(m => m.term.toLowerCase())).size;
		if (uniqueTerms > bestUniqueTerms) {
			bestUniqueTerms = uniqueTerms;
			bestLine = lineIndex;
		}
	}

	// Return first match on best line, with fallback to first match overall
	const bestLineMatch = lineMatches.get(bestLine)?.[0];
	if (bestLineMatch) {
		return bestLineMatch;
	}
	if (firstMatch) {
		return firstMatch;
	}
	// This should never happen since we check matches.length > 0 before calling
	throw new Error('No matches found');
}

/**
 * Extract a snippet from content based on query matches.
 *
 * Uses a sliding window to find the region with highest match density.
 * Returns null if no matches are found.
 *
 * @param content - The full document content
 * @param query - The search query
 * @param contextLines - Number of lines of context around matches (default 2)
 * @returns Snippet with match information or null if no matches
 */
export function extractSnippet(content: string, query: string, contextLines: number = 2): SearchResultSnippet | null {
	const lines = content.split('\n');
	const cleanedQuery = cleanQuery(query);
	const termCount = cleanedQuery.split(/\s+/).filter(t => t.length > 0).length;

	const matches = findAllMatches(lines, query);

	if (matches.length === 0) {
		return null;
	}

	// Find best match location
	const bestMatch = selectBestMatch(lines, matches, termCount);

	// Calculate window bounds
	const startLine = Math.max(0, bestMatch.lineIndex - contextLines);
	const endLine = Math.min(lines.length - 1, bestMatch.lineIndex + contextLines);

	// Extract snippet text
	const snippetLines = lines.slice(startLine, endLine + 1);
	const text = snippetLines.join('\n');

	// Find all match indices in the snippet text
	const snippetMatches = findAllMatches(snippetLines, query);
	const matchIndices: Array<{ start: number; end: number }> = [];

	let currentPos = 0;
	for (let i = 0; i < snippetLines.length; i++) {
		const lineMatches = snippetMatches.filter(m => m.lineIndex === i);
		for (const match of lineMatches) {
			matchIndices.push({
				start: currentPos + match.startCol,
				end: currentPos + match.endCol,
			});
		}
		currentPos += (snippetLines[i]?.length ?? 0) + 1; // +1 for newline
	}

	// Calculate match position relative to snippet
	const relativeLineIndex = bestMatch.lineIndex - startLine;
	let matchStartInSnippet = 0;
	for (let i = 0; i < relativeLineIndex; i++) {
		matchStartInSnippet += (snippetLines[i]?.length ?? 0) + 1;
	}
	matchStartInSnippet += bestMatch.startCol;

	return {
		text,
		startLine,
		endLine,
		matchStartCol: matchStartInSnippet,
		matchEndCol: matchStartInSnippet + (bestMatch.endCol - bestMatch.startCol),
		matchIndices,
	};
}
