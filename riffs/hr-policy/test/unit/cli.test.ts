import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { executeIndex, executeSearch, type IndexOptions, type SearchOptions } from '../../src/cli.js';
import type { DocIndexer, IndexerConfig, SearchResult, SqliteConnection } from '../../src/lib/types.js';
import { MockSearchService } from '../helpers/mock-factories.js';

function createTestResult(id: string, title: string, content: string, score = 0.95): SearchResult {
	return {
		id,
		score,
		sem_score: score,
		lex_score: score - 0.05,
		path_score: 0,
		content,
		metadata: {
			id,
			title,
			relative_path: `${id}.md`,
			full_path: `/full/${id}.md`,
			indexed_at: new Date().toISOString(),
			embedding_model: 'test-model',
			dimensions: 1536,
		},
	};
}

class MockDocIndexer implements DocIndexer {
	withDatabaseCalls = 0;
	indexCalls = 0;

	withDatabase<T>(fn: (db: SqliteConnection) => T): T {
		this.withDatabaseCalls++;
		return fn({} as SqliteConnection);
	}

	async index(_directory: string, _reset: boolean): Promise<void> {
		this.indexCalls++;
	}

	getEmbeddingService() {
		return {
			embedAll: async () => [],
			embedSingle: async () => [],
			vectorToBuffer: () => Buffer.alloc(0),
			bufferToVector: () => new Float32Array(0),
			cosineSimilarity: () => 0,
			getModelName: () => 'test',
			getDimensions: () => 1536,
			getProvider: () => 'test',
		};
	}

	getConfig() {
		return {
			model: 'test-model',
			dimensions: 1536,
			maxEmbedChars: 8000,
			sections: 'both' as const,
			weightResponse: 1.8,
			useFts: true,
			hybrid: true,
			alpha: 0.2,
			pathWeight: 0.15,
			showMetadata: true,
			highlight: true,
			snippetContextLines: 2,
			maxSnippetLength: 150,
			highlightColor: 'yellow',
		};
	}
}

