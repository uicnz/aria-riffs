/**
 * Factory functions for creating mock instances.
 * Mocks implement their respective service interfaces.
 */

import type { DocIndexer, Logger } from '../../src/lib/types.js';
import { MockDatabaseManager } from './mock-database-manager.js';
import { MockEmbeddingService } from './mock-embedding-service.js';
import { MockSearchService } from './mock-search-service.js';

/**
 * Create a mock database manager for testing.
 */
export function createMockDatabase(dbFile: string, useFts = true): MockDatabaseManager {
	return new MockDatabaseManager(dbFile, useFts);
}

/**
 * Create a mock embedding service for testing.
 */
export function createMockEmbeddingService(dimensions = 384): MockEmbeddingService {
	return new MockEmbeddingService(dimensions);
}

/**
 * Create a mock search service for testing.
 */
export function createMockSearchService(logger: Logger, indexer: DocIndexer): MockSearchService {
	return new MockSearchService(logger, indexer);
}

// Re-export mock classes for direct use when needed
export { MockDatabaseManager, MockEmbeddingService, MockSearchService };
