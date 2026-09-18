/**
 * Search functionality for hr-staffer.
 * Implements field-weighted hybrid search optimized for staff directories.
 *
 * Scoring uses configurable component weights (ScoringWeights) so each signal
 * -- title, field, name, semantic, lexical -- has explicit, tunable influence
 * on the final score. Lexical and semantic are independent: semantic comes from
 * direct cosine similarity, lexical from FTS-only RRF fusion.
 */

import type { HrStafferDatabase } from '../db/database.js';
import type { FieldWeights, ScoringWeights, SearchOptions, SearchResult } from '../lib/types.js';
import type { EmbeddingProvider } from './indexer.js';
import {
	expandQuery,
	extractManagementVerb,
	getPreferredRoleForVerb,
	getQueryTerms,
	hasExpandableTerms,
} from './query-expansion.js';
import { ftsResultsToRanked, fuseRankings, normalizeRRFScores, type RRFResult } from './rrf-fusion.js';
import { extractSnippet } from './snippet-extractor.js';
import { cleanQuery, getStopWords } from './stop-words.js';

/**
 * Default scoring weights for staff directory search.
 * Base weights sum to 1.0; boosts are additive on top.
 */
const DEFAULT_WEIGHTS: ScoringWeights = {
	title: 0.3,
	field: 0.1,
	name: 0.15,
	semantic: 0.2,
	lexical: 0.25,
	nameBoost: 0.2,
	passBonus: 0.025,
};

/**
 * Default field weights for the field scoring sub-component.
 */
const DEFAULT_FIELD_WEIGHTS: FieldWeights = {
	department: 0.15,
	title: 0.1,
	manager: 0.08,
	location: 0.15,
};

/**
 * Convert a Buffer or ArrayBuffer (from SQLite BLOB) back to a Float32Array.
 * libsql may return BLOB data as ArrayBuffer or Uint8Array, not Node.js Buffer.
 */
export function bufferToVector(buffer: Buffer | Uint8Array | ArrayBuffer): Float32Array {
	if (buffer instanceof ArrayBuffer) {
		return new Float32Array(buffer);
	}
	// Handle Buffer and Uint8Array (both have buffer, byteOffset, byteLength)
	return new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);
}

/**
 * Calculate cosine similarity between two vectors.
 * Returns a value between -1 and 1, where 1 means identical direction.
 */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
	let dotProduct = 0;
	let normA = 0;
	let normB = 0;

	for (let i = 0; i < a.length; i++) {
		dotProduct += a[i] * b[i];
		normA += a[i] * a[i];
		normB += b[i] * b[i];
	}

	const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
	if (magnitude === 0) return 0;

	return dotProduct / magnitude;
}

/**
 * Get query terms for field matching.
 * Unlike FTS query terms, we keep shorter meaningful terms (CTO, VP, NOC, etc.)
 * since they're often important in staff directories.
 */
function getFieldQueryTerms(query: string): string[] {
	const stopWords = getStopWords();
	return query
		.toLowerCase()
		.split(/\s+/)
		.filter(term => term.length > 0 && !stopWords.has(term));
}

/**
 * Calculate job title match score.
 * This is the PRIMARY signal for staff directory searches.
 *
 * Scoring approach:
 * - Exact match (normalized): 1.0
 * - All query terms in title: 0.8
 * - Partial term matches: proportional
 *
 * @param query - The search query
 * @param jobTitle - The job title from metadata
 * @returns Score from 0 to 1
 */
export function calculateTitleScore(query: string, jobTitle: string): number {
	if (!jobTitle) return 0;

	const queryLower = query.toLowerCase().trim();
	const titleLower = jobTitle.toLowerCase().trim();

	// Exact match (after normalization)
	if (queryLower === titleLower) {
		return 1.0;
	}

	// Check if query is contained in title or title in query
	if (titleLower.includes(queryLower)) {
		return 0.9;
	}
	if (queryLower.includes(titleLower)) {
		return 0.85;
	}

	// Check for verb-to-role match in question context
	const managementVerb = extractManagementVerb(query);
	if (managementVerb) {
		const preferredRoles = getPreferredRoleForVerb(managementVerb);
		for (const role of preferredRoles) {
			if (titleLower.includes(role)) {
				return 0.95;
			}
		}
	}

	// Use expanded query terms (e.g., CTO → chief, technology, officer)
	const expandedTerms = expandQuery(query);
	const queryTerms = expandedTerms.filter(t => t.length > 2);
	if (queryTerms.length === 0) return 0;

	let matchCount = 0;
	for (const term of queryTerms) {
		if (titleLower.includes(term)) {
			matchCount++;
		}
	}

	// Return proportion of terms matched, with bonus for high coverage
	const coverage = matchCount / queryTerms.length;
	return coverage >= 1.0 ? 0.9 : coverage * 0.7;
}

