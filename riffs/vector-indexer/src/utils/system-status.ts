/**
 * System status reporting for vector-indexer
 * Shows comprehensive status of services, collections, models, and storage
 */

import { statSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Logger } from 'pino';
import type { VectorIndexerConfig } from '../lib/types.js';

export interface ServiceStatus {
	name: string;
	host: string;
	port?: number;
	healthy: boolean;
	uptime?: number;
}

export interface CollectionStatus {
	name: string;
	pointsCount: number;
	vectorsCount: number;
	indexedAt?: Date;
}

export interface ModelInfo {
	name: string;
	type: 'embedding' | 'reranker';
	provider: string;
	dimensions?: number;
	model: string;
}

export interface StorageInfo {
	path: string;
	sizeBytes: number;
	sizeMB: number;
}

export interface SystemStatusReport {
	services: ServiceStatus[];
	collections: CollectionStatus[];
	models: ModelInfo[];
	storage: StorageInfo[];
	configPath: string;
}

export class SystemStatus {
	private config: VectorIndexerConfig;
	private logger: Logger;

	constructor(config: VectorIndexerConfig, logger: Logger) {
		this.config = config;
		this.logger = logger;
	}

	/**
	 * Check if a service is healthy by attempting to connect
	 */
	private async checkServiceHealth(url: string): Promise<boolean> {
		try {
			const response = await fetch(`${url}/health`, {
				signal: AbortSignal.timeout(2000),
			});
			return response.ok;
		} catch {
			return false;
		}
	}

	/**
	 * Check Qdrant health
	 */
	private async checkQdrantHealth(): Promise<boolean> {
		try {
			const response = await fetch(`http://${this.config.qdrant.host}:${this.config.qdrant.port}/readyz`, {
				signal: AbortSignal.timeout(2000),
			});
			return response.ok;
		} catch {
			return false;
		}
	}

	/**
	 * Get all service statuses
	 */
	async getServiceStatuses(): Promise<ServiceStatus[]> {
		const services: ServiceStatus[] = [];

		// Qdrant
		const qdrantHealthy = await this.checkQdrantHealth();
		services.push({
			name: 'Qdrant',
			host: `${this.config.qdrant.host}:${this.config.qdrant.port}`,
			port: this.config.qdrant.port,
			healthy: qdrantHealthy,
		});

		// Embeddings server (if using llama-cpp)
		if (this.config.embedding.provider === 'llama-cpp') {
			const embeddingsHealthy = await this.checkServiceHealth(this.config.llamaCppEmbeddings.host);
			services.push({
				name: 'Embeddings',
				host: this.config.llamaCppEmbeddings.host,
				healthy: embeddingsHealthy,
			});
		}

		// Reranker server (if using llama-cpp)
		if (this.config.reranker.provider === 'llama-cpp') {
			const rerankerHealthy = await this.checkServiceHealth(this.config.llamaCppReranker.host);
			services.push({
				name: 'Reranker',
				host: this.config.llamaCppReranker.host,
				healthy: rerankerHealthy,
			});
		}

		return services;
	}

	/**
	 * Get all collections from Qdrant
	 */
	async getCollections(): Promise<CollectionStatus[]> {
		try {
			const response = await fetch(`http://${this.config.qdrant.host}:${this.config.qdrant.port}/collections`, {
				signal: AbortSignal.timeout(5000),
			});

			if (!response.ok) {
				return [];
			}

			const data = (await response.json()) as {
				result: { collections: Array<{ name: string }> };
			};

			const collections: CollectionStatus[] = [];

			// Get details for each collection
			for (const collection of data.result.collections) {
				try {
					const collectionResponse = await fetch(
						`http://${this.config.qdrant.host}:${this.config.qdrant.port}/collections/${collection.name}`,
						{ signal: AbortSignal.timeout(5000) }
					);

					if (collectionResponse.ok) {
						const collectionData = (await collectionResponse.json()) as {
							result: {
								points_count: number;
								vectors_count: number | null;
							};
						};

						collections.push({
							name: collection.name,
							pointsCount: collectionData.result.points_count ?? 0,
							vectorsCount:
								collectionData.result.vectors_count ?? collectionData.result.points_count ?? 0,
						});
					}
				} catch (error) {
					this.logger.debug({ error, collection: collection.name }, 'Failed to get collection details');
				}
			}

			return collections;
		} catch (error) {
			this.logger.debug({ error }, 'Failed to get collections');
			return [];
		}
	}

