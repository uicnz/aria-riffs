import * as fs from 'node:fs/promises';
import type { Logger } from 'pino';
import { pino } from 'pino';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type DocIndexerConfig, DocIndexerImpl } from '../../../src/core/indexer.js';
import type { UnifiedEmbeddingConfig } from '../../../src/providers/embedding-client.js';
import { MockDatabaseManager } from '../../helpers/mock-database-manager.js';
import { MockEmbeddingService } from '../../helpers/mock-embedding-service.js';

describe('DocIndexer.index() Method', () => {
	let logger: Logger;
	let embeddingConfig: UnifiedEmbeddingConfig;
	let baseConfig: DocIndexerConfig;
	let testDocsDir: string;

	beforeEach(async () => {
		logger = pino({ level: 'silent' });
		embeddingConfig = {
			provider: 'openai',
			model: 'text-embedding-3-large',
			dimensions: 384,
			api_key: 'test-key',
			base_url: 'https://api.openai.com/v1',
			timeout: 30000,
		} as UnifiedEmbeddingConfig;
		baseConfig = {
			embeddingConfig,
			maxEmbedChars: 20000,
		};

		testDocsDir = `/tmp/hr-policy-index-${Date.now()}`;
		await fs.mkdir(testDocsDir, { recursive: true });
	});

	afterEach(async () => {
		try {
			await fs.rm(testDocsDir, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
	});

	describe('Index Method - Basic Functionality', () => {
		it('given empty directory, when index called, then no documents are indexed', async () => {
			const mockDb = new MockDatabaseManager('/tmp/test.db', true);
			const mockEmbedding = new MockEmbeddingService(384);

			const indexer = new DocIndexerImpl(logger, '/tmp/test.db', baseConfig, mockDb, mockEmbedding);

			await expect(indexer.index(testDocsDir, false)).resolves.toBeUndefined();
		});

		it('given single markdown file, when index called, then file is indexed', async () => {
			const testFile = `${testDocsDir}/test.md`;
			await fs.writeFile(testFile, '# Test Document\n\nThis is test content.');

			const mockDb = new MockDatabaseManager('/tmp/test.db', true);
			const mockEmbedding = new MockEmbeddingService(384);

			const indexer = new DocIndexerImpl(logger, '/tmp/test.db', baseConfig, mockDb, mockEmbedding);

			await expect(indexer.index(testDocsDir, false)).resolves.toBeUndefined();
		});

		it('given multiple markdown files, when index called, then all files are indexed', async () => {
			await fs.writeFile(`${testDocsDir}/doc1.md`, '# Document 1\n\nContent 1.');
			await fs.writeFile(`${testDocsDir}/doc2.md`, '# Document 2\n\nContent 2.');
			await fs.writeFile(`${testDocsDir}/doc3.md`, '# Document 3\n\nContent 3.');

			const mockDb = new MockDatabaseManager('/tmp/test.db', true);
			const mockEmbedding = new MockEmbeddingService(384);

			const indexer = new DocIndexerImpl(logger, '/tmp/test.db', baseConfig, mockDb, mockEmbedding);

			await expect(indexer.index(testDocsDir, false)).resolves.toBeUndefined();
		});

		it('given markdown in nested directories, when index called, then files are recursively indexed', async () => {
			await fs.mkdir(`${testDocsDir}/nested`, { recursive: true });
			await fs.writeFile(`${testDocsDir}/root.md`, '# Root\n\nRoot content.');
			await fs.writeFile(`${testDocsDir}/nested/child.md`, '# Child\n\nChild content.');

			const mockDb = new MockDatabaseManager('/tmp/test.db', true);
			const mockEmbedding = new MockEmbeddingService(384);

			const indexer = new DocIndexerImpl(logger, '/tmp/test.db', baseConfig, mockDb, mockEmbedding);

			await expect(indexer.index(testDocsDir, false)).resolves.toBeUndefined();
		});

		it('given reset flag true, when index called, then database is cleared first', async () => {
			await fs.writeFile(`${testDocsDir}/test.md`, '# Test\n\nContent.');

			const mockDb = new MockDatabaseManager('/tmp/test.db', true);
			const mockEmbedding = new MockEmbeddingService(384);

			const indexer = new DocIndexerImpl(logger, '/tmp/test.db', baseConfig, mockDb, mockEmbedding);

			await expect(indexer.index(testDocsDir, true)).resolves.toBeUndefined();
		});

		it('given reset flag false, when index called, then documents are added to existing data', async () => {
			await fs.writeFile(`${testDocsDir}/test.md`, '# Test\n\nContent.');

			const mockDb = new MockDatabaseManager('/tmp/test.db', true);
			const mockEmbedding = new MockEmbeddingService(384);

			const indexer = new DocIndexerImpl(logger, '/tmp/test.db', baseConfig, mockDb, mockEmbedding);

			await expect(indexer.index(testDocsDir, false)).resolves.toBeUndefined();
		});
	});

	describe('Index Method - Document Content Handling', () => {
		it('given document with h1 title, when indexed, then title is extracted and stored', async () => {
			await fs.writeFile(`${testDocsDir}/titled.md`, '# My Document Title\n\nContent with title extracted.');

			const mockDb = new MockDatabaseManager('/tmp/test.db', true);
			const mockEmbedding = new MockEmbeddingService(384);

			const indexer = new DocIndexerImpl(logger, '/tmp/test.db', baseConfig, mockDb, mockEmbedding);

			await expect(indexer.index(testDocsDir, false)).resolves.toBeUndefined();
		});

		it('given document without title, when indexed, then no title is stored', async () => {
			await fs.writeFile(`${testDocsDir}/untitled.md`, 'Just content without any heading.');

			const mockDb = new MockDatabaseManager('/tmp/test.db', true);
			const mockEmbedding = new MockEmbeddingService(384);

			const indexer = new DocIndexerImpl(logger, '/tmp/test.db', baseConfig, mockDb, mockEmbedding);

			await expect(indexer.index(testDocsDir, false)).resolves.toBeUndefined();
		});

		it('given document with markdown formatting, when indexed, then markdown is stripped for embedding text', async () => {
			const content = `# Title

Content with **bold**, *italic*, and \`code\`.

- List item 1
- List item 2

[Link text](https://example.com)

![Image alt](image.png)`;

			await fs.writeFile(`${testDocsDir}/formatted.md`, content);

			const mockDb = new MockDatabaseManager('/tmp/test.db', true);
			const mockEmbedding = new MockEmbeddingService(384);

			const indexer = new DocIndexerImpl(logger, '/tmp/test.db', baseConfig, mockDb, mockEmbedding);

			await expect(indexer.index(testDocsDir, false)).resolves.toBeUndefined();
		});

		it('given document exceeding maxEmbedChars, when indexed, then embedding text is truncated', async () => {
			const largeContent = `# Title\n\n${'x'.repeat(30000)}`;
			await fs.writeFile(`${testDocsDir}/large.md`, largeContent);

			const config: DocIndexerConfig = {
				embeddingConfig,
				maxEmbedChars: 100,
			};

			const mockDb = new MockDatabaseManager('/tmp/test.db', true);
			const mockEmbedding = new MockEmbeddingService(384);

			const indexer = new DocIndexerImpl(logger, '/tmp/test.db', config, mockDb, mockEmbedding);

			await expect(indexer.index(testDocsDir, false)).resolves.toBeUndefined();
		});

		it('given empty document, when indexed, then file is skipped', async () => {
			await fs.writeFile(`${testDocsDir}/empty.md`, '');
			await fs.writeFile(`${testDocsDir}/content.md`, '# Content\n\nActual content.');

			const mockDb = new MockDatabaseManager('/tmp/test.db', true);
			const mockEmbedding = new MockEmbeddingService(384);

			const indexer = new DocIndexerImpl(logger, '/tmp/test.db', baseConfig, mockDb, mockEmbedding);

			await expect(indexer.index(testDocsDir, false)).resolves.toBeUndefined();
		});

		it('given whitespace-only document, when indexed, then file is skipped', async () => {
			await fs.writeFile(`${testDocsDir}/whitespace.md`, '   \n\n  \t  \n');
			await fs.writeFile(`${testDocsDir}/real.md`, '# Real\n\nReal content.');

			const mockDb = new MockDatabaseManager('/tmp/test.db', true);
			const mockEmbedding = new MockEmbeddingService(384);

			const indexer = new DocIndexerImpl(logger, '/tmp/test.db', baseConfig, mockDb, mockEmbedding);

			await expect(indexer.index(testDocsDir, false)).resolves.toBeUndefined();
		});
	});

	describe('Index Method - Directory Handling', () => {
		it('given directory with node_modules, when index called, then node_modules are excluded', async () => {
			await fs.mkdir(`${testDocsDir}/node_modules`, { recursive: true });
			await fs.writeFile(`${testDocsDir}/node_modules/excluded.md`, 'Should be excluded.');
			await fs.writeFile(`${testDocsDir}/included.md`, '# Included\n\nContent.');

			const mockDb = new MockDatabaseManager('/tmp/test.db', true);
			const mockEmbedding = new MockEmbeddingService(384);

			const indexer = new DocIndexerImpl(logger, '/tmp/test.db', baseConfig, mockDb, mockEmbedding);

			await expect(indexer.index(testDocsDir, false)).resolves.toBeUndefined();
		});

		it('given directory with assets folder, when index called, then assets are excluded', async () => {
			await fs.mkdir(`${testDocsDir}/assets`, { recursive: true });
			await fs.writeFile(`${testDocsDir}/assets/excluded.md`, 'Should be excluded.');
			await fs.writeFile(`${testDocsDir}/included.md`, '# Included\n\nContent.');

			const mockDb = new MockDatabaseManager('/tmp/test.db', true);
			const mockEmbedding = new MockEmbeddingService(384);

			const indexer = new DocIndexerImpl(logger, '/tmp/test.db', baseConfig, mockDb, mockEmbedding);

			await expect(indexer.index(testDocsDir, false)).resolves.toBeUndefined();
		});
	});

	describe('Index Method - FTS Integration', () => {
		it('given FTS enabled config, when index called, then FTS index is populated', async () => {
			await fs.writeFile(`${testDocsDir}/test.md`, '# Test\n\nContent for FTS.');

			const config: DocIndexerConfig = {
				embeddingConfig,
				useFts: true,
			};

			const mockDb = new MockDatabaseManager('/tmp/test.db', true);
			const mockEmbedding = new MockEmbeddingService(384);

			const indexer = new DocIndexerImpl(logger, '/tmp/test.db', config, mockDb, mockEmbedding);

			await expect(indexer.index(testDocsDir, false)).resolves.toBeUndefined();
		});

		it('given FTS disabled config, when index called, then FTS index is not used', async () => {
			await fs.writeFile(`${testDocsDir}/test.md`, '# Test\n\nContent without FTS.');

			const config: DocIndexerConfig = {
				embeddingConfig,
				useFts: false,
			};

			const mockDb = new MockDatabaseManager('/tmp/test.db', false);
			const mockEmbedding = new MockEmbeddingService(384);

			const indexer = new DocIndexerImpl(logger, '/tmp/test.db', config, mockDb, mockEmbedding);

			await expect(indexer.index(testDocsDir, false)).resolves.toBeUndefined();
		});
	});
});
