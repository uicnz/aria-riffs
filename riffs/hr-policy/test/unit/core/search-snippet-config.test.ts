import type { Logger } from 'pino';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SearchServiceImpl } from '../../../src/core/search.js';
import { createLogger } from '../../../src/lib/logger.js';
import type { SearchService } from '../../../src/lib/types.js';
import { SearchTestHelper } from '../../helpers/search-test-helper.js';

describe('Search Service - Snippet Config Options', () => {
	let helper: SearchTestHelper;
	let logger: Logger;
	let searchService: SearchService;

	beforeEach(() => {
		helper = new SearchTestHelper();
		logger = createLogger({
			level: 'error',
			verbose: false,
			file: '.aria/logs/test/hr-policy-search-snippet.log',
		});
	});

	afterEach(() => {
		helper.clearDocuments();
	});

	describe('snippetContextLines configuration', () => {
		it('given document with multiple paragraphs, when snippetContextLines set to 0, then snippet contains only matching line', async () => {
			const indexer = helper.createTestIndexer({
				snippetContextLines: 0,
			});
			searchService = new SearchServiceImpl(logger, indexer);

			const content = `Line 1: introduction
Line 2: target content here
Line 3: conclusion
Line 4: more text`;
			const doc = SearchTestHelper.createTestDocument('doc1', content);
			helper.insertTestDocument(doc);

			const results = await indexer.withDatabase((db: any) => {
				return searchService.search('target', 1, {}, db);
			});

			expect(results).toHaveLength(1);
			expect(results[0]!.snippet).toBeDefined();
			expect(results[0]!.snippet?.startLine).toBe(2);
			expect(results[0]!.snippet?.endLine).toBe(2);
		});

		it('given document with multiple paragraphs, when snippetContextLines set to 2, then snippet includes 2 lines before/after', async () => {
			const indexer = helper.createTestIndexer({
				snippetContextLines: 2,
			});
			searchService = new SearchServiceImpl(logger, indexer);

			const content = `Line 1: intro
Line 2: content
Line 3: target match here
Line 4: more content
Line 5: conclusion`;
			const doc = SearchTestHelper.createTestDocument('doc1', content);
			helper.insertTestDocument(doc);

			const results = await indexer.withDatabase((db: any) => {
				return searchService.search('target', 1, {}, db);
			});

			expect(results).toHaveLength(1);
			expect(results[0]!.snippet).toBeDefined();
			// Should include lines 1-5 (2 before line 3, line 3 itself, 2 after)
			expect(results[0]!.snippet?.startLine).toBe(1);
			expect(results[0]!.snippet?.endLine).toBe(5);
		});

		it('given match at document start, when snippetContextLines set to 2, then context truncates appropriately', async () => {
			const indexer = helper.createTestIndexer({
				snippetContextLines: 2,
			});
			searchService = new SearchServiceImpl(logger, indexer);

			const content = `Line 1: target match
Line 2: content
Line 3: more
Line 4: text`;
			const doc = SearchTestHelper.createTestDocument('doc1', content);
			helper.insertTestDocument(doc);

			const results = await indexer.withDatabase((db: any) => {
				return searchService.search('target', 1, {}, db);
			});

			expect(results).toHaveLength(1);
			expect(results[0]!.snippet).toBeDefined();
			// Should start at line 1 (can't go before)
			expect(results[0]!.snippet?.startLine).toBe(1);
			expect(results[0]!.snippet?.endLine).toBeLessThanOrEqual(3);
		});

		it('given different snippetContextLines values, when search called, then each produces different line ranges', async () => {
			const content = `Line 1
Line 2
Line 3
Line 4: match
Line 5
Line 6
Line 7`;

			// Test with context of 1
			const indexer1 = helper.createTestIndexer({
				snippetContextLines: 1,
			});
			const service1 = new SearchServiceImpl(logger, indexer1);
			const doc1 = SearchTestHelper.createTestDocument('doc1', content);
			helper.insertTestDocument(doc1);

			const results1 = await indexer1.withDatabase((db: any) => {
				return service1.search('match', 1, {}, db);
			});

			helper.clearDocuments();

			// Test with context of 3
			const indexer2 = helper.createTestIndexer({
				snippetContextLines: 3,
			});
			const service2 = new SearchServiceImpl(logger, indexer2);
			const doc2 = SearchTestHelper.createTestDocument('doc2', content);
			helper.insertTestDocument(doc2);

			const results2 = await indexer2.withDatabase((db: any) => {
				return service2.search('match', 1, {}, db);
			});

			expect(results1).toHaveLength(1);
			expect(results2).toHaveLength(1);

			const lineCount1 = (results1[0]!.snippet?.endLine ?? 0) - (results1[0]!.snippet?.startLine ?? 0) + 1;
			const lineCount2 = (results2[0]!.snippet?.endLine ?? 0) - (results2[0]!.snippet?.startLine ?? 0) + 1;

			// More context should give more lines
			expect(lineCount2).toBeGreaterThan(lineCount1);
		});
	});

	describe('snippet generation with config', () => {
		it('given search result, when snippet generated, then includes matchIndices', async () => {
			const indexer = helper.createTestIndexer();
			searchService = new SearchServiceImpl(logger, indexer);

			const doc = SearchTestHelper.createTestDocument('doc1', 'This is a test document with test content');
			helper.insertTestDocument(doc);

			const results = await indexer.withDatabase((db: any) => {
				return searchService.search('test', 1, {}, db);
			});

			expect(results).toHaveLength(1);
			expect(results[0]!.snippet).toBeDefined();
			expect(results[0]!.snippet?.matchIndices.length).toBeGreaterThan(0);
		});

		it('given document with multiple matches, when searched, then all matches included in snippet', async () => {
			const indexer = helper.createTestIndexer();
			searchService = new SearchServiceImpl(logger, indexer);

			const doc = SearchTestHelper.createTestDocument(
				'doc1',
				'test case with test logic and test data throughout'
			);
			helper.insertTestDocument(doc);

			const results = await indexer.withDatabase((db: any) => {
				return searchService.search('test', 1, {}, db);
			});

			expect(results).toHaveLength(1);
			expect(results[0]!.snippet).toBeDefined();
			// Should have multiple match indices for 'test'
			expect(results[0]!.snippet?.matchIndices.length).toBeGreaterThanOrEqual(3);
		});
	});
});
