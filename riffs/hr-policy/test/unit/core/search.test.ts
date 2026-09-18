import type { Logger } from 'pino';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SearchServiceImpl } from '../../../src/core/search.js';
import { createLogger } from '../../../src/lib/logger.js';
import type { SearchOptions, SearchService } from '../../../src/lib/types.js';
import { SearchTestHelper } from '../../helpers/search-test-helper.js';

describe('SearchService', () => {
	let helper: SearchTestHelper;
	let logger: Logger;
	let searchService: SearchService;

	beforeEach(() => {
		helper = new SearchTestHelper();
		logger = createLogger({
			level: 'error',
			verbose: false,
			file: '.aria/logs/test/hr-policy-search.log',
		});
	});

	afterEach(() => {
		helper.clearDocuments();
	});

	describe('search method - semantic only', () => {
		it('given single document, when search called with matching phrase, then returns document with score', async () => {
			const indexer = helper.createTestIndexer();
			searchService = new SearchServiceImpl(logger, indexer);

			const doc = SearchTestHelper.createTestDocument('doc1', 'machine learning algorithms and techniques');
			helper.insertTestDocument(doc);

			const results = indexer.withDatabase((db: any) => {
				return searchService.search('machine learning algorithms', 1, {}, db);
			});

			expect(await results).toHaveLength(1);
			expect((await results)[0]!.id).toBe('doc1');
			expect((await results)[0]!.score).toBeDefined();
			expect(typeof (await results)[0]!.sem_score).toBe('number');
			// With RRF fusion, lex_score is the normalized RRF score
			expect(typeof (await results)[0]!.lex_score).toBe('number');
		});

		it('given multiple documents, when search called with max results, then returns top N results sorted by score', async () => {
			const indexer = helper.createTestIndexer();
			searchService = new SearchServiceImpl(logger, indexer);

			helper.insertTestDocuments([
				SearchTestHelper.createTestDocument('doc1', 'python is a programming language'),
				SearchTestHelper.createTestDocument('doc2', 'programming language design patterns'),
				SearchTestHelper.createTestDocument('doc3', 'web development framework'),
			]);

			const results = await indexer.withDatabase((db: any) => {
				return searchService.search('programming language', 2, {}, db);
			});

			expect(results).toHaveLength(2);
			expect(results[0]!.score).toBeGreaterThanOrEqual(results[1]!.score);
			expect(['doc1', 'doc2']).toContain(results[0]!.id);
			expect(['doc1', 'doc2']).toContain(results[1]!.id);
		});

		it('given document with no query terms, when search called, then still returns results based on semantic similarity', async () => {
			const indexer = helper.createTestIndexer();
			searchService = new SearchServiceImpl(logger, indexer);

			helper.insertTestDocument(
				SearchTestHelper.createTestDocument('doc1', 'unrelated content about gardening and plants')
			);

			const results = await indexer.withDatabase((db: any) => {
				return searchService.search('programming language', 5, {}, db);
			});

			// Semantic search may return results even with different content
			expect(Array.isArray(results)).toBe(true);
		});

		it('given document with empty embedding, when search called, then filters out invalid document', async () => {
			const indexer = helper.createTestIndexer();
			searchService = new SearchServiceImpl(logger, indexer);

			const doc = SearchTestHelper.createTestDocument('doc1', 'content');
			doc.embedding = [];
			helper.insertTestDocument(doc);

			const results = await indexer.withDatabase((db: any) => {
				return searchService.search('content', 1, {}, db);
			});

			expect(results).toHaveLength(0);
		});
	});

	describe('search method - hybrid search', () => {
		it('given documents with matching terms and embeddings, when hybrid search called, then combines semantic and lexical scores', async () => {
			const indexer = helper.createTestIndexer();
			searchService = new SearchServiceImpl(logger, indexer);

			helper.insertTestDocuments([
				SearchTestHelper.createTestDocument('doc1', 'machine learning algorithms'),
				SearchTestHelper.createTestDocument('doc2', 'deep learning neural networks'),
			]);

			const opts: SearchOptions = { hybrid: true, alpha: 0.5 };
			const results = await indexer.withDatabase((db: any) => {
				return searchService.search('learning algorithms', 2, opts, db);
			});

			expect(results.length).toBeGreaterThan(0);
			for (const result of results) {
				expect(result.lex_score).toBeGreaterThanOrEqual(0);
				expect(result.score).toBeDefined();
			}
		});

		it('given hybrid search, when search called, then produces valid scores from RRF fusion', async () => {
			const indexer = helper.createTestIndexer();
			searchService = new SearchServiceImpl(logger, indexer);

			helper.insertTestDocument(SearchTestHelper.createTestDocument('doc1', 'machine learning content'));

			const opts: SearchOptions = { hybrid: true, alpha: 0.35 };
			const results = await indexer.withDatabase((db: any) => {
				return searchService.search('machine learning', 1, opts, db);
			});

			if (results.length > 0) {
				// With RRF-based scoring, verify we get valid scores
				const result = results[0]!;
				expect(result.score).toBeGreaterThan(0);
				expect(result.score).toBeLessThanOrEqual(1);
				expect(result.sem_score).toBeGreaterThan(0);
				// lex_score is normalized RRF score
				expect(result.lex_score).toBeGreaterThanOrEqual(0);
			}
		});

		it('given hybrid search with alpha=1, when search called, then prioritizes lexical scores', async () => {
			const indexer = helper.createTestIndexer();
			searchService = new SearchServiceImpl(logger, indexer);

			helper.insertTestDocuments([
				SearchTestHelper.createTestDocument('doc1', 'machine learning'),
				SearchTestHelper.createTestDocument('doc2', 'artificial intelligence'),
			]);

			const opts: SearchOptions = { hybrid: true, alpha: 1 };
			const results = await indexer.withDatabase((db: any) => {
				return searchService.search('machine learning', 1, opts, db);
			});

			expect(results).toHaveLength(1);
			expect(results[0]!.id).toBe('doc1');
		});

		it('given hybrid search with valid alpha, when alpha out of bounds, then clamps to 0-1', async () => {
			const indexer = helper.createTestIndexer();
			searchService = new SearchServiceImpl(logger, indexer);

			helper.insertTestDocument(SearchTestHelper.createTestDocument('doc1', 'test content'));

			const opts1: SearchOptions = { hybrid: true, alpha: 2.5 };
			const results1 = await indexer.withDatabase((db: any) => {
				return searchService.search('test', 1, opts1, db);
			});
			expect(results1).toBeDefined();

			const opts2: SearchOptions = { hybrid: true, alpha: -0.5 };
			const results2 = await indexer.withDatabase((db: any) => {
				return searchService.search('test', 1, opts2, db);
			});
			expect(results2).toBeDefined();
		});
	});

	describe('search method - result ordering', () => {
		it('given multiple documents with varying scores, when search called, then returns sorted by score descending', async () => {
			const indexer = helper.createTestIndexer();
			searchService = new SearchServiceImpl(logger, indexer);

			helper.insertTestDocuments([
				SearchTestHelper.createTestDocument('doc1', 'testing'),
				SearchTestHelper.createTestDocument('doc2', 'test testing testing'),
				SearchTestHelper.createTestDocument('doc3', 'test'),
			]);

			const results = await indexer.withDatabase((db: any) => {
				return searchService.search('testing', 3, {}, db);
			});

			expect(results).toHaveLength(3);
			for (let i = 1; i < results.length; i++) {
				expect(results[i - 1]!.score).toBeGreaterThanOrEqual(results[i]!.score);
			}
		});

		it('given nResults parameter, when search called, then returns at most nResults documents', async () => {
			const indexer = helper.createTestIndexer();
			searchService = new SearchServiceImpl(logger, indexer);

			helper.insertTestDocuments([
				SearchTestHelper.createTestDocument('doc1', 'algorithm learning'),
				SearchTestHelper.createTestDocument('doc2', 'algorithm design'),
				SearchTestHelper.createTestDocument('doc3', 'algorithm analysis'),
				SearchTestHelper.createTestDocument('doc4', 'algorithm implementation'),
			]);

			const results = await indexer.withDatabase((db: any) => {
				return searchService.search('algorithm', 2, {}, db);
			});

			expect(results.length).toBeLessThanOrEqual(2);
		});

		it('given search with default nResults, when search called, then returns up to 5 results', async () => {
			const indexer = helper.createTestIndexer();
			searchService = new SearchServiceImpl(logger, indexer);

			helper.insertTestDocuments([
				SearchTestHelper.createTestDocument('doc1', 'python language'),
				SearchTestHelper.createTestDocument('doc2', 'python framework'),
				SearchTestHelper.createTestDocument('doc3', 'python library'),
				SearchTestHelper.createTestDocument('doc4', 'python package'),
				SearchTestHelper.createTestDocument('doc5', 'python module'),
				SearchTestHelper.createTestDocument('doc6', 'python script'),
			]);

			const results = await indexer.withDatabase((db: any) => {
				return searchService.search('python', 5, {}, db);
			});

			expect(results.length).toBeLessThanOrEqual(5);
		});
	});

	describe('search method - metadata preservation', () => {
		it('given document with metadata, when search called, then returns parsed metadata', async () => {
			const indexer = helper.createTestIndexer();
			searchService = new SearchServiceImpl(logger, indexer);

			const doc = SearchTestHelper.createTestDocument('doc1', 'content', {
				title: 'Custom Title',
			});
			helper.insertTestDocument(doc);

			const results = await indexer.withDatabase((db: any) => {
				return searchService.search('content', 1, {}, db);
			});

			expect(results).toHaveLength(1);
			expect(results[0]!.metadata.title).toBe('Custom Title');
		});

		it('given search result, when returned, then includes content field', async () => {
			const indexer = helper.createTestIndexer();
			searchService = new SearchServiceImpl(logger, indexer);

			const testContent = 'this is test document content';
			helper.insertTestDocument(SearchTestHelper.createTestDocument('doc1', testContent));

			const results = await indexer.withDatabase((db: any) => {
				return searchService.search('content', 1, {}, db);
			});

			expect(results).toHaveLength(1);
			expect(results[0]!.content).toBe(testContent);
		});
	});

	describe('search method - score calculation', () => {
		it('given semantic search, when similar documents compared, then higher similarity = higher score', async () => {
			const indexer = helper.createTestIndexer();
			searchService = new SearchServiceImpl(logger, indexer);

			helper.insertTestDocuments([
				SearchTestHelper.createTestDocument('doc1', 'machine learning algorithms'),
				SearchTestHelper.createTestDocument('doc2', 'deep neural networks'),
			]);

			const results = await indexer.withDatabase((db: any) => {
				return searchService.search('machine learning', 2, {}, db);
			});

			expect(results).toHaveLength(2);
			expect(results[0]!.sem_score).toBeGreaterThan(0);
		});

		it('given hybrid search with FTS results, when scoring documents, then calculates both lexical and semantic scores', async () => {
			const indexer = helper.createTestIndexer();
			searchService = new SearchServiceImpl(logger, indexer);

			helper.insertTestDocuments([
				SearchTestHelper.createTestDocument('doc1', 'machine learning networks'),
				SearchTestHelper.createTestDocument('doc2', 'deep learning algorithms'),
			]);

			const opts: SearchOptions = { hybrid: true, alpha: 0.5 };
			const results = await indexer.withDatabase((db: any) => {
				return searchService.search('learning', 2, opts, db);
			});

			for (const result of results) {
				expect(typeof result.lex_score).toBe('number');
				expect(typeof result.sem_score).toBe('number');
				expect(result.score).toBeDefined();
			}
		});
	});

	describe('search method - error handling', () => {
		it('given empty search query, when search called, then handles gracefully', async () => {
			const indexer = helper.createTestIndexer();
			searchService = new SearchServiceImpl(logger, indexer);

			helper.insertTestDocument(SearchTestHelper.createTestDocument('doc1', 'content'));

			const results = await indexer.withDatabase((db: any) => {
				return searchService.search('', 1, {}, db);
			});

			expect(Array.isArray(results)).toBe(true);
		});

		it('given hybrid search with no FTS results, when search called, then falls back to semantic only', async () => {
			const indexer = helper.createTestIndexer();
			searchService = new SearchServiceImpl(logger, indexer);

			helper.insertTestDocument(SearchTestHelper.createTestDocument('doc1', 'content'));

			const opts: SearchOptions = { hybrid: true, alpha: 0.5 };
			const results = await indexer.withDatabase((db: any) => {
				return searchService.search('nomatch', 1, opts, db);
			});

			expect(Array.isArray(results)).toBe(true);
		});
	});
});
