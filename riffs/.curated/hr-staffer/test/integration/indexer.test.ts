import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Logger } from 'pino';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { indexSections } from '../../src/core/indexer.js';
import { HrStafferDatabase } from '../../src/db/database.js';
import { FakeEmbeddingService } from '../helpers/fake-embedding-service.js';
import { createMockLogger } from '../helpers/mock-logger.js';

describe('indexer integration', () => {
	const testDir = '/tmp/hr-staffer-indexer-test';
	const sectionsDir = path.join(testDir, 'sections');
	const dbPath = path.join(testDir, 'test.db');
	let db: HrStafferDatabase;
	let embeddingService: FakeEmbeddingService;
	let logger: Logger;

	beforeEach(() => {
		mkdirSync(sectionsDir, { recursive: true });
		embeddingService = new FakeEmbeddingService();
		logger = createMockLogger();
		db = new HrStafferDatabase(dbPath);
		db.initialize();
		db.initDocumentTables({ useFts: true });
	});

	afterEach(() => {
		try {
			db?.close();
			rmSync(testDir, { recursive: true, force: true });
		} catch {
			// Cleanup failure is not critical
		}
	});

	// Helper to create test section files
	function createSectionFile(filename: string, content: string): string {
		const filePath = path.join(sectionsDir, filename);
		writeFileSync(filePath, content);
		return filePath;
	}

	describe('indexSections', () => {
		it('given directory with 3 section files, when indexSections called, then 3 documents inserted into database', async () => {
			createSectionFile('0000-alice.md', '# Alice\n\nAlice is an engineer.');
			createSectionFile('0001-bob.md', '# Bob\n\nBob is a manager.');
			createSectionFile('0002-carol.md', '# Carol\n\nCarol is a designer.');

			const result = await indexSections({
				sectionsDir,
				db,
				embeddingService,
				logger,
			});

			expect(result.documentCount).toBe(3);
			expect(db.getDocumentCount()).toBe(3);
			expect(db.getDocument('0000-alice')).toBeDefined();
			expect(db.getDocument('0001-bob')).toBeDefined();
			expect(db.getDocument('0002-carol')).toBeDefined();
		});

		it('given existing documents in database, when indexSections called with reset=true, then old documents cleared and only new documents present', async () => {
			// Insert some existing documents first
			const embedding = new Float32Array([0.1, 0.2, 0.3]);
			db.insertDocument('old-doc-1', 'Old content', embedding, {});
			db.insertDocument('old-doc-2', 'Old content', embedding, {});
			expect(db.getDocumentCount()).toBe(2);

			// Create new section files
			createSectionFile('0000-new.md', '# New\n\nNew content.');

			await indexSections({
				sectionsDir,
				db,
				embeddingService,
				logger,
				reset: true,
			});

			// Old documents should be gone, only new document present
			expect(db.getDocumentCount()).toBe(1);
			expect(db.getDocument('old-doc-1')).toBeUndefined();
			expect(db.getDocument('old-doc-2')).toBeUndefined();
			expect(db.getDocument('0000-new')).toBeDefined();
		});

		it('given sections directory, when indexSections called, then index_metadata recorded with source, count, and model', async () => {
			createSectionFile('0000-alice.md', '# Alice\n\nAlice content.');
			createSectionFile('0001-bob.md', '# Bob\n\nBob content.');

			await indexSections({
				sectionsDir,
				db,
				embeddingService,
				logger,
			});

			const indexMeta = db.getLatestIndexMetadata();

			expect(indexMeta).toBeDefined();
			expect(indexMeta?.source_file).toBe(sectionsDir);
			expect(indexMeta?.section_count).toBe(2);
			expect(indexMeta?.embedding_model).toBe('fake-embedding-model');
		});

		it('given directory with some empty files, when indexSections called, then empty files not indexed', async () => {
			createSectionFile('0000-content.md', '# Content\n\nThis has content.');
			createSectionFile('0001-empty.md', ''); // Empty file
			createSectionFile('0002-whitespace.md', '   \n\n   '); // Whitespace only
			createSectionFile('0003-more.md', '# More\n\nMore content here.');

			const result = await indexSections({
				sectionsDir,
				db,
				embeddingService,
				logger,
			});

			// Should only index non-empty files
			expect(result.documentCount).toBe(2);
			expect(db.getDocumentCount()).toBe(2);
			expect(db.getDocument('0000-content')).toBeDefined();
			expect(db.getDocument('0001-empty')).toBeUndefined();
			expect(db.getDocument('0002-whitespace')).toBeUndefined();
			expect(db.getDocument('0003-more')).toBeDefined();
		});

		it('given file with 500 chars and maxEmbedChars=100, when indexSections called, then embedding generated for truncated 100-char text', async () => {
			const longContent = `# Title\n\n${'A'.repeat(500)}`;
			createSectionFile('0000-long.md', longContent);

			await indexSections({
				sectionsDir,
				db,
				embeddingService,
				logger,
				maxEmbedChars: 100,
			});

			// The embedding service should have received truncated text
			// We check by verifying the last text sent to embedding service
			expect(embeddingService.getLastText().length).toBeLessThanOrEqual(100);
			expect(embeddingService.getCallCount()).toBe(1);
		});
	});
});
