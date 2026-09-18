import type { DocIndexer, Logger, SearchOptions, SearchResult, SearchService } from '../../src/lib/types.js';

/**
 * Mock search service for testing.
 * Implements SearchService interface for type-safe testing.
 */
export class MockSearchService implements SearchService {
	private logger: Logger;
	private indexer: DocIndexer;

	searchCalls: Array<{
		query: string;
		nResults: number;
		opts: SearchOptions | undefined;
	}> = [];

	results: SearchResult[] = [];

	constructor(logger: Logger, indexer: DocIndexer) {
		this.logger = logger;
		this.indexer = indexer;
	}

	async search(query: string, nResults = 5, opts?: SearchOptions): Promise<SearchResult[]> {
		if (this.logger == null) {
			throw new Error('Logger is not initialized');
		}
		if (this.indexer == null) {
			throw new Error('Indexer is not initialized');
		}
		this.searchCalls.push({ query, nResults, opts });
		return this.results;
	}
}
