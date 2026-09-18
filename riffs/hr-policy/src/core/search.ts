import type {
	DocIndexer,
	DocumentMetadata,
	Logger,
	SearchOptions,
	SearchResult,
	SearchService,
	SqliteConnection,
} from '../lib/types.js';
import { parseFrontmatter, stripFrontmatter } from './frontmatter-parser.js';
import { expandQueryForFts } from './query-expansion.js';
import { fuseWithRRF, type RankedResult, sortByRRFScore } from './rrf-fusion.js';
import { extractSnippet } from './snippet-extractor.js';
import { cleanQuery, getStopWords } from './stop-words.js';

/**
 * Calculate title relevance score based on query term matches in document title.
 * Matches in titles/headings are strong relevance signals.
 *
 * @param query - The search query
 * @param title - The document's title (from metadata or heading)
 * @returns Score from 0 to 1 (1 = all query terms found in title)
 */
function calculateTitleScore(query: string, title: string | null | undefined): number {
	if (!title) return 0;

	const normalizedTitle = title
		.toLowerCase()
		.replace(/[^a-z0-9\s]/g, ' ')
		.trim();
	const stopWords = getStopWords();
	const queryTerms = query
		.toLowerCase()
		.split(/\s+/)
		.filter(term => term.length > 2 && !stopWords.has(term));

	if (queryTerms.length === 0) return 0;

	let matchCount = 0;
	for (const term of queryTerms) {
		if (normalizedTitle.includes(term)) {
			matchCount++;
		}
	}

	return matchCount / queryTerms.length;
}

/**
 * Calculate path relevance score based on query term matches in document path.
 * Returns a score between 0 and 1 indicating how well the path matches the query.
 *
 * @param query - The search query
 * @param relativePath - The document's relative path
 * @returns Score from 0 to 1 (1 = all query terms found in path)
 */
function calculatePathScore(query: string, relativePath: string): number {
	// Normalize path: remove extension, convert separators and dashes to spaces
	const normalizedPath = relativePath
		.toLowerCase()
		.replace(/\.md$/i, '')
		.replace(/[/\\-_]/g, ' ')
		.replace(/\d+/g, ' ') // Remove numbers
		.replace(/\s+/g, ' ')
		.trim();

	// Extract meaningful query terms (remove stop words, normalize)
	const stopWords = getStopWords();
	const queryTerms = query
		.toLowerCase()
		.split(/\s+/)
		.filter(term => term.length > 2 && !stopWords.has(term));

	if (queryTerms.length === 0) return 0;

	// Count how many query terms appear in the path
	let matchCount = 0;
	for (const term of queryTerms) {
		if (normalizedPath.includes(term)) {
			matchCount++;
		}
	}

	// Return ratio of matched terms
	return matchCount / queryTerms.length;
}

export class SearchServiceImpl implements SearchService {
	private logger: Logger;
	private indexer: DocIndexer;

	constructor(logger: Logger, indexer: DocIndexer) {
		this.logger = logger;
		this.indexer = indexer;
	}