	/**
	 * Get model information from config
	 */
	getModels(): ModelInfo[] {
		const models: ModelInfo[] = [];

		// Embedding model
		models.push({
			name: 'Embeddings',
			type: 'embedding',
			provider: this.config.embedding.provider,
			dimensions: this.config.embedding.dimensions,
			model: this.config.embedding.model,
		});

		// Reranker model
		if (this.config.reranker.enabled) {
			models.push({
				name: 'Reranker',
				type: 'reranker',
				provider: this.config.reranker.provider,
				model: this.config.reranker.model,
			});
		}

		return models;
	}

	/**
	 * Get storage information (only actual files that exist)
	 */
	getStorage(): StorageInfo[] {
		const storage: StorageInfo[] = [];

		// Check Qdrant storage directory
		try {
			const qdrantPath = resolve(process.cwd(), this.config.paths.output.qdrant);
			const stat = statSync(qdrantPath);
			if (stat.isDirectory()) {
				// Calculate directory size (simplified - just report that it exists)
				storage.push({
					path: this.config.paths.output.qdrant,
					sizeBytes: 0, // Would need recursive calculation
					sizeMB: 0,
				});
			}
		} catch {
			// Directory doesn't exist yet - that's fine
		}

		return storage;
	}

	/**
	 * Get full system status report
	 */
	async getFullStatus(): Promise<SystemStatusReport> {
		const [services, collections] = await Promise.all([this.getServiceStatuses(), this.getCollections()]);

		return {
			services,
			collections,
			models: this.getModels(),
			storage: this.getStorage(),
			configPath: '.aria/config/config-vector-indexer.yaml',
		};
	}

	/**
	 * Print formatted status report (human-readable)
	 */
	printStatus(report: SystemStatusReport): void {
		this.logger.info('=== System Status Report ===');

		// Services
		this.logger.info({ count: report.services.length }, 'Services');
		for (const service of report.services) {
			this.logger.info(
				{
					service: service.name,
					host: service.host,
					port: service.port,
					healthy: service.healthy,
				},
				`${service.healthy ? '✓' : '✗'} ${service.name}`
			);
		}

		// Models
		this.logger.info({ count: report.models.length }, 'Models');
		for (const model of report.models) {
			this.logger.info(
				{
					type: model.type,
					provider: model.provider,
					model: model.model,
					dimensions: model.dimensions,
				},
				model.name
			);
		}

		// Collections
		this.logger.info({ count: report.collections.length }, 'Collections');
		if (report.collections.length === 0) {
			this.logger.info('No collections yet - run index command to create one');
		} else {
			for (const collection of report.collections) {
				this.logger.info(
					{
						collection: collection.name,
						points: collection.pointsCount,
						vectors: collection.vectorsCount,
					},
					collection.name
				);
			}
		}

		// Storage
		this.logger.info({ count: report.storage.length }, 'Storage');
		if (report.storage.length === 0) {
			this.logger.info('No data indexed yet');
		} else {
			for (const storage of report.storage) {
				this.logger.info({ path: storage.path }, 'Qdrant storage');
			}
		}

		// Config
		this.logger.info({ configPath: report.configPath }, 'Configuration');

		// Commands help
		this.logger.info('Available commands:');
		this.logger.info('  index <dir> -c <collection>    Index documents');
		this.logger.info('  search <query> -c <collection> Search collection');
		this.logger.info('  collections --list             List collections');
		this.logger.info('  status                         Show this status');
		this.logger.info('Run with --help for all commands');
	}

	/**
	 * Print status as JSON (machine-readable)
	 */
	printStatusJSON(report: SystemStatusReport): void {
		process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
	}
}
