/**
 * Reciprocal Rank Fusion (RRF) for combining multiple retrieval passes.
 *
 * RRF is a simple but effective method for combining ranked lists.
 * Score = Σ (1 / (k + rank_i)) for each list where the document appears.
 *
 * Reference: Cormack, Clarke, Buettcher (2009) "Reciprocal Rank Fusion
 * outperforms Condorcet and individual Rank Learning Methods"
 */

/**
 * A single retrieval result with its rank in a specific pass.
 */
export interface RankedResult {
	id: string;
	rank: number; // 1-indexed rank in this pass
	score?: number; // Optional original score from the retrieval method
	passName: string; // Name of the retrieval pass (for debugging)
}

/**
 * Configuration for RRF fusion.
 */
export interface RRFConfig {
	/**
	 * The k parameter controls how much weight is given to lower-ranked results.
	 * Higher k = more weight to lower ranks, smoother distribution.
	 * Default is 60 (commonly used value from literature).
	 */
	k: number;

	/**
	 * Minimum number of passes a document must appear in to be included.
	 * Set to 1 to include all results, 2+ for stricter filtering.
	 */
	minPasses?: number;
}

const DEFAULT_CONFIG: RRFConfig = {
	k: 60,
	minPasses: 1,
};

/**
 * Fuse multiple ranked result lists using Reciprocal Rank Fusion.
 *
 * @param passResults - Array of result lists from different retrieval passes
 * @param config - RRF configuration
 * @returns Fused results sorted by RRF score (descending)
 */
export function fuseWithRRF(
	passResults: RankedResult[][],
	config: Partial<RRFConfig> = {}
): Map<string, { rrfScore: number; passCount: number; passes: string[] }> {
	const { k, minPasses } = { ...DEFAULT_CONFIG, ...config };

	// Accumulate RRF scores for each document
	const scores = new Map<string, { rrfScore: number; passCount: number; passes: string[] }>();

	for (const results of passResults) {
		for (const result of results) {
			const rrfContribution = 1 / (k + result.rank);

			const existing = scores.get(result.id);
			if (existing) {
				existing.rrfScore += rrfContribution;
				existing.passCount += 1;
				existing.passes.push(result.passName);
			} else {
				scores.set(result.id, {
					rrfScore: rrfContribution,
					passCount: 1,
					passes: [result.passName],
				});
			}
		}
	}

	// Filter by minimum passes if specified
	if (minPasses && minPasses > 1) {
		for (const [id, data] of scores) {
			if (data.passCount < minPasses) {
				scores.delete(id);
			}
		}
	}

	return scores;
}

/**
 * Sort document IDs by their RRF scores.
 *
 * @param rrfScores - Map of document ID to RRF data
 * @param limit - Maximum number of results to return
 * @returns Sorted array of [id, rrfData] tuples
 */
export function sortByRRFScore(
	rrfScores: Map<string, { rrfScore: number; passCount: number; passes: string[] }>,
	limit?: number
): Array<[string, { rrfScore: number; passCount: number; passes: string[] }]> {
	const sorted = Array.from(rrfScores.entries()).sort((a, b) => b[1].rrfScore - a[1].rrfScore);

	return limit ? sorted.slice(0, limit) : sorted;
}

/**
 * Normalize RRF scores to 0-1 range for display.
 *
 * @param rrfScores - Map of document ID to RRF data
 * @returns Map with normalized scores
 */
export function normalizeRRFScores(
	rrfScores: Map<string, { rrfScore: number; passCount: number; passes: string[] }>
): Map<string, { rrfScore: number; normalizedScore: number; passCount: number; passes: string[] }> {
	const scores = Array.from(rrfScores.values()).map(d => d.rrfScore);
	const maxScore = Math.max(...scores);
	const minScore = Math.min(...scores);
	const range = maxScore - minScore || 1;

	const normalized = new Map<
		string,
		{ rrfScore: number; normalizedScore: number; passCount: number; passes: string[] }
	>();

	for (const [id, data] of rrfScores) {
		normalized.set(id, {
			...data,
			normalizedScore: (data.rrfScore - minScore) / range,
		});
	}

	return normalized;
}
