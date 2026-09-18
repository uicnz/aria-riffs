/**
 * Qdrant client wrapper
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import type { Logger } from 'pino';
import type {
	CollectionConfig,
	CollectionInfo,
	CollectionMetadata,
	HybridQuery,
	Point,
	QdrantConfig,
	SearchResult,
} from '../lib/types.js';

// Reserved UUID for collection metadata point (all zeros - will never collide with content UUIDs)
const COLLECTION_METADATA_ID = '00000000-0000-0000-0000-000000000000';

export class QdrantProvider {
	private client: QdrantClient;
	private logger: Logger;
	private _config: QdrantConfig;

	constructor(config: QdrantConfig, logger: Logger) {
		this._config = config;
		this.logger = logger;
		this.client = new QdrantClient({
			url: `http://${config.host}:${config.port}`,
			apiKey: config.apiKey || undefined,
			timeout: config.timeout,
		});
	}

	/**
	 * Create a collection
	 */
	async createCollection(config: CollectionConfig): Promise<void> {
		this.logger.info({ collection: config.name }, 'Creating collection');

		await this.client.createCollection(config.name, {
			vectors: {
				size: config.dimensions,
				distance: config.distance,
			},
			sparse_vectors: config.sparse
				? {
						sparse: {},
					}
				: undefined,
		});

		this.logger.info({ collection: config.name }, 'Collection created');
	}

	/**
	 * Check if collection exists
	 */
	async collectionExists(name: string): Promise<boolean> {
		try {
			await this.client.getCollection(name);
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Get collection info
	 */
	async getCollectionInfo(name: string): Promise<CollectionInfo> {
		const info = await this.client.getCollection(name);
		return {
			name,
			pointsCount: info.points_count || 0,
			vectorsCount: info.indexed_vectors_count || 0,
			status: info.status,
		};
	}

	/**
	 * Upsert collection metadata as a special point
	 * Called immediately after collection creation to establish strategy
	 */
	async upsertCollectionMetadata(
		collection: string,
		metadata: CollectionMetadata,
		dimensions: number
	): Promise<void> {
		this.logger.debug({ collection, strategy: metadata.strategyName }, 'Upserting collection metadata');

		// Zero vector ensures this point is never matched in similarity searches
		const zeroVector = new Array(dimensions).fill(0);

		await this.client.upsert(collection, {
			points: [
				{
					id: COLLECTION_METADATA_ID,
					vector: zeroVector,
					payload: metadata as unknown as Record<string, unknown>,
				},
			],
		});

		this.logger.info({ collection, strategy: metadata.strategyName }, 'Collection metadata stored');
	}

	/**
	 * Get collection metadata point
	 * Returns null if metadata point doesn't exist
	 */
	async getCollectionMetadata(collection: string): Promise<CollectionMetadata | null> {
		try {
			const results = await this.client.retrieve(collection, {
				ids: [COLLECTION_METADATA_ID],
				with_payload: true,
			});

			if (results.length === 0) {
				return null;
			}

			const payload = results[0].payload;
			if (!payload?._isMetadata) {
				return null;
			}

			return payload as unknown as CollectionMetadata;
		} catch (error) {
			this.logger.debug({ collection, error }, 'Failed to retrieve collection metadata');
			return null;
		}
	}

	/**
	 * Update collection metadata counts after indexing
	 */
	async updateCollectionMetadata(
		collection: string,
		updates: { documentCount: number; chunkCount: number; lastIndexedAt: string },
		dimensions: number
	): Promise<void> {
		const existing = await this.getCollectionMetadata(collection);

		if (!existing) {
			this.logger.warn({ collection }, 'No existing metadata to update');
			return;
		}

		const updated: CollectionMetadata = {
			...existing,
			documentCount: updates.documentCount,
			chunkCount: updates.chunkCount,
			lastIndexedAt: updates.lastIndexedAt,
		};

		await this.upsertCollectionMetadata(collection, updated, dimensions);
		this.logger.debug({ collection, ...updates }, 'Collection metadata updated');
	}

	/**
	 * List all collections
	 */
	async listCollections(): Promise<string[]> {
		const response = await this.client.getCollections();
		return response.collections.map((c: { name: string }) => c.name);
	}

	/**
	 * Delete collection
	 */
	async deleteCollection(name: string): Promise<void> {
		this.logger.info({ collection: name }, 'Deleting collection');
		await this.client.deleteCollection(name);
		this.logger.info({ collection: name }, 'Collection deleted');
	}

	/**
	 * Upsert points to collection
	 */
	async upsertPoints(collection: string, points: Point[]): Promise<void> {
		this.logger.debug({ collection, count: points.length }, 'Upserting points');

		await this.client.upsert(collection, {
			points: points.map(p => ({
				id: p.id,
				vector: p.sparseVector
					? {
							'': p.vector, // Default unnamed dense vector
							sparse: p.sparseVector, // Named sparse vector
						}
					: p.vector, // Dense only if no sparse
				payload: p.payload,
			})),
		});

		this.logger.debug({ collection, count: points.length }, 'Points upserted');
	}

	/**
	 * Search with hybrid query (dense + sparse) using RRF fusion
	 */
	async hybridSearch(collection: string, query: HybridQuery): Promise<SearchResult[]> {
		this.logger.debug(
			{
				collection,
				denseWeight: query.denseWeight,
				sparseWeight: query.sparseWeight,
				limit: query.limit,
			},
			'Performing hybrid search'
		);

		// Build filter that excludes metadata point and includes any user filters
		const metadataFilter = {
			must_not: [{ key: '_isMetadata', match: { value: true } }],
		};

		const combinedFilter = query.filter ? { must: [metadataFilter, query.filter] } : metadataFilter;

		// Use prefetch with RRF fusion for true hybrid search
		const results = await this.client.query(collection, {
			prefetch: [
				{
					query: query.denseVector,
					using: '', // Default unnamed dense vector
					limit: query.limit,
				},
				{
					query: query.sparseVector,
					using: 'sparse', // Named sparse vector
					limit: query.limit,
				},
			],
			query: { fusion: 'rrf' }, // Reciprocal Rank Fusion
			limit: query.limit,
			filter: combinedFilter,
			with_payload: true,
		});

		return results.points.map(r => ({
			id: String(r.id),
			score: r.score || 0,
			content: (r.payload?.content as string) || '',
			metadata: r.payload || {},
		}));
	}

	/**
	 * Check Qdrant connection
	 */
	async checkConnection(): Promise<boolean> {
		try {
			await this.client.getCollections();
			this.logger.info('Qdrant connection successful');
			return true;
		} catch (error) {
			this.logger.error({ error }, 'Qdrant connection failed');
			return false;
		}
	}

	/**
	 * Get current configuration (for debugging/validation)
	 */
	getConfig(): QdrantConfig {
		return this._config;
	}
}
