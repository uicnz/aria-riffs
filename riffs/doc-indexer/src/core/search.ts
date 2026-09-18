/**
 * Search functionality for doc-indexer.
 *
 * Implements multi-pass RRF fusion with field boosting for RFP documents.
 *
 * Key improvements over basic hybrid search:
 * - Multi-pass RRF fusion (4 passes) for robust ranking
 * - Query expansion for abbreviations (SLA, SIEM, etc.)
 * - Stop word cleaning for better FTS matching
 * - FTS OR queries for broader recall
 * - Phrase proximity matching (NEAR) for multi-term queries
 * - Title/identifier boosting for exact matches
 * - Snippet extraction for result display
 */

import path from 'node:path';
import type { DatabaseManager } from '../db/database.js';
import type { RfpDocMetadata, ScoringWeights, SearchOptions, SearchResult } from '../lib/types.js';
import type { DocIndexer } from './indexer.js';

/**
 * Default scoring weights used when config doesn't specify weights.
 */
const DEFAULT_WEIGHTS: ScoringWeights = {
	title: 0.25,
	identifier: 0.15,
	semantic: 0.3,
	lexical: 0.2,
	phrase: 0.1,
	identifierBoost: 0.2,
	phraseBoost: 0.15,
	passBonus: 0.025,
};

import { expandQuery, getQueryTerms, hasExpandableTerms, initQueryExpansion } from './query-expansion.js';
import {
	ftsResultsToRanked,
	fuseRankings,
	normalizeRRFScores,
	type RRFResult,
	semanticResultsToRanked,
} from './rrf-fusion.js';
import { extractSnippet } from './snippet-extractor.js';
import { cleanQuery, initStopWords } from './stop-words.js';

/**
 * Document data from database for scoring.
 */
interface DocumentData {
	id: string;
	content: string;
	embedding: Buffer;
	metadata_json: string;
}

/**
 * Calculate title match score.
 * High score when query matches the document title.
 *
 * @param query - The search query
 * @param title - The document title
 * @returns Score from 0 to 1
 */
function calculateTitleScore(query: string, title: string): number {
	if (!title) return 0;

	const queryLower = query.toLowerCase().trim();
	const titleLower = title.toLowerCase().trim();

	// Exact match
	if (queryLower === titleLower) {
		return 1.0;
	}

	// Query contained in title
	if (titleLower.includes(queryLower)) {
		return 0.9;
	}

	// Title contained in query
	if (queryLower.includes(titleLower)) {
		return 0.85;
	}

	// Check term overlap
	const queryTerms = queryLower.split(/\s+/).filter(t => t.length > 2);
	if (queryTerms.length === 0) return 0;

	let matchCount = 0;
	for (const term of queryTerms) {
		if (titleLower.includes(term)) {
			matchCount++;
		}
	}

	const coverage = matchCount / queryTerms.length;
	return coverage >= 1.0 ? 0.8 : coverage * 0.6;
}

/**
 * Calculate phrase match score.
 * High score when query appears as exact phrase in document content.
 * This helps prioritize documents that define concepts vs just reference them.
 *
 * @param query - The search query
 * @param content - The document content
 * @returns Score from 0 to 1
 */
function calculatePhraseScore(query: string, content: string): number {
	const queryLower = query.toLowerCase().trim();
	const contentLower = content.toLowerCase();

	// Only apply phrase scoring for multi-word queries
	const queryTerms = queryLower.split(/\s+/).filter(t => t.length > 2);
	if (queryTerms.length < 2) {
		return 0;
	}

	// Check for exact phrase match
	if (contentLower.includes(queryLower)) {
		// Count occurrences of exact phrase
		let count = 0;
		let pos = contentLower.indexOf(queryLower);
		while (pos !== -1) {
			count++;
			pos = contentLower.indexOf(queryLower, pos + 1);
		}

		// Score based on presence and frequency (capped)
		// At least one match = 0.5, additional matches add diminishing returns
		return Math.min(1.0, 0.5 + Math.log10(count + 1) * 0.25);
	}

	return 0;
}

/**
 * Calculate identifier match score.
 * High score when query matches document identifier (MR27, SR1, etc.)
 *
 * @param query - The search query
 * @param identifier - The document identifier
 * @returns Score from 0 to 1
 */
function calculateIdentifierScore(query: string, identifier: string | undefined): number {
	if (!identifier) return 0;

	const queryLower = query.toLowerCase().trim();
	const idLower = identifier.toLowerCase().trim();

	// Exact match
	if (queryLower === idLower) {
		return 1.0;
	}

	// Query is part of identifier or vice versa
	if (idLower.includes(queryLower) || queryLower.includes(idLower)) {
		return 0.8;
	}

	// Check if any query term matches identifier
	const queryTerms = queryLower.split(/\s+/);
	for (const term of queryTerms) {
		if (term === idLower) {
			return 0.9;
		}
	}

	return 0;
}