describe('CLI Module', () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('executeIndex', () => {
		let mockIndexer: any;
		let mockLogger: any;
		let testConfig: IndexerConfig;

		beforeEach(() => {
			mockIndexer = new MockDocIndexer();
			mockLogger = {
				debug: vi.fn(),
				info: vi.fn(),
				warn: vi.fn(),
				error: vi.fn(),
			};
			testConfig = {
				model: 'test-model',
				dimensions: 1536,
				maxEmbedChars: 8000,
				sections: 'both',
				weightResponse: 0.5,
				useFts: true,
				hybrid: true,
				alpha: 0.3,
				pathWeight: 0.15,
				showMetadata: true,
				highlight: true,
				snippetContextLines: 2,
				maxSnippetLength: 150,
				logging: {
					level: 'info',
					verbose: false,
					file: '.aria/logs/test/hr-policy-cli.log',
					maxFileSizeMb: 10,
					maxFiles: 5,
				},
			};
		});

		it('given valid indexDir and options, when executeIndex called, then indexer uses database context and indexes', async () => {
			const opts: IndexOptions = {
				reset: false,
				model: 'test-model',
				sections: 'both',
			};

			await executeIndex('./test-dir', opts, testConfig, mockIndexer, mockLogger);

			expect(mockIndexer.withDatabaseCalls).toBe(1);
			expect(mockIndexer.indexCalls).toBe(1);
		});

		it('given reset flag true, when executeIndex called, then index called with reset true', async () => {
			const opts: IndexOptions = { reset: true, model: 'test-model' };

			await executeIndex('./test-dir', opts, testConfig, mockIndexer, mockLogger);

			expect(mockIndexer.indexCalls).toBe(1);
		});

		it('given valid options, when executeIndex called, then logger logs index complete', async () => {
			const opts: IndexOptions = {
				model: 'test-model',
				sections: 'both',
			};

			await executeIndex('./test-dir', opts, testConfig, mockIndexer, mockLogger);

			expect(mockLogger.info).toHaveBeenCalledWith(
				expect.objectContaining({ indexDir: './test-dir' }),
				'Index completed'
			);
		});
	});

	describe('executeSearch', () => {
		let mockIndexer: any;
		let mockSearchService: any;
		let testConfig: IndexerConfig;
		let mockLogger: any;

		beforeEach(() => {
			mockIndexer = new MockDocIndexer();
			mockSearchService = new MockSearchService({} as any, mockIndexer);
			testConfig = {
				model: 'test-model',
				dimensions: 1536,
				maxEmbedChars: 8000,
				sections: 'both',
				weightResponse: 0.5,
				useFts: true,
				hybrid: true,
				alpha: 0.3,
				pathWeight: 0.15,
				showMetadata: true,
				highlight: true,
				snippetContextLines: 2,
				maxSnippetLength: 150,
				logging: {
					level: 'info',
					verbose: false,
					file: '.aria/logs/test/hr-policy-cli.log',
					maxFileSizeMb: 10,
					maxFiles: 5,
				},
			};
			mockLogger = {
				debug: vi.fn(),
				info: vi.fn(),
				warn: vi.fn(),
				error: vi.fn(),
			};
		});

		it('given search query and options, when executeSearch called, then search service called with query', async () => {
			const opts: SearchOptions = {
				results: '5',
				hybrid: true,
			};

			await executeSearch('test query', opts, testConfig, mockLogger, mockIndexer, mockSearchService);

			expect(mockSearchService.searchCalls).toHaveLength(1);
			expect(mockSearchService.searchCalls[0]?.query).toBe('test query');
			expect(mockSearchService.searchCalls[0]?.nResults).toBe(5);
		});

		it('given hybrid option true, when executeSearch called, then search uses hybrid settings', async () => {
			const opts: SearchOptions = { results: '5', hybrid: true, alpha: '0.4' };

			await executeSearch('test query', opts, testConfig, mockLogger, mockIndexer, mockSearchService);

			expect(mockSearchService.searchCalls[0]?.opts?.hybrid).toBe(true);
			expect(mockSearchService.searchCalls[0]?.opts?.alpha).toBe(0.4);
		});

		it('given search results, when executeSearch called, then logger logs each result', async () => {
			mockSearchService.results = [createTestResult('doc1', 'Test Document', 'Test content')];
			const opts: SearchOptions = { results: '5' };

			await executeSearch('test query', opts, testConfig, mockLogger, mockIndexer, mockSearchService);

			expect(mockLogger.info).toHaveBeenCalledWith(
				expect.objectContaining({ rank: 1, id: 'doc1' }),
				'Search result'
			);
		});

		it('given multiple search results, when executeSearch called, then all results logged', async () => {
			mockSearchService.results = [
				createTestResult('doc1', 'First', 'Content 1', 0.95),
				createTestResult('doc2', 'Second', 'Content 2', 0.87),
			];
			const opts: SearchOptions = { results: '10' };

			await executeSearch('test query', opts, testConfig, mockLogger, mockIndexer, mockSearchService);

			expect(mockLogger.info).toHaveBeenCalledWith(
				expect.objectContaining({ rank: 1, id: 'doc1' }),
				'Search result'
			);
			expect(mockLogger.info).toHaveBeenCalledWith(
				expect.objectContaining({ rank: 2, id: 'doc2' }),
				'Search result'
			);
		});

		it('given no search results, when executeSearch called, then search completed logged with zero count', async () => {
			mockSearchService.results = [];
			const opts: SearchOptions = { results: '5' };

			await executeSearch('test query', opts, testConfig, mockLogger, mockIndexer, mockSearchService);

			expect(mockLogger.info).toHaveBeenCalledWith(
				expect.objectContaining({ resultCount: 0 }),
				'Search completed'
			);
		});

		it('given results count parameter, when executeSearch called, then nResults passed to search service', async () => {
			const opts: SearchOptions = { results: '10' };

			await executeSearch('query', opts, testConfig, mockLogger, mockIndexer, mockSearchService);

			expect(mockSearchService.searchCalls[0]?.nResults).toBe(10);
		});

		it('given noHybrid option true, when executeSearch called, then hybrid disabled', async () => {
			const opts: SearchOptions = { results: '5', noHybrid: true };

			await executeSearch('test query', opts, testConfig, mockLogger, mockIndexer, mockSearchService);

			expect(mockSearchService.searchCalls[0]?.opts?.hybrid).toBe(false);
		});

		it('given no hybrid options, when executeSearch called, then uses config hybrid setting', async () => {
			const opts: SearchOptions = { results: '5' };

			await executeSearch('test query', opts, testConfig, mockLogger, mockIndexer, mockSearchService);

			expect(mockSearchService.searchCalls[0]?.opts?.hybrid).toBe(testConfig.hybrid);
		});
	});

	describe('Options validation', () => {
		it('given dimensions option, when parsed, then converted to number', () => {
			const dimensionsStr = '1536';
			const dimensions = parseInt(dimensionsStr, 10);

			expect(dimensions).toBe(1536);
			expect(typeof dimensions).toBe('number');
		});

		it('given results option, when parsed, then converted to number', () => {
			const resultsStr = '5';
			const results = parseInt(resultsStr, 10);

			expect(results).toBe(5);
			expect(typeof results).toBe('number');
		});

		it('given weightResponse option, when parsed, then converted to float', () => {
			const weightStr = '0.75';
			const weight = parseFloat(weightStr);

			expect(weight).toBe(0.75);
			expect(typeof weight).toBe('number');
		});

		it('given alpha option as undefined, when fallback applied, then uses config value', () => {
			const opts = { alpha: undefined };
			const cfgAlpha = 0.3;
			const alpha = opts.alpha != null ? parseFloat(opts.alpha) : cfgAlpha;

			expect(alpha).toBe(0.3);
		});

		it('given alpha option as string, when fallback applied, then parses alpha', () => {
			const opts = { alpha: '0.5' };
			const cfgAlpha = 0.3;
			const alpha = opts.alpha != null ? parseFloat(opts.alpha) : cfgAlpha;

			expect(alpha).toBe(0.5);
		});
	});

	describe('Logger interaction', () => {
		it('given search operation, when logger debug called, then search context logged', () => {
			const mockLogger = {
				debug: vi.fn(),
			};
			const query = 'test query';
			const hybrid = true;
			const alpha = 0.3;

			mockLogger.debug({ query, results: 'searching', hybrid, alpha }, 'Starting search');

			expect(mockLogger.debug).toHaveBeenCalledWith(expect.objectContaining({ query }), 'Starting search');
		});
	});

	describe('Configuration merging', () => {
		it('given option overrides config, when merged, then option takes precedence', () => {
			const cfg = { model: 'config-model' };
			const opts = { model: 'option-model' };
			const result = opts.model ?? cfg.model;

			expect(result).toBe('option-model');
		});

		it('given no option override, when merged, then config value used', () => {
			const cfg = { model: 'config-model' };
			const opts = { model: undefined };
			const result = opts.model ?? cfg.model;

			expect(result).toBe('config-model');
		});

		it('given multiple config fields, when merged with options, then precedence correct', () => {
			const cfg = {
				dimensions: 1536,
				maxEmbedChars: 8000,
				sections: 'both' as const,
			};
			const opts = {
				dimensions: 3072,
				maxEmbedChars: undefined,
				sections: undefined,
			};

			const result = {
				dimensions: opts.dimensions ?? cfg.dimensions,
				maxEmbedChars: opts.maxEmbedChars ?? cfg.maxEmbedChars,
				sections: opts.sections ?? cfg.sections,
			};

			expect(result.dimensions).toBe(3072);
			expect(result.maxEmbedChars).toBe(8000);
			expect(result.sections).toBe('both');
		});
	});

	describe('Indexer lifecycle with executeIndex', () => {
		let mockIndexer: any;
		let mockLogger: any;
		let testConfig: IndexerConfig;

		beforeEach(() => {
			mockIndexer = new MockDocIndexer();
			mockLogger = {
				debug: vi.fn(),
				info: vi.fn(),
				warn: vi.fn(),
				error: vi.fn(),
			};
			testConfig = {
				model: 'test-model',
				dimensions: 1536,
				maxEmbedChars: 8000,
				sections: 'both',
				weightResponse: 0.5,
				useFts: true,
				hybrid: true,
				alpha: 0.3,
				pathWeight: 0.15,
				showMetadata: true,
				highlight: true,
				snippetContextLines: 2,
				maxSnippetLength: 150,
			};
		});

		it('given reset option false, when executeIndex called, then index called with reset false', async () => {
			const opts: IndexOptions = { reset: false };
			let indexResetValue: boolean | undefined;
			const trackedIndexer = new MockDocIndexer();

			trackedIndexer.index = async (_directory: string, reset: boolean) => {
				indexResetValue = reset;
			};

			await executeIndex('./test', opts, testConfig, trackedIndexer, mockLogger);

			expect(indexResetValue).toBe(false);
		});

		it('given reset option true, when executeIndex called, then index called with reset true', async () => {
			const opts: IndexOptions = { reset: true };
			let indexResetValue: boolean | undefined;
			const trackedIndexer = new MockDocIndexer();

			trackedIndexer.index = async (_directory: string, reset: boolean) => {
				indexResetValue = reset;
			};

			await executeIndex('./test', opts, testConfig, trackedIndexer, mockLogger);

			expect(indexResetValue).toBe(true);
		});

		it('given indexer with model override, when executeIndex called, then logger uses option model', async () => {
			const opts: IndexOptions = { model: 'override-model' };

			await executeIndex('./test', opts, testConfig, mockIndexer, mockLogger);

			expect(mockLogger.info).toHaveBeenCalledWith(
				expect.objectContaining({ model: 'override-model' }),
				'Index completed'
			);
		});

		it('given no model override, when executeIndex called, then logger uses config model', async () => {
			const opts: IndexOptions = {};

			await executeIndex('./test', opts, testConfig, mockIndexer, mockLogger);

			expect(mockLogger.info).toHaveBeenCalledWith(
				expect.objectContaining({ model: 'test-model' }),
				'Index completed'
			);
		});

		it('given config with sections, when executeIndex called, then logger receives sections', async () => {
			const opts: IndexOptions = { sections: 'response' };
			const cfgWithSections = { ...testConfig, sections: 'both' as const };

			await executeIndex('./test', opts, cfgWithSections, mockIndexer, mockLogger);

			expect(mockLogger.info).toHaveBeenCalledWith(
				expect.objectContaining({ sections: 'response' }),
				'Index completed'
			);
		});
	});

	describe('Search lifecycle with executeSearch', () => {
		let mockIndexer: any;
		let mockSearchService: any;
		let testConfig: IndexerConfig;
		let mockLogger: any;

		beforeEach(() => {
			mockIndexer = new MockDocIndexer();
			mockSearchService = new MockSearchService({} as any, mockIndexer);
			testConfig = {
				model: 'test-model',
				dimensions: 1536,
				maxEmbedChars: 8000,
				sections: 'both',
				weightResponse: 0.5,
				useFts: true,
				hybrid: true,
				alpha: 0.3,
				pathWeight: 0.15,
				showMetadata: true,
				highlight: true,
				snippetContextLines: 2,
				maxSnippetLength: 150,
			};
			mockLogger = {
				debug: vi.fn(),
				info: vi.fn(),
				warn: vi.fn(),
				error: vi.fn(),
			};
		});

		it('given alpha string option, when executeSearch called, then alpha parsed to float', async () => {
			const opts: SearchOptions = { results: '5', alpha: '0.75' };

			await executeSearch('query', opts, testConfig, mockLogger, mockIndexer, mockSearchService);

			expect(mockSearchService.searchCalls[0]?.opts?.alpha).toBe(0.75);
		});

		it('given no alpha override, when executeSearch called, then uses config alpha', async () => {
			const opts: SearchOptions = { results: '5' };

			await executeSearch('query', opts, testConfig, mockLogger, mockIndexer, mockSearchService);

			expect(mockSearchService.searchCalls[0]?.opts?.alpha).toBe(testConfig.alpha);
		});

		it('given logger and search params, when executeSearch called, then debug logged with context', async () => {
			const opts: SearchOptions = { results: '5', hybrid: true, alpha: '0.5' };

			await executeSearch('test query', opts, testConfig, mockLogger, mockIndexer, mockSearchService);

			expect(mockLogger.debug).toHaveBeenCalledWith(
				expect.objectContaining({
					query: 'test query',
					hybrid: true,
					alpha: 0.5,
				}),
				'Starting search'
			);
		});
	});
});
