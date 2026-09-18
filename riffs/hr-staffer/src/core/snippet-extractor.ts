/**
 * Snippet extraction for hr-staffer search results.
 * Finds the most relevant window of content matching query terms.
 *
 * Adapted from hr-policy's snippet-extractor for staff directory use case.
 */

import type { SearchResultSnippet } from '../lib/types.js';
import { cleanQuery } from './stop-words.js';

interface MatchLocation {
	lineIndex: number;
	startCol: number;
	endCol: number;
	termIndex: number;
}

/**
 * Extract contextual snippet from document content around search query matches.
 * Uses sliding window to find region with highest match density.
 *
 * @param content - Full document content
 * @param query - Search query string
 * @param contextLines - Number of lines before/after best match (default: 2)
 * @returns SearchResultSnippet with line numbers, text, and match positions, or null if no matches
 */
export function extractSnippet(content: string, query: string, contextLines = 2): SearchResultSnippet | null {
	const lines = content.split('\n');

	const cleanedQuery = cleanQuery(query);
	const termCount = cleanedQuery.split(/\s+/).filter(t => t.length > 0).length;

	const matches = findAllMatches(lines, query);
	if (matches.length === 0) {
		return null;
	}

	const bestMatch = selectBestMatch(lines, matches, termCount);
	const centerLine = bestMatch.lineIndex;

	const startLine = Math.max(0, centerLine - contextLines);
	const endLine = Math.min(lines.length - 1, centerLine + contextLines);

	const snippetLines = lines.slice(startLine, endLine + 1);
	const snippetText = snippetLines.join('\n');

	const matchIndices = calculateMatchIndices(matches, startLine, endLine, snippetLines);

	const firstMatch = matchIndices[0];
	const lastMatch = matchIndices[matchIndices.length - 1];

	return {
		text: snippetText,
		startLine: startLine + 1,
		endLine: endLine + 1,
		matchStartCol: firstMatch?.start ?? 0,
		matchEndCol: lastMatch?.end ?? 0,
		matchIndices,
	};
}

/**
 * Find all occurrences of query terms in document lines (case-insensitive).
 */
function findAllMatches(lines: string[], query: string): MatchLocation[] {
	const matches: MatchLocation[] = [];

	const cleanedQuery = cleanQuery(query);
	const terms = cleanedQuery.split(/\s+/).filter(t => t.length > 0);
	if (terms.length === 0) return matches;

	const termPatterns = terms.map(term => new RegExp(escapeRegex(term), 'gi'));

	for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
		const line = lines[lineIndex];
		if (!line) continue;

		for (let termIndex = 0; termIndex < termPatterns.length; termIndex++) {
			const pattern = termPatterns[termIndex];
			if (!pattern) continue;

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
 * Finds the window of lines that contains the most unique query terms.
 */
function selectBestMatch(lines: string[], matches: MatchLocation[], termCount: number, windowSize = 15): MatchLocation {
	if (matches.length === 0) {
		throw new Error('No matches provided');
	}

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

	const matchedLines = Array.from(lineTerms.keys()).sort((a, b) => a - b);
	if (matchedLines.length === 0) {
		return matches[0] as MatchLocation;
	}

	if (matchedLines.length === 1) {
		const lineIdx = matchedLines[0] ?? 0;
		return lineFirstMatch.get(lineIdx) ?? (matches[0] as MatchLocation);
	}

	let bestWindowStart = 0;
	let bestWindowScore = -1;

	const totalLines = lines.length;

	for (let windowStart = 0; windowStart <= totalLines - windowSize; windowStart++) {
		const windowEnd = windowStart + windowSize - 1;

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

		const coverage = termCount > 0 ? windowTerms.size / termCount : 0;
		const density = matchCount / windowSize;
		const score = coverage * 10 + density;

		if (score > bestWindowScore) {
			bestWindowScore = score;
			bestWindowStart = windowStart;
		}

		if (windowTerms.size === termCount) {
			if (coverage === 1 && density > 0.5) {
				break;
			}
		}
	}

	const linesInWindow = matchedLines.filter(l => l >= bestWindowStart && l <= bestWindowStart + windowSize - 1);

	if (linesInWindow.length === 0) {
		return matches[0] as MatchLocation;
	}

	const minLine = Math.min(...linesInWindow);
	const maxLine = Math.max(...linesInWindow);
	const centerLine = Math.floor((minLine + maxLine) / 2);

	const centerMatch = matches.find(m => m.lineIndex === centerLine);
	if (centerMatch) return centerMatch;

	const sortedByDistance = [...matches]
		.filter(m => linesInWindow.includes(m.lineIndex))
		.sort((a, b) => Math.abs(a.lineIndex - centerLine) - Math.abs(b.lineIndex - centerLine));

	return sortedByDistance[0] ?? (matches[0] as MatchLocation);
}

/**
 * Calculate match indices relative to snippet text.
 */
function calculateMatchIndices(
	matches: MatchLocation[],
	startLine: number,
	endLine: number,
	snippetLines: string[]
): Array<{ start: number; end: number }> {
	const indices: Array<{ start: number; end: number }> = [];

	for (const match of matches) {
		if (match.lineIndex < startLine || match.lineIndex > endLine) {
			continue;
		}

		const relativeLineIndex = match.lineIndex - startLine;

		let charPos = 0;

		for (let i = 0; i < relativeLineIndex; i++) {
			const line = snippetLines[i];
			if (line) {
				charPos += line.length + 1;
			}
		}

		const matchStart = charPos + match.startCol;
		const matchEnd = charPos + match.endCol;

		indices.push({ start: matchStart, end: matchEnd });
	}

	indices.sort((a, b) => a.start - b.start);
	return mergeOverlappingIndices(indices);
}

/**
 * Merge overlapping or adjacent match indices.
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
