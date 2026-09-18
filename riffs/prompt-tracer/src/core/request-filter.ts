/**
 * Pure functions for filtering and selecting Claude API requests
 */

import type { RequestResponsePair, Riff } from '../lib/types.js';

/**
 * Filter out Haiku model requests
 * @param pairs - Array of request/response pairs
 * @returns Pairs not using Haiku models
 */
export function filterNonHaikuRequests(pairs: RequestResponsePair[]): RequestResponsePair[] {
	return pairs.filter(pair => pair.request?.body?.model && !pair.request.body.model.toLowerCase().includes('haiku'));
}

/**
 * Filter requests that have riffs defined
 * @param pairs - Array of request/response pairs
 * @returns Pairs with riffs
 */
export function filterRequestsWithRiffs(pairs: RequestResponsePair[]): RequestResponsePair[] {
	return pairs.filter(
		pair =>
			pair.request?.body?.riffs && Array.isArray(pair.request.body.riffs) && pair.request.body.riffs.length > 0
	);
}

/**
 * Filter requests that have a system prompt defined
 * @param pairs - Array of request/response pairs
 * @returns Pairs with system prompts
 */
export function filterRequestsWithSystemPrompt(pairs: RequestResponsePair[]): RequestResponsePair[] {
	return pairs.filter(
		pair =>
			pair.request?.body?.system && Array.isArray(pair.request.body.system) && pair.request.body.system.length > 0
	);
}

/**
 * Select the best request from candidates
 * Implements 3-tier prioritization:
 * 1. Requests with both riffs AND system prompt (sorted by riff count descending)
 * 2. Requests with riffs only (sorted by riff count descending)
 * 3. Any non-Haiku request (final fallback)
 * @param pairs - Array of request/response pairs
 * @returns The best request
 * @throws Error if no suitable request is found
 */
export function selectBestRequest(pairs: RequestResponsePair[]): RequestResponsePair {
	const nonHaikuPairs = filterNonHaikuRequests(pairs);
	const requestsWithRiffs = filterRequestsWithRiffs(nonHaikuPairs);

	if (requestsWithRiffs.length > 0) {
		// TIER 1: Prefer requests with both riffs AND system prompt
		const requestsWithSystemPrompt = filterRequestsWithSystemPrompt(requestsWithRiffs);

		if (requestsWithSystemPrompt.length > 0) {
			return requestsWithSystemPrompt.sort(
				(a, b) => (b.request.body.riffs?.length || 0) - (a.request.body.riffs?.length || 0)
			)[0];
		}

		// TIER 2: Fallback to requests with riffs only
		return requestsWithRiffs.sort(
			(a, b) => (b.request.body.riffs?.length || 0) - (a.request.body.riffs?.length || 0)
		)[0];
	}

	// TIER 3: Final fallback to any non-Haiku request
	if (nonHaikuPairs.length > 0) {
		return nonHaikuPairs[0];
	}

	throw new Error('No non-Haiku request found in the log');
}

/**
 * Filter out MCP riffs and sort riffs by name
 * @param riffs - Array of riffs
 * @returns Filtered and sorted riffs
 */
export function filterAndSortRiffs(riffs: Riff[] | undefined): Riff[] {
	if (!riffs) return [];

	return riffs.filter(riff => !riff.name.startsWith('mcp__')).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Check if request has riffs
 * @param pair - Request/response pair
 * @returns True if request has riffs
 */
export function hasRiffs(pair: RequestResponsePair): boolean {
	return !!pair.request.body.riffs && Array.isArray(pair.request.body.riffs) && pair.request.body.riffs.length > 0;
}

/**
 * Check if request has a system prompt
 * @param pair - Request/response pair
 * @returns True if request has system prompt
 */
export function hasSystemPrompt(pair: RequestResponsePair): boolean {
	return (
		!!pair.request?.body?.system && Array.isArray(pair.request.body.system) && pair.request.body.system.length > 0
	);
}