/**
 * Run multi-pass retrieval and fuse results with RRF.
 * Returns candidate document IDs with RRF scores.
 */
async function runMultiPassRetrieval(
	query: string,
	dbManager: DatabaseManager,
	indexer: DocIndexer,
	documents: DocumentData[]
): Promise<Map<string, RRFResult>> {
	const embeddingService = indexer.getEmbeddingService();
	const passes: Array<{ id: string; rank: number }[]> = [];

	// Pass 1: Semantic search
	const queryEmbedding = (await embeddingService.embedAll([query]))[0];
	const semanticScores: Array<{ id: string; score: number }> = [];
	for (const doc of documents) {
		const docEmbedding = embeddingService.bufferToVector(doc.embedding);
		const score = embeddingService.cosineSimilarity(queryEmbedding, docEmbedding);
		semanticScores.push({ id: doc.id, score });
	}
	passes.push(semanticResultsToRanked(semanticScores));

	// Pass 2: FTS with OR query (basic terms)
	const cleanedQuery = cleanQuery(query);
	const queryTerms = getQueryTerms(cleanedQuery);
	if (queryTerms.length > 0) {
		const ftsResults = dbManager.searchFtsOr(queryTerms);
		if (ftsResults.length > 0) {
			passes.push(ftsResultsToRanked(ftsResults));
		}
	}

	// Pass 3: FTS with expanded synonyms
	if (hasExpandableTerms(query)) {
		const expandedTerms = expandQuery(query);
		if (expandedTerms.length > queryTerms.length) {
			const expandedResults = dbManager.searchFtsOr(expandedTerms);
			if (expandedResults.length > 0) {
				passes.push(ftsResultsToRanked(expandedResults));
			}
		}
	}

	// Pass 4: FTS phrase proximity (if multiple terms)
	if (queryTerms.length >= 2) {
		const phraseResults = dbManager.searchFtsPhrase(queryTerms, 5);
		if (phraseResults.length > 0) {
			passes.push(ftsResultsToRanked(phraseResults));
		}
	}

	// Fuse all passes with RRF
	const fusedResults = fuseRankings(passes);
	const normalizedResults = normalizeRRFScores(fusedResults);

	// Return as map for quick lookup
	const resultMap = new Map<string, RRFResult>();
	for (const result of normalizedResults) {
		resultMap.set(result.id, result);
	}

	return resultMap;
}

export class SearchService {
	private indexer: DocIndexer;

	constructor(indexer: DocIndexer) {
		this.indexer = indexer;

		// Initialize query expansion and stop words from config
		const config = indexer.getConfig();
		const searchConfig = config.search ?? {
			abbreviations: {},
			synonyms: [],
			stopWords: [],
		};
		initQueryExpansion(searchConfig);
		initStopWords(searchConfig);
	}

