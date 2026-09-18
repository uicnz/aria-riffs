/**
 * Document indexing pipeline orchestration
 * Thin pipeline: scan → strategy.chunk() → embed → store
 */

import type { Logger } from 'pino';
import type { Chunk, CollectionMetadata, IndexOptions, IndexStats, VectorIndexerConfig } from '../lib/types.js';
import { EmbeddingProvider } from '../providers/embeddings.js';
import { QdrantProvider } from '../providers/qdrant.js';
import { SparseVectorProvider } from '../providers/sparse-vectors.js';
import { Chunker } from './chunker.js';
import { FileScanner } from './file-scanner.js';
import { MetadataExtractor } from './metadata-extractor.js';

export class Indexer {
	private logger: Logger;
	private config: VectorIndexerConfig;
	private fileScanner: FileScanner;
	private chunker: Chunker;
	private metadataExtractor: MetadataExtractor;
	private embeddingProvider: EmbeddingProvider;
	private sparseVectorProvider: SparseVectorProvider;
	private qdrantProvider: QdrantProvider;

	constructor(config: VectorIndexerConfig, logger: Logger) {
		this.config = config;
		this.logger = logger;

		// Initialize components
		this.fileScanner = new FileScanner(logger);
		this.chunker = new Chunker(config.embedding.chunking, logger);
		this.metadataExtractor = new MetadataExtractor(config.embedding.chunking.metadataExtraction, logger);
		this.embeddingProvider = new EmbeddingProvider(config, logger);
		this.sparseVectorProvider = new SparseVectorProvider(config.sparse, logger);
		this.qdrantProvider = new QdrantProvider(config.qdrant, logger);
	}

	/**
	 * Index documents from directory
	 */
	async index(options: IndexOptions): Promise<IndexStats> {
		const isDryRun = options.dryRun ?? false;
		this.logger.info(
			{ directory: options.directory, collection: options.collection, dryRun: isDryRun },
			isDryRun ? 'Starting indexing (DRY RUN - no Qdrant operations)' : 'Starting indexing'
		);

		const startTime = Date.now();
		const stats: IndexStats = {
			documentsProcessed: 0,
			chunksCreated: 0,
			totalTokens: 0,
			errors: [],
			duration: 0,
			successRate: 0,
		};

		try {
			// 1. Ensure collection exists (skip in dry-run mode)
			if (!isDryRun) {
				await this.ensureCollection(options);
			}

			// 2. Scan files
			const files = await this.fileScanner.scan(options.directory, {
				patterns: ['**/*.md', '**/*.txt'],
				ignore: ['**/node_modules/**', '**/.git/**'],
			});

			this.logger.info({ fileCount: files.length }, 'Files discovered');

			// Notify scan complete (for progress UI)
			options.onScanComplete?.(files.length);

			// 3. Process each file
			for (let i = 0; i < files.length; i++) {
				const file = files[i];
				try {
					const result = isDryRun
						? await this.processFileDryRun(file.path, file.content)
						: await this.processFile(file.path, file.content, options);
					stats.documentsProcessed++;
					stats.chunksCreated += result.chunksCreated;
					stats.totalTokens += result.totalTokens;
				} catch (error) {
					const message = error instanceof Error ? error.message : String(error);
					stats.errors.push(`${file.path}: ${message}`);
					this.logger.error({ path: file.path, error }, 'Failed to process file');
				}
				// Notify file progress (for progress UI)
				options.onFileProgress?.(i + 1, files.length, file.path);
			}

			// 4. Update collection metadata with final counts (skip in dry-run mode)
			if (!isDryRun) {
				const dimensions = options.dimensions || this.config.embedding.dimensions;
				await this.qdrantProvider.updateCollectionMetadata(
					options.collection,
					{
						documentCount: stats.documentsProcessed,
						chunkCount: stats.chunksCreated,
						lastIndexedAt: new Date().toISOString(),
					},
					dimensions
				);
			}

			// 5. Calculate stats
			stats.duration = Date.now() - startTime;
			stats.successRate = files.length > 0 ? stats.documentsProcessed / files.length : 0;

			this.logger.info(
				{
					stats,
					dryRun: isDryRun,
				},
				isDryRun ? 'Indexing complete (DRY RUN)' : 'Indexing complete'
			);

			return stats;
		} catch (error) {
			this.logger.error({ error }, 'Indexing failed');
			throw error;
		}
	}

