import type { SearchResultSnippet } from '../lib/types.js';
import { cleanQuery } from './stop-words.js';

interface MatchLocation {
	lineIndex: number;
	startCol: number;
	endCol: number;
	termIndex: number; // Which search term this match corresponds to
}

/**
 * Extract contextual snippet from document content around search query matches.
 * Handles multi-word queries and finds the region with highest match density.
 *
 * @param content - Full document content (markdown)
 * @param query - Search query string
 * @param contextLines - Number of lines before/after best match (default: 2)
 * @returns SearchResultSnippet with line numbers, text, and match positions, or null if no matches found
 */
export function extractSnippet(content: string, query: string, contextLines = 2): SearchResultSnippet | null {
	const lines = content.split('\n');

	// Clean query to get term count for coverage calculation
	const cleanedQuery = cleanQuery(query);
	const termCount = cleanedQuery.split(/\s+/).filter(t => t.length > 0).length;

	// Find all match locations
	const matches = findAllMatches(lines, query);
	if (matches.length === 0) {
		return null;
	}

	// Find best match region (prioritizing term coverage, then match count)
	const bestMatch = selectBestMatch(lines, matches, termCount);
	const centerLine = bestMatch.lineIndex;

	// Calculate snippet window
	const startLine = Math.max(0, centerLine - contextLines);
	const endLine = Math.min(lines.length - 1, centerLine + contextLines);

	// Extract snippet text
	const snippetLines = lines.slice(startLine, endLine + 1);
	const snippetText = snippetLines.join('\n');

	// Find match positions within snippet
	const matchIndices = calculateMatchIndices(matches, startLine, endLine, snippetLines);

	// Get first and last match positions for metadata
	const firstMatch = matchIndices[0];
	const lastMatch = matchIndices[matchIndices.length - 1];

	return {
		text: snippetText,
		startLine: startLine + 1, // Convert to 1-indexed
		endLine: endLine + 1, // Convert to 1-indexed
		matchStartCol: firstMatch?.start ?? 0,
		matchEndCol: lastMatch?.end ?? 0,
		matchIndices,
	};
}

/**
 * Find all occurrences of query terms in document lines (case-insensitive).
 * Handles multi-word queries by creating a regex for any term.
 * Stop words are filtered out to focus on meaningful terms.
 * Each match includes which term it corresponds to for coverage calculation.
 */
function findAllMatches(lines: string[], query: string): MatchLocation[] {
	const matches: MatchLocation[] = [];

	// Clean query to remove stop words, then extract terms
	const cleanedQuery = cleanQuery(query);
	const terms = cleanedQuery.split(/\s+/).filter(t => t.length > 0);
	if (terms.length === 0) return matches;

	// Create individual patterns for each term to track which term matched
	const termPatterns = terms.map(term => new RegExp(escapeRegex(term), 'gi'));

	for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
		const line = lines[lineIndex];
		if (!line) continue;

		// Check each term pattern separately to track termIndex
		for (let termIndex = 0; termIndex < termPatterns.length; termIndex++) {
			const pattern = termPatterns[termIndex];
			if (!pattern) continue;

			// Reset regex state
			pattern.lastIndex = 0;

			let match: RegExpExecArray | null = pattern.exec(line);
			while (match !== null) {
				matches.push({
					lineIndex,
					startCol: match.index,
					endCol: match.index + match[0].length,
					termIndex,
				});
				match = pattern.exec(line);
			}
		}
	}

	return matches;
}

/**
 * Select best match region using a sliding window approach.
 * This finds the window of lines that contains the most unique query terms,
 * even when terms are spread across different lines.
 *
 * For example, if "Dunedin" is on line 1 (heading) and "AED" is on line 11 (content),
 * a window approach will find the region containing BOTH terms.
 *
 * @param lines - All document lines
 * @param matches - All match locations
 * @param termCount - Total number of query terms
 * @param windowSize - Size of sliding window (default: 15 lines)
 */
