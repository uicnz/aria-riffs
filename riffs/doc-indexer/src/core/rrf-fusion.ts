/**
 * Reciprocal Rank Fusion (RRF) for combining multiple search passes.
 * RRF provides a robust way to merge ranked lists from different retrieval methods.
 *
 * Formula: RRF(d) = sum(1 / (k + rank_i(d))) for each ranking list i
 * where k is a constant (typically 60) and rank_i(d) is the rank of document d in list i.
 */

/**
 * RRF constant k - controls how much to penalize lower ranks.
 * Standard value of 60 provides good balance.
 */
const RRF_K = 60;

/**
 * Represents a document's ranking in a single pass.
 */
export interface RankedDocument {
	id: string;
	rank: number;
}

/**
 * Result of RRF fusion for a document.
 */
export interface RRFResult {
	id: string;
	rrfScore: number;
	passCount: number; // Number of passes this document appeared in
}

/**
 * Calculate RRF score for a single document from its ranks across passes.
 * @param ranks Array of ranks (1-based) across different passes
 * @returns RRF score (higher is better)
 */
export function calculateRRFScore(ranks: number[]): number {
	let score = 0;
	for (const rank of ranks) {
		score += 1 / (RRF_K + rank);
	}
	return score;
}

/**
 * Fuse multiple ranking lists using Reciprocal Rank Fusion.
 *
 * @param passes Array of ranked document lists from different retrieval passes
 * @returns Fused results sorted by RRF score descending
 */
export function fuseRankings(passes: RankedDocument[][]): RRFResult[] {
	// Collect ranks for each document across all passes
	const docRanks = new Map<string, number[]>();
	const docPassCount = new Map<string, number>();

	for (const pass of passes) {
		for (let i = 0; i < pass.length; i++) {
			const doc = pass[i];
			if (!doc) continue;

			const ranks = docRanks.get(doc.id) ?? [];
			ranks.push(i + 1); // Convert to 1-based rank
			docRanks.set(doc.id, ranks);

			const count = docPassCount.get(doc.id) ?? 0;
			docPassCount.set(doc.id, count + 1);
		}
	}

	// Calculate RRF scores
	const results: RRFResult[] = [];
	for (const [id, ranks] of docRanks) {
		results.push({
			id,
			rrfScore: calculateRRFScore(ranks),
			passCount: docPassCount.get(id) ?? 0,
		});
	}

	// Sort by RRF score descending
	return results.sort((a, b) => b.rrfScore - a.rrfScore);
}

/**
 * Normalize RRF scores to 0-1 range.
 * @param results RRF results with raw scores
 * @returns Results with normalized scores
 */
export function normalizeRRFScores(results: RRFResult[]): RRFResult[] {
	if (results.length === 0) return [];

	const scores = results.map(r => r.rrfScore);
	const maxScore = Math.max(...scores);
	const minScore = Math.min(...scores);
	const range = maxScore - minScore;

	return results.map(r => ({
		...r,
		rrfScore: range === 0 ? 1 : (r.rrfScore - minScore) / range,
	}));
}

/**
 * Create a ranked document list from FTS results (BM25 scores).
 * BM25 returns negative scores where more negative = better match.
 */
export function ftsResultsToRanked(results: Array<{ id: string; rank: number }>): RankedDocument[] {
	// Sort by rank (ascending since BM25 is negative)
	const sorted = [...results].sort((a, b) => a.rank - b.rank);
	return sorted.map((r, i) => ({ id: r.id, rank: i + 1 }));
}

/**
 * Create a ranked document list from semantic similarity scores.
 * Higher similarity = better match.
 */
export function semanticResultsToRanked(results: Array<{ id: string; score: number }>): RankedDocument[] {
	// Sort by score (descending since higher = better)
	const sorted = [...results].sort((a, b) => b.score - a.score);
	return sorted.map((r, i) => ({ id: r.id, rank: i + 1 }));
}
