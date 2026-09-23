import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Logger } from 'pino';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runSearch } from '../../src/cli.js';
import { indexSections } from '../../src/core/indexer.js';
import { search } from '../../src/core/search.js';
import { HrStafferDatabase } from '../../src/db/database.js';
import { FakeEmbeddingService } from '../helpers/fake-embedding-service.js';
import { createMockLogger } from '../helpers/mock-logger.js';

describe('search integration', () => {
	const testDir = '/tmp/hr-staffer-search-test';
	const sectionsDir = join(testDir, 'sections');
	const dbPath = join(testDir, 'test.db');

	let db: HrStafferDatabase;
	let embeddingService: FakeEmbeddingService;
	let logger: Logger;

	beforeEach(async () => {
		// Clean up and create test directories
		rmSync(testDir, { recursive: true, force: true });
		mkdirSync(sectionsDir, { recursive: true });

		// Create test section files
		writeFileSync(
			join(sectionsDir, '0000-andrew-allan.md'),
			'---\nsource_file: test.md\n---\n\n# Andrew Allan\n\nSenior Engineer in Auckland office.'
		);
		writeFileSync(
			join(sectionsDir, '0001-jane-smith.md'),
			'---\nsource_file: test.md\n---\n\n# Jane Smith\n\nProduct Manager in Wellington office.'
		);
		writeFileSync(
			join(sectionsDir, '0002-bob-jones.md'),
			'---\nsource_file: test.md\n---\n\n# Bob Jones\n\nSenior Engineer in Auckland team.'
		);

		// Initialize database and index sections
		db = new HrStafferDatabase(dbPath);
		db.initialize();
		db.initDocumentTables({ useFts: true });

		embeddingService = new FakeEmbeddingService();
		logger = createMockLogger();
		await indexSections({
			sectionsDir,
			db,
			embeddingService,
			logger,
			reset: false,
		});
	});

	afterEach(() => {
		db.close();
		rmSync(testDir, { recursive: true, force: true });
	});

	it('given indexed documents, when search called, then returns results sorted by score', async () => {
		const results = await search({
			query: 'Senior Engineer Auckland',
			db,
			embeddingService,
			options: { hybrid: false, nResults: 3 },
		});

		expect(results.length).toBeGreaterThan(0);
		// Results should be sorted by score descending
		for (let i = 1; i < results.length; i++) {
			expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
		}
	});

	it('given indexed documents, when search called with hybrid mode, then includes lexical scores', async () => {
		const results = await search({
			query: 'Senior Engineer Auckland',
			db,
			embeddingService,
			options: { hybrid: true, nResults: 3 },
		});

		expect(results.length).toBeGreaterThan(0);
		// At least one result should have a non-zero lexical score
		const hasLexScore = results.some(r => r.lex_score > 0);
		expect(hasLexScore).toBe(true);
	});

	it('given indexed documents, when search called with nResults=1, then returns only one result', async () => {
		const results = await search({
			query: 'Engineer',
			db,
			embeddingService,
			options: { hybrid: false, nResults: 1 },
		});

		expect(results.length).toBe(1);
	});

	it('given indexed documents, when runSearch called, then returns search results', async () => {
		const results = await runSearch({
			query: 'Engineer',
			dbPath,
			embeddingService,
			nResults: 3,
			hybrid: false,
		});

		expect(results.length).toBeGreaterThan(0);
		expect(results[0].id).toBeDefined();
		expect(results[0].score).toBeDefined();
	});
});
