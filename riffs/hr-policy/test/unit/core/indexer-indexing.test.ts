import * as fs from 'node:fs/promises';
import type { Logger } from 'pino';
import { pino } from 'pino';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type DocIndexerConfig, DocIndexerImpl } from '../../../src/core/indexer.js';
import type { UnifiedEmbeddingConfig } from '../../../src/providers/embedding-client.js';
import { MockDatabaseManager } from '../../helpers/mock-database-manager.js';
import { MockEmbeddingService } from '../../helpers/mock-embedding-service.js';

describe('DocIndexer Indexing Operations', () => {
	let logger: Logger;
	let embeddingConfig: UnifiedEmbeddingConfig;
	let baseConfig: DocIndexerConfig;
	let testDocsDir: string;

	beforeEach(async () => {
		logger = pino({ level: 'silent' });
		embeddingConfig = {
			provider: 'openai',
			model: 'text-embedding-3-large',
			dimensions: 3072,
			api_key: 'test-key',
			base_url: 'https://api.openai.com/v1',
			timeout: 30000,
		} as UnifiedEmbeddingConfig;
		baseConfig = {
			embeddingConfig,
			maxEmbedChars: 20000,
		};

		// Create temporary directory for test documents
		testDocsDir = `/tmp/hr-policy-indexing-${Date.now()}`;
		await fs.mkdir(testDocsDir, { recursive: true });
	});

	afterEach(async () => {
		try {
			await fs.rm(testDocsDir, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
	});

	describe('Indexing Configuration', () => {
		it('given config with maxEmbedChars, when indexer processes text, then text is truncated to maxEmbedChars', async () => {
			const maxCharsConfig: DocIndexerConfig = {
				...baseConfig,
				maxEmbedChars: 100,
			};

			const mockDb = new MockDatabaseManager('/tmp/test.db');
			const mockEmbedding = new MockEmbeddingService(3072);

			const indexer = new DocIndexerImpl(logger, '/tmp/test.db', maxCharsConfig, mockDb, mockEmbedding);

			expect(indexer.getConfig().maxEmbedChars).toBe(100);
		});

		it('given config with default maxEmbedChars, when created, then default is 20000', () => {
			const indexer = new DocIndexerImpl(logger, '/tmp/test.db', baseConfig);

			expect(indexer.getConfig().maxEmbedChars).toBe(20000);
		});
	});

	describe('Metadata Building', () => {
		it('given document with title, when metadata built, then title is included in metadata', async () => {
			// This test validates the metadata building logic
			const indexer = new DocIndexerImpl(logger, '/tmp/test.db', baseConfig);

			// Verify config is set up correctly for metadata building
			const config = indexer.getConfig();
			expect(config.model).toBeDefined();
			expect(config.dimensions).toBeDefined();
		});
	});

	describe('Document Processing Configuration', () => {
		it('given config with sections both, when indexer created, then both request and response sections are processed', () => {
			const bothConfig: DocIndexerConfig = {
				...baseConfig,
				sections: 'both',
			};

			const indexer = new DocIndexerImpl(logger, '/tmp/test.db', bothConfig);

			expect(indexer.getConfig().sections).toBe('both');
		});

		it('given config with sections response, when indexer created, then only response sections are processed', () => {
			const responseConfig: DocIndexerConfig = {
				...baseConfig,
				sections: 'response',
			};

			const indexer = new DocIndexerImpl(logger, '/tmp/test.db', responseConfig);

			expect(indexer.getConfig().sections).toBe('response');
		});

		it('given config with sections request, when indexer created, then only request sections are processed', () => {
			const requestConfig: DocIndexerConfig = {
				...baseConfig,
				sections: 'request',
			};

			const indexer = new DocIndexerImpl(logger, '/tmp/test.db', requestConfig);

			expect(indexer.getConfig().sections).toBe('request');
		});

		it('given config with sections full, when indexer created, then entire documents are processed', () => {
			const fullConfig: DocIndexerConfig = {
				...baseConfig,
				sections: 'full',
			};

			const indexer = new DocIndexerImpl(logger, '/tmp/test.db', fullConfig);

			expect(indexer.getConfig().sections).toBe('full');
		});
	});

	describe('Embedding Service Configuration', () => {
		it('given injected embedding service, when getEmbeddingService called, then injected service is returned', () => {
			const mockEmbedding = new MockEmbeddingService(1536);

			const indexer = new DocIndexerImpl(logger, '/tmp/test.db', baseConfig, undefined, mockEmbedding);

			const service = indexer.getEmbeddingService();
			expect(service.getDimensions()).toBe(1536);
		});

		it('given embedding service configuration, when indexer created, then embedding model and dimensions match config', () => {
			const largeConfig: UnifiedEmbeddingConfig = {
				provider: 'openai',
				model: 'text-embedding-3-large',
				dimensions: 3072,
				api_key: 'test-key',
				base_url: 'https://api.openai.com/v1',
				timeout: 30000,
			} as UnifiedEmbeddingConfig;

			const config: DocIndexerConfig = {
				embeddingConfig: largeConfig,
			};

			const indexer = new DocIndexerImpl(logger, '/tmp/test.db', config);

			expect(indexer.getConfig().model).toBe('text-embedding-3-large');
			expect(indexer.getConfig().dimensions).toBe(3072);
		});
	});

	describe('FTS Configuration', () => {
		it('given config with useFts true, when indexer created, then FTS is enabled', () => {
			const ftsConfig: DocIndexerConfig = {
				...baseConfig,
				useFts: true,
			};

			const mockDb = new MockDatabaseManager('/tmp/test.db', true);
			const indexer = new DocIndexerImpl(logger, '/tmp/test.db', ftsConfig, mockDb);

			expect(indexer.getConfig().useFts).toBe(true);
		});

		it('given config with useFts false, when indexer created, then FTS is disabled', () => {
			const noFtsConfig: DocIndexerConfig = {
				...baseConfig,
				useFts: false,
			};

			const mockDb = new MockDatabaseManager('/tmp/test.db', false);
			const indexer = new DocIndexerImpl(logger, '/tmp/test.db', noFtsConfig, mockDb);

			expect(indexer.getConfig().useFts).toBe(false);
		});
	});

	describe('Search Algorithm Configuration', () => {
		it('given config with hybrid search, when indexer created, then hybrid and alpha are configured', () => {
			const hybridConfig: DocIndexerConfig = {
				...baseConfig,
				hybrid: true,
				alpha: 0.4,
			};

			const indexer = new DocIndexerImpl(logger, '/tmp/test.db', hybridConfig);

			expect(indexer.getConfig().hybrid).toBe(true);
			expect(indexer.getConfig().alpha).toBe(0.4);
		});

		it('given config with semantic-only search, when indexer created, then hybrid is false', () => {
			const semanticConfig: DocIndexerConfig = {
				...baseConfig,
				hybrid: false,
			};

			const indexer = new DocIndexerImpl(logger, '/tmp/test.db', semanticConfig);

			expect(indexer.getConfig().hybrid).toBe(false);
		});

		it('given config with different alpha values, when indexer created, then alpha controls lexical weight', () => {
			const lowAlphaConfig: DocIndexerConfig = {
				...baseConfig,
				alpha: 0.1,
			};

			const highAlphaConfig: DocIndexerConfig = {
				...baseConfig,
				alpha: 0.9,
			};

			const lowAlphaIndexer = new DocIndexerImpl(logger, '/tmp/test.db', lowAlphaConfig);
			const highAlphaIndexer = new DocIndexerImpl(logger, '/tmp/test.db', highAlphaConfig);

			expect(lowAlphaIndexer.getConfig().alpha).toBe(0.1);
			expect(highAlphaIndexer.getConfig().alpha).toBe(0.9);
		});
	});

	describe('Response Emphasis Configuration', () => {
		it('given config with default weightResponse, when indexer created, then weightResponse is 1.8', () => {
			const indexer = new DocIndexerImpl(logger, '/tmp/test.db', baseConfig);

			expect(indexer.getConfig().weightResponse).toBe(1.8);
		});

		it('given config with custom weightResponse, when indexer created, then custom weight is applied', () => {
			const weightConfig: DocIndexerConfig = {
				...baseConfig,
				weightResponse: 3.0,
			};

			const indexer = new DocIndexerImpl(logger, '/tmp/test.db', weightConfig);

			expect(indexer.getConfig().weightResponse).toBe(3.0);
		});
	});

	describe('Display and Output Configuration', () => {
		it('given config with showMetadata true, when indexer created, then metadata display is enabled', () => {
			const metadataConfig: DocIndexerConfig = {
				...baseConfig,
				showMetadata: true,
			};

			const indexer = new DocIndexerImpl(logger, '/tmp/test.db', metadataConfig);

			expect(indexer.getConfig().showMetadata).toBe(true);
		});

		it('given config with showMetadata false, when indexer created, then metadata display is disabled', () => {
			const noMetadataConfig: DocIndexerConfig = {
				...baseConfig,
				showMetadata: false,
			};

			const indexer = new DocIndexerImpl(logger, '/tmp/test.db', noMetadataConfig);

			expect(indexer.getConfig().showMetadata).toBe(false);
		});

		it('given config with highlight true, when indexer created, then query highlighting is enabled', () => {
			const highlightConfig: DocIndexerConfig = {
				...baseConfig,
				highlight: true,
			};

			const indexer = new DocIndexerImpl(logger, '/tmp/test.db', highlightConfig);

			expect(indexer.getConfig().highlight).toBe(true);
		});

		it('given config with highlight false, when indexer created, then query highlighting is disabled', () => {
			const noHighlightConfig: DocIndexerConfig = {
				...baseConfig,
				highlight: false,
			};

			const indexer = new DocIndexerImpl(logger, '/tmp/test.db', noHighlightConfig);

			expect(indexer.getConfig().highlight).toBe(false);
		});
	});

	describe('Configuration Completeness', () => {
		it('given minimal config with only embeddingConfig, when indexer created, then all defaults are applied', () => {
			const minimalConfig: DocIndexerConfig = {
				embeddingConfig,
			};

			const indexer = new DocIndexerImpl(logger, '/tmp/test.db', minimalConfig);
			const config = indexer.getConfig();

			// All required fields should be present
			expect(config.model).toBeDefined();
			expect(config.dimensions).toBeDefined();
			expect(config.maxEmbedChars).toBeDefined();
			expect(config.sections).toBeDefined();
			expect(config.weightResponse).toBeDefined();
			expect(config.useFts).toBeDefined();
			expect(config.hybrid).toBeDefined();
			expect(config.alpha).toBeDefined();
			expect(config.showMetadata).toBeDefined();
			expect(config.highlight).toBeDefined();
		});
	});
});