function selectBestMatch(lines: string[], matches: MatchLocation[], termCount: number, windowSize = 15): MatchLocation {
	if (matches.length === 0) {
		throw new Error('No matches provided');
	}

	// Build a map of which terms appear on which lines
	const lineTerms = new Map<number, Set<number>>();
	const lineFirstMatch = new Map<number, MatchLocation>();

	for (const match of matches) {
		const existing = lineTerms.get(match.lineIndex);
		if (existing) {
			existing.add(match.termIndex);
		} else {
			lineTerms.set(match.lineIndex, new Set([match.termIndex]));
			lineFirstMatch.set(match.lineIndex, match);
		}
	}

	// Get sorted unique line indices that have matches
	const matchedLines = Array.from(lineTerms.keys()).sort((a, b) => a - b);
	if (matchedLines.length === 0) {
		return matches[0] as MatchLocation;
	}

	// Single-line edge case
	if (matchedLines.length === 1) {
		const lineIdx = matchedLines[0] ?? 0;
		return lineFirstMatch.get(lineIdx) ?? (matches[0] as MatchLocation);
	}

	// Sliding window: find the window with best term coverage
	let bestWindowStart = 0;
	let bestWindowScore = -1;

	const totalLines = lines.length;

	for (let windowStart = 0; windowStart <= totalLines - windowSize; windowStart++) {
		const windowEnd = windowStart + windowSize - 1;

		// Collect unique terms in this window
		const windowTerms = new Set<number>();
		let matchCount = 0;

		for (const lineIdx of matchedLines) {
			if (lineIdx >= windowStart && lineIdx <= windowEnd) {
				const terms = lineTerms.get(lineIdx);
				if (terms) {
					for (const t of terms) {
						windowTerms.add(t);
					}
					matchCount++;
				}
			}
		}

		// Score: prioritize term coverage, then match density
		const coverage = termCount > 0 ? windowTerms.size / termCount : 0;
		const density = matchCount / windowSize;
		const score = coverage * 10 + density; // Coverage is 10x more important

		if (score > bestWindowScore) {
			bestWindowScore = score;
			bestWindowStart = windowStart;
		}

		// Perfect coverage - can stop early
		if (windowTerms.size === termCount) {
			// But keep looking for a tighter window
			if (coverage === 1 && density > 0.5) {
				break;
			}
		}
	}

	// Find the center of matched lines within the best window
	const linesInWindow = matchedLines.filter(l => l >= bestWindowStart && l <= bestWindowStart + windowSize - 1);

	if (linesInWindow.length === 0) {
		return matches[0] as MatchLocation;
	}

	// If we have multiple terms spread across lines, center on the middle of the matched region
	const minLine = Math.min(...linesInWindow);
	const maxLine = Math.max(...linesInWindow);
	const centerLine = Math.floor((minLine + maxLine) / 2);

	// Find a match near the center
	const centerMatch = matches.find(m => m.lineIndex === centerLine);
	if (centerMatch) return centerMatch;

	// Fallback to match closest to center
	const sortedByDistance = [...matches]
		.filter(m => linesInWindow.includes(m.lineIndex))
		.sort((a, b) => Math.abs(a.lineIndex - centerLine) - Math.abs(b.lineIndex - centerLine));

	return sortedByDistance[0] ?? (matches[0] as MatchLocation);
}

/**
 * Calculate match indices relative to snippet text.
 * Converts absolute line/column positions to relative positions within snippet.
 */
function calculateMatchIndices(
	matches: MatchLocation[],
	startLine: number,
	endLine: number,
	snippetLines: string[]
): Array<{ start: number; end: number }> {
	const indices: Array<{ start: number; end: number }> = [];

	for (const match of matches) {
		// Only include matches within snippet window
		if (match.lineIndex < startLine || match.lineIndex > endLine) {
			continue;
		}

		// Calculate relative position in snippet
		const relativeLineIndex = match.lineIndex - startLine;

		// Calculate character position in full snippet text
		// Need to account for newlines between lines
		let charPos = 0;

		// Add characters from all lines before this one
		for (let i = 0; i < relativeLineIndex; i++) {
			const line = snippetLines[i];
			if (line) {
				charPos += line.length + 1; // +1 for newline
			}
		}

		const matchStart = charPos + match.startCol;
		const matchEnd = charPos + match.endCol;

		indices.push({ start: matchStart, end: matchEnd });
	}

	// Sort by start position and merge overlapping indices
	indices.sort((a, b) => a.start - b.start);
	return mergeOverlappingIndices(indices);
}

/**
 * Merge overlapping or adjacent match indices.
 * Prevents double-highlighting of overlapping matches.
 */
function mergeOverlappingIndices(
	indices: Array<{ start: number; end: number }>
): Array<{ start: number; end: number }> {
	if (indices.length === 0) return [];

	const firstIndex = indices[0];
	if (!firstIndex) return [];

	const merged: Array<{ start: number; end: number }> = [firstIndex];

	for (let i = 1; i < indices.length; i++) {
		const current = indices[i];
		const last = merged[merged.length - 1];

		if (!current || !last) continue;

		// If current overlaps or is adjacent to last, merge them
		if (current.start <= last.end) {
			last.end = Math.max(last.end, current.end);
		} else {
			merged.push(current);
		}
	}

	return merged;
}

/**
 * Escape special regex characters in string.
 */
function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