	/**
	 * Process a single file
	 * Strategy handles all preprocessing - indexer just embeds and stores
	 */
	private async processFile(
		path: string,
		content: string,
		options: IndexOptions
	): Promise<{ chunksCreated: number; totalTokens: number }> {
		this.logger.debug({ path }, 'Processing file');

		// Extract metadata for payload (strategy also extracts for enrichment)
		const metadata = this.metadataExtractor.extractFrontmatter(content);

		// Strategy handles: parse → small doc check → chunk → enrich
		const chunks: Chunk[] = this.chunker.chunk(content, path);

		// Generate embeddings
		const texts = chunks.map(c => c.content);
		const embeddings = await this.embeddingProvider.embedBatch(texts);

		// Generate sparse vectors
		const sparseVectors = texts.map(t => this.sparseVectorProvider.generateSparseVector(t));

		// Upsert to Qdrant
		const points = chunks.map((chunk, i) => ({
			id: chunk.id,
			vector: embeddings[i].embedding,
			sparseVector: sparseVectors[i],
			payload: {
				content: chunk.content,
				sourcePath: chunk.documentId,
				heading: chunk.heading,
				level: chunk.level,
				context: chunk.context,
				metadata,
			},
		}));

		await this.qdrantProvider.upsertPoints(options.collection, points);

		// Calculate total tokens from embeddings
		const totalTokens = embeddings.reduce((sum, result) => sum + result.tokens, 0);

		this.logger.debug({ path, chunks: chunks.length, tokens: totalTokens }, 'File processed');

		return { chunksCreated: chunks.length, totalTokens };
	}

	/**
	 * Process a single file in dry-run mode
	 * Performs chunking but skips embedding and Qdrant operations
	 */
	private async processFileDryRun(
		path: string,
		content: string
	): Promise<{ chunksCreated: number; totalTokens: number }> {
		this.logger.debug({ path }, 'Processing file (dry run)');

		// Strategy handles: parse → small doc check → chunk → enrich
		const chunks: Chunk[] = this.chunker.chunk(content, path);

		// Estimate tokens from chunk content (rough approximation: ~4 chars per token)
		const estimatedTokens = chunks.reduce((sum, chunk) => sum + Math.ceil(chunk.content.length / 4), 0);

		this.logger.debug({ path, chunks: chunks.length, estimatedTokens }, 'File processed (dry run)');

		return { chunksCreated: chunks.length, totalTokens: estimatedTokens };
	}

	/**
	 * Ensure collection exists and strategy is compatible
	 */
	private async ensureCollection(options: IndexOptions): Promise<void> {
		const strategyName = this.config.embedding.chunking.strategy;
		const dimensions = options.dimensions || this.config.embedding.dimensions;
		const exists = await this.qdrantProvider.collectionExists(options.collection);

		if (!exists) {
			// Create new collection
			await this.qdrantProvider.createCollection({
				name: options.collection,
				dimensions,
				sparse: this.config.sparse.enabled,
				distance: 'Cosine',
			});

			// Store strategy metadata immediately after creation
			// Get strategy-specific config (use type assertion for dynamic access)
			const chunkingConfig = this.config.embedding.chunking as unknown as Record<string, unknown>;
			const metadata: CollectionMetadata = {
				_isMetadata: true,
				strategyName,
				strategyConfig: (chunkingConfig[strategyName] as Record<string, unknown>) || {},
				createdAt: new Date().toISOString(),
				documentCount: 0,
				chunkCount: 0,
			};

			await this.qdrantProvider.upsertCollectionMetadata(options.collection, metadata, dimensions);

			this.logger.info(
				{ collection: options.collection, strategy: strategyName },
				'Collection created with strategy metadata'
			);
		} else {
			// Validate strategy matches existing collection
			const existingMetadata = await this.qdrantProvider.getCollectionMetadata(options.collection);

			if (existingMetadata && existingMetadata.strategyName !== strategyName) {
				throw new Error(
					`Strategy mismatch: collection '${options.collection}' was created with ` +
						`strategy '${existingMetadata.strategyName}', but current config uses '${strategyName}'. ` +
						`Delete the collection or use matching strategy.`
				);
			}

			if (!existingMetadata) {
				this.logger.warn(
					{ collection: options.collection },
					'Existing collection has no strategy metadata - adding now'
				);

				// Add metadata to legacy collection
				const legacyChunkingConfig = this.config.embedding.chunking as unknown as Record<string, unknown>;
				const metadata: CollectionMetadata = {
					_isMetadata: true,
					strategyName,
					strategyConfig: (legacyChunkingConfig[strategyName] as Record<string, unknown>) || {},
					createdAt: new Date().toISOString(),
					documentCount: 0,
					chunkCount: 0,
				};

				await this.qdrantProvider.upsertCollectionMetadata(options.collection, metadata, dimensions);
			}
		}
	}
}