	async search(
		query: string,
		nResults = 5,
		opts: SearchOptions,
		dbConnection: SqliteConnection | undefined = undefined
	): Promise<SearchResult[]> {
		this.logger.debug({ query, nResults, hybrid: opts.hybrid }, 'Executing multi-pass search');

		if (!dbConnection) return [];

		const config = this.indexer.getConfig();
		const cleanedQuery = cleanQuery(query);

		const embeddingService = this.indexer.getEmbeddingService();

		// ============================================================
		// MULTI-PASS RETRIEVAL WITH RRF FUSION
		// ============================================================
		// Pass 1: Semantic search (embed query, find similar documents)
		// Pass 2: FTS with expanded synonyms (lexical matching)
		// Pass 3: Hierarchy-aware search (match hierarchy_path)
		// Combine using Reciprocal Rank Fusion for robust ranking
		// ============================================================

		const passResults: RankedResult[][] = [];
		const candidateLimit = 100; // Top candidates from each pass

		// --- PASS 1: Semantic Search ---
		const queryEmbeddings = await embeddingService.embedAll([query]);
		const queryEmb = queryEmbeddings[0];

		if (queryEmb) {
			const allDocs = dbConnection.prepare('SELECT id, embedding FROM documents').all() as Array<{
				id: string;
				embedding: Buffer;
			}>;

			const semanticScored = allDocs
				.map(doc => {
					const docEmb = embeddingService.bufferToVector(doc.embedding);
					if (!docEmb || docEmb.length === 0) return null;
					const similarity = embeddingService.cosineSimilarity(queryEmb, docEmb);
					return { id: doc.id, score: similarity };
				})
				.filter((item): item is { id: string; score: number } => item !== null)
				.sort((a, b) => b.score - a.score)
				.slice(0, candidateLimit);

			const semanticPass: RankedResult[] = semanticScored.map((doc, idx) => ({
				id: doc.id,
				rank: idx + 1,
				score: doc.score,
				passName: 'semantic',
			}));
			passResults.push(semanticPass);
			this.logger.debug({ pass: 'semantic', candidates: semanticPass.length }, 'Pass 1 complete');
		}

		// --- PASS 2: FTS with Expanded Synonyms ---
		if (opts.hybrid) {
			try {
				const ftsQuery = expandQueryForFts(cleanedQuery);
				if (ftsQuery) {
					const ftsRows = dbConnection
						.prepare(
							'SELECT id, bm25(documents_fts) AS rank FROM documents_fts WHERE documents_fts MATCH ? ORDER BY rank LIMIT ?'
						)
						.all(ftsQuery, candidateLimit) as Array<{ id: string; rank: number }>;

					const ftsPass: RankedResult[] = ftsRows.map((row, idx) => ({
						id: row.id,
						rank: idx + 1,
						score: row.rank,
						passName: 'fts_expanded',
					}));
					passResults.push(ftsPass);
					this.logger.debug(
						{ pass: 'fts_expanded', candidates: ftsPass.length, query: ftsQuery },
						'Pass 2 complete'
					);
				}
			} catch (err) {
				this.logger.debug({ error: err }, 'FTS pass failed');
			}
		}

		// --- PASS 3: Hierarchy Path Matching ---
		// Search the hierarchy_path column for query terms
		// This helps find child chunks whose context matches the query
		if (opts.hybrid && cleanedQuery) {
			try {
				const hierarchyFtsQuery = expandQueryForFts(cleanedQuery);
				if (hierarchyFtsQuery) {
					// Search hierarchy_path in the FTS table
					const hierarchyRows = dbConnection
						.prepare(
							`SELECT id, bm25(documents_fts, 0, 1.0, 2.0) AS rank
                             FROM documents_fts
                             WHERE documents_fts MATCH ?
                             ORDER BY rank LIMIT ?`
						)
						.all(hierarchyFtsQuery, candidateLimit) as Array<{ id: string; rank: number }>;

					const hierarchyPass: RankedResult[] = hierarchyRows.map((row, idx) => ({
						id: row.id,
						rank: idx + 1,
						score: row.rank,
						passName: 'hierarchy',
					}));
					passResults.push(hierarchyPass);
					this.logger.debug({ pass: 'hierarchy', candidates: hierarchyPass.length }, 'Pass 3 complete');
				}
			} catch (err) {
				this.logger.debug({ error: err }, 'Hierarchy pass failed');
			}
		}

		// --- PASS 4: Exact Phrase Matching ---
		// Documents containing the exact query phrase (or close variants) rank highest
		// This pass uses FTS phrase queries with NEAR for proximity matching
		if (opts.hybrid && cleanedQuery) {
			try {
				const terms = cleanedQuery.split(/\s+/).filter(t => t.length > 0);
				if (terms.length >= 2) {
					// Use NEAR/5 for phrases - terms must be within 5 words of each other
					const phraseQuery = `NEAR(${terms.map(t => `"${t}"`).join(' ')}, 5)`;
					const phraseRows = dbConnection
						.prepare(
							'SELECT id, bm25(documents_fts) AS rank FROM documents_fts WHERE documents_fts MATCH ? ORDER BY rank LIMIT ?'
						)
						.all(phraseQuery, candidateLimit) as Array<{ id: string; rank: number }>;

					const phrasePass: RankedResult[] = phraseRows.map((row, idx) => ({
						id: row.id,
						rank: idx + 1,
						score: row.rank,
						passName: 'phrase',
					}));
					if (phrasePass.length > 0) {
						passResults.push(phrasePass);
						this.logger.debug({ pass: 'phrase', candidates: phrasePass.length }, 'Pass 4 complete');
					}
				}
			} catch (err) {
				this.logger.debug({ error: err }, 'Phrase pass failed');
			}
		}

		// --- RRF FUSION ---
		const rrfScores = fuseWithRRF(passResults, { k: 60 });
		const sortedRRF = sortByRRFScore(rrfScores, candidateLimit);

		this.logger.debug({ totalCandidates: sortedRRF.length, passes: passResults.length }, 'RRF fusion complete');

		// --- FETCH FULL DOCUMENTS FOR TOP CANDIDATES ---
		const topIds = sortedRRF.slice(0, Math.max(nResults * 3, 30)).map(([id]) => id);
		if (topIds.length === 0) return [];

		const placeholders = topIds.map(() => '?').join(',');
		const rows = dbConnection
			.prepare(`SELECT id, embedding, metadata_json, content FROM documents WHERE id IN (${placeholders})`)
			.all(...topIds) as Array<{
			id: string;
			embedding: Buffer;
			metadata_json: string;
			content: string;
		}>;

		// Create a map for quick lookup
		const rowMap = new Map(rows.map(r => [r.id, r]));

		// --- FINAL SCORING ---
		// Combine RRF rank with semantic/lexical scores for final ranking
		const scored: SearchResult[] = [];

		for (const [docId, rrfData] of sortedRRF.slice(0, nResults * 3)) {
			const row = rowMap.get(docId);
			if (!row) continue;

			const embedding = embeddingService.bufferToVector(row.embedding);
			if (!embedding || embedding.length === 0) continue;

			const sem = queryEmb ? embeddingService.cosineSimilarity(queryEmb, embedding) : 0;
			const metadata = JSON.parse(row.metadata_json) as DocumentMetadata;
			const pathScore = calculatePathScore(query, metadata.relative_path);
			const titleScore = calculateTitleScore(query, metadata.title);

			// Normalize RRF score to 0-1 range (approximate)
			const maxRRF = sortedRRF[0]?.[1]?.rrfScore ?? 1;
			const normalizedRRF = rrfData.rrfScore / maxRRF;

			// Combined score: blend RRF ranking with component scores
			// Title matches are strong signals (0.15 weight)
			// RRF provides robust ranking, semantic for meaning
			const score = opts.hybrid
				? 0.45 * normalizedRRF +
					0.25 * sem +
					0.15 * titleScore +
					0.1 * pathScore +
					0.05 * (rrfData.passCount / passResults.length)
				: sem;

			const frontmatter = parseFrontmatter(row.content);
			const contentWithoutFrontmatter = stripFrontmatter(row.content);

			const result: SearchResult = {
				id: row.id,
				score,
				sem_score: sem,
				lex_score: normalizedRRF, // Use RRF score as "lexical" indicator
				path_score: pathScore,
				metadata,
				content: contentWithoutFrontmatter,
			};

			if (frontmatter) {
				result.frontmatter = frontmatter;
			}

			scored.push(result);
		}

		// --- PARENT-CHILD DEDUPLICATION ---
		// When both parent and child chunks appear, prefer the more specific child
		// and remove the parent to increase result diversity
		const childIds = new Set(
			scored.filter(r => r.id.includes('_child_')).map(r => r.id.replace(/_child_\d+$/, ''))
		);
		const deduplicated = scored.filter(r => {
			// Keep all child chunks
			if (r.id.includes('_child_')) return true;
			// Remove parent if a child from same section exists
			return !childIds.has(r.id);
		});

		// Final sort and limit
		const sorted = deduplicated.sort((a, b) => b.score - a.score).slice(0, nResults);

		// Extract snippets for each result
		for (const result of sorted) {
			const snippet = extractSnippet(result.content, query, config.snippetContextLines);
			if (snippet) {
				result.snippet = snippet;
			}
		}

		this.logger.debug({ finalResults: sorted.length }, 'Search complete');
		return sorted;
	}
}