/**
 * Calculate field relevance score based on query term matches in metadata fields.
 * Checks department, manager name, and location (city/country) for matches.
 *
 * Note: Job title is scored separately via calculateTitleScore for higher weight.
 *
 * @param query - The search query
 * @param metadata - Document metadata containing field values
 * @param weights - Field-specific weights for scoring
 * @returns Weighted score from 0 to 1
 */
export function calculateFieldScore(query: string, metadata: Record<string, unknown>, weights: FieldWeights): number {
	const queryTerms = getFieldQueryTerms(query);
	if (queryTerms.length === 0) return 0;

	// Normalize field values for matching
	const department = String(metadata['department'] ?? '').toLowerCase();
	const manager = String(metadata['manager'] ?? '').toLowerCase();
	const city = String(metadata['city'] ?? '').toLowerCase();
	const country = String(metadata['country'] ?? '').toLowerCase();
	const location = `${city} ${country}`.trim();

	// Calculate individual field scores
	let departmentScore = 0;
	let managerScore = 0;
	let locationScore = 0;

	for (const term of queryTerms) {
		if (department.includes(term)) departmentScore++;
		if (manager.includes(term)) managerScore++;
		if (location.includes(term)) locationScore++;
	}

	// Normalize to 0-1 range
	departmentScore = departmentScore / queryTerms.length;
	managerScore = managerScore / queryTerms.length;
	locationScore = locationScore / queryTerms.length;

	// Calculate weighted total (excluding title, which is scored separately)
	const relevantWeight = weights.department + weights.manager + weights.location;
	if (relevantWeight === 0) return 0;

	return (
		(weights.department * departmentScore + weights.manager * managerScore + weights.location * locationScore) /
		relevantWeight
	);
}

/**
 * Calculate name match score.
 * Higher score when query matches employee name in the document ID or content.
 *
 * @param query - The search query
 * @param docId - Document ID (often contains employee name)
 * @param content - Document content
 * @returns Score from 0 to 1
 */
export function calculateNameScore(query: string, docId: string, content: string): number {
	const queryTerms = getFieldQueryTerms(query);
	if (queryTerms.length === 0) return 0;

	const idLower = docId.toLowerCase();
	const contentLower = content.toLowerCase().slice(0, 500);

	let matchCount = 0;
	for (const term of queryTerms) {
		// Check if term matches in document ID (usually contains name slug)
		if (idLower.includes(term)) {
			matchCount += 2; // Higher weight for ID match
		}
		// Check first part of content (usually has employee name/title)
		if (contentLower.includes(term)) {
			matchCount += 1;
		}
	}

	// Normalize by max possible score
	const maxScore = queryTerms.length * 3;
	return Math.min(1, matchCount / maxScore);
}

/**
 * Options for the search function.
 */
export interface SearchParams {
	query: string;
	db: HrStafferDatabase;
	embeddingService: EmbeddingProvider;
	options: SearchOptions;
}

/**
 * Run lexical-only multi-pass retrieval and fuse with RRF.
 * Excludes the semantic pass so lexical signal is independent of embedding similarity.
 * The semantic score is computed separately via direct cosine similarity.
 */
async function runLexicalRetrieval(query: string, db: HrStafferDatabase): Promise<Map<string, RRFResult>> {
	const passes: Array<{ id: string; rank: number }[]> = [];

	// Pass 1: FTS with OR query (basic terms)
	const cleanedQuery = cleanQuery(query);
	const queryTerms = getQueryTerms(cleanedQuery);
	if (queryTerms.length > 0) {
		try {
			const ftsResults = db.searchFtsOr(queryTerms);
			if (ftsResults.length > 0) {
				passes.push(ftsResultsToRanked(ftsResults));
			}
		} catch {
			// FTS might fail on certain queries, continue without it
		}
	}

	// Pass 2: FTS with expanded synonyms
	if (hasExpandableTerms(query)) {
		const expandedTerms = expandQuery(query);
		if (expandedTerms.length > queryTerms.length) {
			try {
				const expandedResults = db.searchFtsOr(expandedTerms);
				if (expandedResults.length > 0) {
					passes.push(ftsResultsToRanked(expandedResults));
				}
			} catch {
				// Continue without expanded pass
			}
		}
	}

	// Pass 3: FTS phrase proximity (if multiple terms)
	if (queryTerms.length >= 2) {
		try {
			const phraseResults = db.searchFtsPhrase(queryTerms, 5);
			if (phraseResults.length > 0) {
				passes.push(ftsResultsToRanked(phraseResults));
			}
		} catch {
			// Continue without phrase pass
		}
	}

	if (passes.length === 0) {
		return new Map();
	}

	// Fuse lexical passes with RRF
	const fusedResults = fuseRankings(passes);
	const normalizedResults = normalizeRRFScores(fusedResults);

	// Return as map for quick lookup
	const resultMap = new Map<string, RRFResult>();
	for (const result of normalizedResults) {
		resultMap.set(result.id, result);
	}

	return resultMap;
}

