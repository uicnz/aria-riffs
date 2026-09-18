/**
 * RFP request/response pair extractor
 */

import type { Logger } from 'pino';
import { REGEX_PATTERNS, RESPONSE_TEMPLATES } from '../lib/config.js';
import type { RfpPair } from '../lib/types.js';
import { extractValue } from '../utils/utils.js';

/**
 * Extract RFP request/response pairs from content
 */
export function extractRfpPairs(content: string): RfpPair[] {
	const rfpPairs: RfpPair[] = [];
	const importantRegex = REGEX_PATTERNS.IMPORTANT_BLOCK;

	// Reset regex state
	importantRegex.lastIndex = 0;

	let importantMatch: RegExpExecArray | null;
	// biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex exec pattern
	while ((importantMatch = importantRegex.exec(content)) !== null) {
		const Identifier = importantMatch[1];
		const importantBlock = importantMatch[0];

		if (!Identifier) continue;

		// Extract priority from the important block
		const Priority = extractValue(importantBlock, /-\s+Priority:\s+(.*?)(?=\n|$)/) || 'Should Comply'; // Default if not found

		// Find the corresponding NOTE block that references this identifier
		const companyName = RESPONSE_TEMPLATES.companyName || '[^\\s]+';
		const noteRegexPattern = `>\\s*\\[!NOTE\\][\\s\\S]*?See ${companyName} response to ${Identifier}`;
		const noteRegex = new RegExp(noteRegexPattern, 'g');

		// Start searching from the end of the IMPORTANT block
		const searchStartPos = importantMatch.index + importantBlock.length;
		const searchText = content.substring(searchStartPos);

		const noteMatch = noteRegex.exec(searchText);
		if (noteMatch) {
			const noteBlock = noteMatch[0];
			const noteBlockAbsoluteIndex = searchStartPos + noteMatch.index;

			// Find the heading for this pair by looking backward from the IMPORTANT block
			const contentBeforeImportant = content.substring(0, importantMatch.index);
			const headingMatch = contentBeforeImportant.match(REGEX_PATTERNS.HEADING);
			const Title = headingMatch?.[1]?.trim() ?? `Unknown (${Identifier})`;

			// Extract request content - everything between IMPORTANT block and NOTE block
			const requestContentStart = importantMatch.index + importantBlock.length;
			const requestContentEnd = noteBlockAbsoluteIndex;

			// Get the raw request content
			let Request = content.substring(requestContentStart, requestContentEnd);

			// Trim trailing whitespace
			Request = Request.trimEnd();

			// Extract response content - everything after the NOTE block until the next IMPORTANT block
			const noteBlockEndIndex = content.indexOf('\n', noteBlockAbsoluteIndex + noteBlock.length);
			const responseContentStart = noteBlockEndIndex + 1;

			// Find the next IMPORTANT block after this NOTE block
			const nextImportantIndex = content.indexOf('> [!IMPORTANT]', responseContentStart);

			let responseContentEnd = content.length;

			if (nextImportantIndex > -1) {
				// Simply end at the next IMPORTANT block
				responseContentEnd = nextImportantIndex;
			}

			// Extract the response content
			let Response = content.substring(responseContentStart, responseContentEnd).trim();

			// Check if the last line is a heading and remove it if so
			const responseLines = Response.split('\n');
			let linesToKeep = responseLines.length;

			// Work backwards to find and remove any trailing heading
			for (let i = responseLines.length - 1; i >= 0; i--) {
				const line = responseLines[i]?.trim() || '';
				if (line === '') {
					continue; // Skip empty lines
				}
				// If we find a heading, exclude it and everything after
				if (line.startsWith('#')) {
					linesToKeep = i;
					break;
				}
				// If we find non-heading content, keep everything
				break;
			}

			Response = responseLines.slice(0, linesToKeep).join('\n').trim();

			// Store content ranges for later asset association
			rfpPairs.push({
				Title,
				Identifier,
				Priority,
				importantBlock,
				Request,
				Response,
				contentRange: {
					start: importantMatch.index,
					end: responseContentEnd,
				},
			});
		}
	}

	return rfpPairs;
}

/**
 * Match RFP pairs with metadata
 */
export function matchPairsWithMetadata<T extends { Identifier: string; Title?: string }>(
	rfpPairs: RfpPair[],
	metadataLookup: Record<string, T>,
	logger: Logger
): (RfpPair & T & { Description: string })[] {
	return rfpPairs.map(pair => {
		const metadata = metadataLookup[pair.Identifier];

		if (!metadata) {
			logger.warn({ identifier: pair.Identifier }, 'No metadata found for identifier');
			// Return pair with empty metadata and Description
			return {
				...pair,
				Description: '',
				...({} as T),
			};
		}

		// Use Title from metadata as Description (matching original behavior)
		return {
			...pair,
			...metadata,
			Description: metadata.Title || '',
		};
	});
}

/**
 * Validate RFP pair has required content
 */
export function validateRfpPair(pair: RfpPair): { valid: boolean; errors: string[] } {
	const errors: string[] = [];

	if (!pair.Identifier) {
		errors.push('Missing Identifier');
	}

	if (!pair.Title) {
		errors.push('Missing Title');
	}

	if (!pair.Request || pair.Request.trim() === '') {
		errors.push('Missing Request content');
	}

	if (!pair.Response || pair.Response.trim() === '') {
		errors.push('Missing Response content');
	}

	if (!pair.Priority) {
		errors.push('Missing Priority');
	}

	return {
		valid: errors.length === 0,
		errors,
	};
}

/**
 * Filter pairs by category
 */
export function filterByCategory<T extends { Category?: string }>(pairs: T[], category: string): T[] {
	return pairs.filter(pair => pair.Category === category);
}

/**
 * Filter pairs by department
 */
export function filterByDepartment<T extends { Department?: string }>(pairs: T[], department: string): T[] {
	return pairs.filter(pair => pair.Department === department);
}

/**
 * Filter pairs that need customisation
 */
export function filterCustomizable<T extends { Customise?: string }>(pairs: T[]): T[] {
	return pairs.filter(pair => pair.Customise === 'Yes');
}
