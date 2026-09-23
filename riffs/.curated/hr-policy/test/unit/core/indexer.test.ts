import type { Logger } from 'pino';
import { pino } from 'pino';
import { beforeEach, describe, expect, it } from 'vitest';
import { type DocIndexerConfig, DocIndexerImpl } from '../../../src/core/indexer.js';
import type { UnifiedEmbeddingConfig } from '../../../src/providers/embedding-client.js';
import { MockDatabaseManager } from '../../helpers/mock-database-manager.js';
import { MockEmbeddingService } from '../../helpers/mock-embedding-service.js';

describe('DocIndexer', () => {
	let logger: Logger;
	let embeddingConfig: UnifiedEmbeddingConfig;
	let baseConfig: DocIndexerConfig;

	beforeEach(() => {
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
	});

	// Constructor and Configuration Tests
	describe('Constructor and Configuration', () => {
		it('given config with embedding settings, when DocIndexer constructed, then config values are applied', () => {
			const indexer = new DocIndexerImpl(logger, '/tmp/test.db', baseConfig);

			const config = indexer.getConfig();
			expect(config.model).toBe('text-embedding-3-large');
			expect(config.dimensions).toBe(3072);
			expect(config.maxEmbedChars).toBe(20000);
		});

		it('given config without optional fields, when DocIndexer constructed, then defaults are applied', () => {
			const indexer = new DocIndexerImpl(logger, '/tmp/test.db', baseConfig);

			const config = indexer.getConfig();
			expect(config.sections).toBe('both');
			expect(config.weightResponse).toBe(1.8);
			expect(config.useFts).toBe(true);
			expect(config.hybrid).toBe(true);
			expect(config.alpha).toBe(0.1);
			expect(config.showMetadata).toBe(true);
			expect(config.highlight).toBe(true);
		});

		it('given config with custom indexer settings, when DocIndexer constructed, then custom values override defaults', () => {
			const customEmbedding: UnifiedEmbeddingConfig = {
				provider: 'openai',
				model: 'text-embedding-3-large',
				dimensions: 3072,
				api_key: 'test-key',
				base_url: 'https://api.openai.com/v1',
				timeout: 30000,
			} as UnifiedEmbeddingConfig;

			const customConfig: DocIndexerConfig = {
				embeddingConfig: customEmbedding,
				sections: 'response',
				weightResponse: 2.5,
				useFts: false,
				hybrid: false,
				alpha: 0.5,
				showMetadata: false,
				highlight: false,
			};

			const indexer = new DocIndexerImpl(logger, '/tmp/test.db', customConfig);
			const config = indexer.getConfig();

			expect(config.sections).toBe('response');
			expect(config.weightResponse).toBe(2.5);
			expect(config.useFts).toBe(false);
			expect(config.hybrid).toBe(false);
			expect(config.alpha).toBe(0.5);
			expect(config.showMetadata).toBe(false);
			expect(config.highlight).toBe(false);
		});
	});

	// Dependency Injection Tests
	describe('Dependency Injection', () => {
		it('given mock database and embedding service, when DocIndexer constructed with injected dependencies, then custom dependencies are used', () => {
			const mockDb = new MockDatabaseManager('/tmp/test.db', true);
			const mockEmbedding = new MockEmbeddingService(3072);

			const indexer = new DocIndexerImpl(logger, '/tmp/test.db', baseConfig, mockDb, mockEmbedding);

			expect(indexer.getEmbeddingService()).toBe(mockEmbedding);
		});

		it('given no injected dependencies, when DocIndexer constructed, then real dependencies are created', () => {
			const indexer = new DocIndexerImpl(logger, '/tmp/test.db', baseConfig);

			const embeddingService = indexer.getEmbeddingService();
			expect(embeddingService).toBeDefined();
			expect(embeddingService.getDimensions()).toBe(3072);
		});
	});

	// Getter Tests
	describe('Getters', () => {
		it('given DocIndexer instance, when getConfig called, then returns current configuration', () => {
			const indexer = new DocIndexerImpl(logger, '/tmp/test.db', baseConfig);

			const config = indexer.getConfig();
			expect(config).toBeDefined();
			expect(config.model).toBe('text-embedding-3-large');
			expect(config.dimensions).toBe(3072);
		});

		it('given DocIndexer instance, when getEmbeddingService called, then returns embedding service instance', () => {
			const mockEmbedding = new MockEmbeddingService(3072);
			const indexer = new DocIndexerImpl(logger, '/tmp/test.db', baseConfig, undefined, mockEmbedding);

			const embeddingService = indexer.getEmbeddingService();
			expect(embeddingService).toBe(mockEmbedding);
			expect(embeddingService.getModelName()).toBe('mock-model');
		});
	});

	// Lifecycle Tests
	describe('Lifecycle Management', () => {
		it('given DocIndexer instance, when withDatabase called, then database context is managed', () => {
			const mockDb = new MockDatabaseManager('/tmp/test.db', true);
			const indexer = new DocIndexerImpl(logger, '/tmp/test.db', baseConfig, mockDb);

			// Should not throw
			const result = indexer.withDatabase(db => {
				expect(db).toBeDefined();
				return 'done';
			});

			expect(result).toBe('done');
		});

		it('given DocIndexer in withDatabase context, when callback completes, then database is disposed', () => {
			const mockDb = new MockDatabaseManager('/tmp/test.db', true);
			const indexer = new DocIndexerImpl(logger, '/tmp/test.db', baseConfig, mockDb);

			indexer.withDatabase(() => {
				expect(mockDb.connectCalls).toBe(1);
			});

			// Dispose should have been called automatically via Disposable
			expect(mockDb.closeCalls).toBe(1);
		});

		it('given DocIndexer instance with FTS disabled, when constructed, then FTS is not enabled', () => {
			const configNoFts: DocIndexerConfig = {
				...baseConfig,
				useFts: false,
			};

			const mockDb = new MockDatabaseManager('/tmp/test.db', false);
			const indexer = new DocIndexerImpl(logger, '/tmp/test.db', configNoFts, mockDb);

			expect(indexer.getConfig().useFts).toBe(false);
		});
	});

	// Configuration with Different Embedding Models
	describe('Embedding Configuration', () => {
		it('given config with OpenAI embedding, when DocIndexer constructed, then model and dimensions are set correctly', () => {
			const indexer = new DocIndexerImpl(logger, '/tmp/test.db', baseConfig);

			const config = indexer.getConfig();
			expect(config.model).toBe('text-embedding-3-large');
			expect(config.dimensions).toBe(3072);
		});

		it('given config with smaller embedding dimensions, when DocIndexer constructed, then dimensions are applied', () => {
			const smallEmbeddingConfig: UnifiedEmbeddingConfig = {
				provider: 'openai',
				model: 'text-embedding-3-small',
				dimensions: 1536,
				api_key: 'test-key',
				base_url: 'https://api.openai.com/v1',
				timeout: 30000,
			} as UnifiedEmbeddingConfig;

			const smallConfig: DocIndexerConfig = {
				embeddingConfig: smallEmbeddingConfig,
			};

			const indexer = new DocIndexerImpl(logger, '/tmp/test.db', smallConfig);

			expect(indexer.getConfig().dimensions).toBe(1536);
			expect(indexer.getConfig().model).toBe('text-embedding-3-small');
		});

		it('given config with custom maxEmbedChars, when DocIndexer constructed, then maxEmbedChars is applied', () => {
			const customMaxConfig: DocIndexerConfig = {
				...baseConfig,
				maxEmbedChars: 50000,
			};

			const indexer = new DocIndexerImpl(logger, '/tmp/test.db', customMaxConfig);

			expect(indexer.getConfig().maxEmbedChars).toBe(50000);
		});

		it('given config without maxEmbedChars, when DocIndexer constructed, then default maxEmbedChars is applied', () => {
			const configNoMax: DocIndexerConfig = {
				embeddingConfig,
			};

			const indexer = new DocIndexerImpl(logger, '/tmp/test.db', configNoMax);

			expect(indexer.getConfig().maxEmbedChars).toBe(20000);
		});
	});

	// Search Configuration Tests
	describe('Search Configuration', () => {
		it('given config with hybrid search enabled, when DocIndexer constructed, then hybrid settings are applied', () => {
			const hybridConfig: DocIndexerConfig = {
				...baseConfig,
				hybrid: true,
				alpha: 0.3,
			};

			const indexer = new DocIndexerImpl(logger, '/tmp/test.db', hybridConfig);

			expect(indexer.getConfig().hybrid).toBe(true);
			expect(indexer.getConfig().alpha).toBe(0.3);
		});

		it('given config with hybrid search disabled, when DocIndexer constructed, then hybrid is disabled', () => {
			const noHybridConfig: DocIndexerConfig = {
				...baseConfig,
				hybrid: false,
			};

			const indexer = new DocIndexerImpl(logger, '/tmp/test.db', noHybridConfig);

			expect(indexer.getConfig().hybrid).toBe(false);
		});
	});

	// Display Configuration Tests
	describe('Display Configuration', () => {
		it('given config with metadata display enabled, when DocIndexer constructed, then showMetadata is true', () => {
			const metadataConfig: DocIndexerConfig = {
				...baseConfig,
				showMetadata: true,
			};

			const indexer = new DocIndexerImpl(logger, '/tmp/test.db', metadataConfig);

			expect(indexer.getConfig().showMetadata).toBe(true);
		});

		it('given config with highlight enabled, when DocIndexer constructed, then highlight is true', () => {
			const highlightConfig: DocIndexerConfig = {
				...baseConfig,
				highlight: true,
			};

			const indexer = new DocIndexerImpl(logger, '/tmp/test.db', highlightConfig);

			expect(indexer.getConfig().highlight).toBe(true);
		});
	});

	// Sections Configuration Tests
	describe('Content Sections Configuration', () => {
		it('given config with sections set to both, when DocIndexer constructed, then sections is both', () => {
			const bothConfig: DocIndexerConfig = {
				...baseConfig,
				sections: 'both',
			};

			const indexer = new DocIndexerImpl(logger, '/tmp/test.db', bothConfig);

			expect(indexer.getConfig().sections).toBe('both');
		});

		it('given config with sections set to response, when DocIndexer constructed, then sections is response', () => {
			const responseConfig: DocIndexerConfig = {
				...baseConfig,
				sections: 'response',
			};

			const indexer = new DocIndexerImpl(logger, '/tmp/test.db', responseConfig);

			expect(indexer.getConfig().sections).toBe('response');
		});

		it('given config with sections set to request, when DocIndexer constructed, then sections is request', () => {
			const requestConfig: DocIndexerConfig = {
				...baseConfig,
				sections: 'request',
			};

			const indexer = new DocIndexerImpl(logger, '/tmp/test.db', requestConfig);

			expect(indexer.getConfig().sections).toBe('request');
		});
	});

	// Response Weight Configuration Tests
	describe('Response Weight Configuration', () => {
		it('given config with default weightResponse, when DocIndexer constructed, then weightResponse is 1.8', () => {
			const indexer = new DocIndexerImpl(logger, '/tmp/test.db', baseConfig);

			expect(indexer.getConfig().weightResponse).toBe(1.8);
		});

		it('given config with custom weightResponse, when DocIndexer constructed, then custom value is applied', () => {
			const customWeightConfig: DocIndexerConfig = {
				...baseConfig,
				weightResponse: 2.5,
			};

			const indexer = new DocIndexerImpl(logger, '/tmp/test.db', customWeightConfig);

			expect(indexer.getConfig().weightResponse).toBe(2.5);
		});
	});
});