/**
 * Search indexed documents using field-weighted hybrid search.
 *
 * Each scoring component has its own configurable weight via ScoringWeights:
 * - title:    job title match (dominant for role-based queries)
 * - field:    department, manager, location match
 * - name:     person name match (dominant for name-based queries)
 * - semantic: cosine similarity from embeddings
 * - lexical:  FTS-only RRF score (independent of semantic)
 *
 * @param params - Search parameters including query, database, embedding service, and options
 * @returns Array of search results sorted by score descending
 */
export async function search(params: SearchParams): Promise<SearchResult[]> {
	const { query, db, embeddingService, options } = params;
	const { hybrid, nResults } = options;
	const weights = options.weights ?? DEFAULT_WEIGHTS;
	const fieldWeights = options.fieldWeights ?? DEFAULT_FIELD_WEIGHTS;

	// Get all documents from database
	const documents = db.getAllDocuments();
	if (documents.length === 0) {
		return [];
	}

	// Generate embedding for query
	const queryEmbedding = await embeddingService.embedSingle(query);

	// Run lexical-only retrieval if hybrid mode
	let lexicalResults = new Map<string, RRFResult>();
	if (hybrid) {
		lexicalResults = await runLexicalRetrieval(query, db);
	}

	// Score each document
	const scored: SearchResult[] = [];
	for (const doc of documents) {
		const docEmbedding = bufferToVector(doc.embedding);
		const semScore = cosineSimilarity(queryEmbedding, docEmbedding);
		const metadata = JSON.parse(doc.metadata_json) as Record<string, unknown>;

		// Extract job title for primary scoring
		const jobTitle = String(metadata['job_title'] ?? '');

		// Calculate component scores
		const titleScore = calculateTitleScore(query, jobTitle);
		const fieldScore = calculateFieldScore(query, metadata, fieldWeights);
		const nameScore = calculateNameScore(query, doc.id, doc.content);

		let score: number;
		let lexScore = 0;
		let passCount = 0;

		if (hybrid) {
			const lexResult = lexicalResults.get(doc.id);
			const normalizedLex = lexResult?.rrfScore ?? 0;
			passCount = lexResult?.passCount ?? 0;
			lexScore = normalizedLex;

			// Staff directory scoring formula with configurable weights
			score =
				weights.title * titleScore +
				weights.field * fieldScore +
				weights.name * nameScore +
				weights.semantic * semScore +
				weights.lexical * normalizedLex;

			// High-confidence name match boost
			// When nameScore is very high (>= 0.8), this is likely a person name search
			if (nameScore >= 0.8) {
				score += weights.nameBoost * nameScore;
			}

			// Boost for documents appearing in multiple retrieval passes
			const passBonus = Math.min(0.1, passCount * weights.passBonus);
			score = Math.min(1, score + passBonus);
		} else {
			// Pure semantic search
			score = semScore;
		}

		scored.push({
			id: doc.id,
			score,
			sem_score: semScore,
			lex_score: lexScore,
			field_score: fieldScore,
			name_score: nameScore,
			title_score: titleScore,
			pass_count: passCount,
			content: doc.content,
			metadata,
		});
	}

	// Sort by score descending and limit results
	const sorted = scored.sort((a, b) => b.score - a.score).slice(0, nResults);

	// Extract snippets for each result
	const contextLines = options.snippetContextLines ?? 2;
	for (const result of sorted) {
		const snippet = extractSnippet(result.content, query, contextLines);
		if (snippet) {
			result.snippet = snippet;
		}
	}

	return sorted;
}