	async search(query: string, nResults = 5, opts?: SearchOptions): Promise<SearchResult[]> {
		const embeddingService = this.indexer.getEmbeddingService();
		const db = this.indexer.getDb();
		const dbManager = this.indexer.getDbManager();
		const config = this.indexer.getConfig();

		// Get scoring weights from config or use defaults
		const weights: ScoringWeights = config.search?.weights ?? DEFAULT_WEIGHTS;

		// Get all documents from database
		const documents = dbManager.getAllDocuments();
		if (documents.length === 0) {
			return [];
		}

		// Generate embedding for query
		const queryEmbedding = (await embeddingService.embedAll([query]))[0];

		// Run multi-pass retrieval if hybrid mode
		let rrfResults = new Map<string, RRFResult>();
		if (opts?.hybrid) {
			rrfResults = await runMultiPassRetrieval(query, dbManager, this.indexer, documents);
		}

		// Build WHERE with filters
		const where: string[] = [];
		const params: (string | number)[] = [];
		const addEq = (field: string, val?: string) => {
			if (val) {
				where.push(`json_extract(metadata_json, '$.${field}') = ?`);
				params.push(val);
			}
		};
		addEq('category', opts?.filters?.category);
		addEq('department', opts?.filters?.department);
		addEq('priority', opts?.filters?.priority);
		addEq('identifier', opts?.filters?.identifier);

		// Score each document
		const scored: SearchResult[] = [];
		const alpha = Math.min(1, Math.max(0, opts?.alpha ?? config.alpha));

		for (const doc of documents) {
			// Apply filters if any
			if (where.length > 0) {
				const metadata = JSON.parse(doc.metadata_json) as RfpDocMetadata;
				let matches = true;
				if (opts?.filters?.category && metadata.category !== opts.filters.category) matches = false;
				if (opts?.filters?.department && metadata.department !== opts.filters.department) matches = false;
				if (opts?.filters?.priority && metadata.priority !== opts.filters.priority) matches = false;
				if (opts?.filters?.identifier && metadata.identifier !== opts.filters.identifier) matches = false;
				if (!matches) continue;
			}

			const docEmbedding = embeddingService.bufferToVector(doc.embedding);
			const semScore = embeddingService.cosineSimilarity(queryEmbedding, docEmbedding);
			const metadata = JSON.parse(doc.metadata_json) as RfpDocMetadata;

			// Calculate component scores
			const titleScore = calculateTitleScore(query, metadata.title ?? '');
			const identifierScore = calculateIdentifierScore(query, metadata.identifier);
			const phraseScore = calculatePhraseScore(query, doc.content);

			let score: number;
			let lexScore = 0;
			let passCount = 0;

			if (opts?.hybrid) {
				const rrfResult = rrfResults.get(doc.id);
				const normalizedRRF = rrfResult?.rrfScore ?? 0;
				passCount = rrfResult?.passCount ?? 0;
				lexScore = normalizedRRF;

				// RFP document scoring formula using configurable weights
				score =
					weights.title * titleScore +
					weights.identifier * identifierScore +
					weights.semantic * semScore +
					weights.lexical * normalizedRRF +
					weights.phrase * phraseScore;

				// High-confidence identifier match boost
				// When identifier matches exactly, this is a direct lookup
				if (identifierScore >= 0.9) {
					score += weights.identifierBoost * identifierScore;
				}

				// Boost for exact phrase matches
				// Documents containing the exact query phrase get priority
				if (phraseScore > 0.5) {
					score += weights.phraseBoost * phraseScore;
				}

				// Boost for documents appearing in multiple retrieval passes
				const passBonus = Math.min(0.1, passCount * weights.passBonus);
				score = Math.min(1, score + passBonus);
			} else {
				// Pure semantic search with field boosting (higher semantic weight)
				const semWeight = 1 - weights.title - weights.identifier - weights.phrase;
				score =
					semWeight * semScore +
					weights.title * titleScore +
					weights.identifier * identifierScore +
					weights.phrase * phraseScore;
			}

			scored.push({
				id: doc.id,
				score,
				sem_score: semScore,
				lex_score: lexScore,
				title_score: titleScore,
				identifier_score: identifierScore,
				pass_count: passCount,
				metadata,
				content: doc.content,
			});
		}

		// Include FTS-only full RFP hits if requested
		if (opts?.hybrid && opts?.includeFull) {
			try {
				const ftsRowsFull = db
					.prepare(
						'SELECT id, bm25(full_docs_fts) AS rank FROM full_docs_fts WHERE full_docs_fts MATCH ? ORDER BY rank LIMIT 50'
					)
					.all(query) as Array<{ id: string; rank: number }>;

				if (ftsRowsFull.length > 0) {
					// Normalize full ranks
					const fullVals = ftsRowsFull.map(r => r.rank);
					const fmin = Math.min(...fullVals),
						fmax = Math.max(...fullVals);
					const norm = (rank: number) => (fmax === fmin ? 1 : 1 - (rank - fmin) / (fmax - fmin));

					// Fetch full doc rows for metadata
					const fullIds = ftsRowsFull.map(r => r.id);
					const placeholders = fullIds.map(() => '?').join(',');
					const fullRows = db
						.prepare(`SELECT id, file, content FROM full_docs WHERE id IN (${placeholders})`)
						.all(...fullIds) as Array<{ id: string; file: string; content: string }>;

					const byId = new Map(fullRows.map(r => [r.id, r] as const));
					for (const ftsRow of ftsRowsFull) {
						const row = byId.get(ftsRow.id);
						if (!row) continue;
						const lex = norm(ftsRow.rank);
						const score = alpha * lex; // semantic component is 0 for full-doc FTS-only
						const md: RfpDocMetadata = {
							id: ftsRow.id,
							title: `Full RFP: ${path.basename(row.file)}`,
							category: 'full-rfp',
							relative_path: path.relative(process.cwd(), row.file),
							full_path: row.file,
							indexed_at: new Date().toISOString(),
							embedding_model: config.model,
							dimensions: config.dimensions,
						};
						scored.push({
							id: ftsRow.id,
							score,
							sem_score: 0,
							lex_score: lex,
							metadata: md,
							content: row.content,
						});
					}
				}
			} catch {
				// FTS query failed for full docs
			}
		}

		// Sort by score descending and limit results
		const sorted = scored.sort((a, b) => b.score - a.score).slice(0, nResults);

		// Extract snippets for each result
		const snippetContextLines = config.search?.snippetContextLines ?? 1;
		for (const result of sorted) {
			const snippet = extractSnippet(result.content, query, snippetContextLines);
			if (snippet) {
				result.snippet = snippet;
			}
		}

		return sorted;
	}
}
