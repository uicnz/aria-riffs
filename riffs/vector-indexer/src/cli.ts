#!/usr/bin/env bun

/**
 * CLI entry point for vector-indexer
 * Thin adapter that translates CLI arguments into core logic calls
 */

import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import type { Logger } from 'pino';
import packageManifest from '../package.json' with { type: 'json' };
import { Indexer } from './core/indexer.js';
import { ServiceManager } from './core/manage-services.js';
import { Searcher } from './core/searcher.js';
import { loadConfig } from './lib/config.js';
import { createLogger } from './lib/logger.js';
import type { ChunkingStrategyName } from './lib/types.js';
import { QdrantProvider } from './providers/qdrant.js';
import { getAvailableStrategies, getStrategiesByDomain } from './strategies/index.js';
import { createProgressBar, createSpinner, succeedSpinner } from './utils/progress.js';
import { SystemStatus } from './utils/system-status.js';

/**
 * Create and configure the CLI program
 */
function createProgram(): Command {
	const program = new Command();
	let logger: Logger;

	program
		.name('vector-indexer')
		.description(packageManifest.description)
		.version(packageManifest.version)
		.hook('preAction', async thisCommand => {
			// Initialize logger before any command runs
			const configPath = thisCommand.opts().config;
			const config = loadConfig(configPath);
			logger = createLogger({
				level: config.logging.level,
				verbose: config.logging.verbose,
				file: config.logging.file,
				maxFileSizeMb: config.logging.maxFileSizeMb,
				maxFiles: config.logging.maxFiles,
			});

			// Skip service startup for shutdown command
			if (thisCommand.name() === 'shutdown') {
				return;
			}

			// Start required services
			const serviceManager = new ServiceManager(config, logger);
			await serviceManager.startServices();

			// Register cleanup on exit (if configured)
			if (config.services.shutdownOnExit) {
				process.on('SIGINT', async () => {
					await serviceManager.shutdown();
					process.exit(0);
				});
			}
		});

	// Index command
	program
		.command('index')
		.description('Index documents from a directory')
		.argument('<directory>', 'Directory containing documents to index')
		.requiredOption('-c, --collection <name>', 'Collection name')
		.option('--config <path>', 'Path to config file')
		.option('--dimensions <number>', 'Embedding dimensions', Number.parseInt)
		.option('--strategy <name>', 'Chunking strategy (e.g., generic.hierarchical, aria.heading-enriched)')
		.option('--dry-run', 'Skip Qdrant and embedding operations (for testing UI)')
		.action(async (directory: string, options) => {
			try {
				const config = loadConfig(options.config);

				// Override strategy if specified via CLI
				if (options.strategy) {
					const validStrategies = getAvailableStrategies();
					if (!validStrategies.includes(options.strategy as ChunkingStrategyName)) {
						logger.error(
							{ strategy: options.strategy, available: validStrategies },
							`Unknown strategy: ${options.strategy}. Available: ${validStrategies.join(', ')}`
						);
						process.exit(1);
					}
					config.embedding.chunking.strategy = options.strategy as ChunkingStrategyName;
					logger.info({ strategy: options.strategy }, 'Using CLI-specified strategy');
				}

				const indexer = new Indexer(config, logger);

				logger.info(
					{ directory, collection: options.collection, strategy: config.embedding.chunking.strategy },
					'Starting indexing'
				);

				// Progress tracking - use ref object to avoid TypeScript narrowing issues
				const scanSpinner = createSpinner('Scanning files...');
				const progress: { bar: ReturnType<typeof createProgressBar> | null } = { bar: null };

				const stats = await indexer.index({
					directory,
					collection: options.collection,
					dimensions: options.dimensions,
					configPath: options.config,
					dryRun: options.dryRun,
					onScanComplete: (fileCount: number) => {
						succeedSpinner(scanSpinner, `Found ${fileCount} files`);
						if (fileCount > 0) {
							progress.bar = createProgressBar(fileCount, 'Indexing');
						}
					},
					onFileProgress: (current: number, _total: number, _filePath: string) => {
						progress.bar?.update(current);
					},
				});

				progress.bar?.finish();
				logger.info({ stats }, 'Indexing completed');

				// Output results
				logger.info('=== Indexing Results ===');
				logger.info(
					{ documentsProcessed: stats.documentsProcessed },
					`Documents processed: ${stats.documentsProcessed}`
				);
				logger.info({ chunksCreated: stats.chunksCreated }, `Chunks created: ${stats.chunksCreated}`);
				logger.info({ totalTokens: stats.totalTokens }, `Total tokens: ${stats.totalTokens}`);
				logger.info({ duration: stats.duration }, `Duration: ${(stats.duration / 1000).toFixed(2)}s`);
				logger.info(
					{ successRate: stats.successRate },
					`Success rate: ${(stats.successRate * 100).toFixed(1)}%`
				);

				if (stats.errors.length > 0) {
					logger.warn({ errorCount: stats.errors.length }, `Errors: ${stats.errors.length}`);
					for (const error of stats.errors.slice(0, 5)) {
						logger.warn({ error }, `Error: ${error}`);
					}
				}

				process.exit(0);
			} catch (error) {
				logger.error({ error }, 'Index command failed');
				logger.error(error instanceof Error ? error.message : String(error));
				process.exit(1);
			}
		});

	// Strategies command
	program
		.command('strategies')
		.description('List available chunking strategies')
		.option('--config <path>', 'Path to config file')
		.option('--domain <name>', 'Filter by domain (e.g., generic, aria, legal)')
		.action(async options => {
			try {
				if (options.domain) {
					const strategies = getStrategiesByDomain(options.domain);
					if (strategies.length === 0) {
						logger.info({ domain: options.domain }, `No strategies found for domain: ${options.domain}`);
					} else {
						logger.info(
							{ domain: options.domain, count: strategies.length },
							`=== Strategies for '${options.domain}' domain ===`
						);
						for (const name of strategies) {
							logger.info({ strategy: name }, `  ${name}`);
						}
					}
				} else {
					const strategies = getAvailableStrategies();
					logger.info(
						{ count: strategies.length },
						`=== Available Chunking Strategies (${strategies.length}) ===`
					);

					// Group by domain
					const byDomain = new Map<string, string[]>();
					for (const name of strategies) {
						const domain = name.split('.')[0];
						if (!byDomain.has(domain)) {
							byDomain.set(domain, []);
						}
						byDomain.get(domain)?.push(name);
					}

					for (const [domain, domainStrategies] of byDomain) {
						logger.info({ domain }, `\n${domain}:`);
						for (const name of domainStrategies) {
							logger.info({ strategy: name }, `  ${name}`);
						}
					}
				}

				process.exit(0);
			} catch (error) {
				logger.error({ error }, 'Strategies command failed');
				logger.error(error instanceof Error ? error.message : String(error));
				process.exit(1);
			}
		});

	// Search command
	program
		.command('search')
		.description('Search indexed documents')
		.argument('<query>', 'Search query')
		.requiredOption('-c, --collection <name>', 'Collection name')
		.option('--config <path>', 'Path to config file')
		.option('--top-k <number>', 'Number of results to retrieve', Number.parseInt, 100)
		.option('--final-k <number>', 'Number of final results after re-ranking', Number.parseInt, 20)
		.option('--no-rerank', 'Disable re-ranking')
		.action(async (query: string, options) => {
			try {
				const config = loadConfig(options.config);
				const searcher = new Searcher(config, logger);

				logger.info({ query, collection: options.collection }, 'Starting search');

				const results = await searcher.search(query, {
					collection: options.collection,
					topK: options.topK,
					finalK: options.finalK,
					denseWeight: config.search.denseWeight,
					sparseWeight: config.search.sparseWeight,
					rerank: options.rerank !== false,
				});

				logger.info({ resultCount: results.length }, 'Search completed');

				logger.info({ matches: results.length }, `=== Search Results: ${results.length} matches ===`);
				for (const [index, result] of results.entries()) {
					const sourcePath = (result.metadata.sourcePath as string) || 'unknown';
					const heading = (result.metadata.heading as string) || '';

					logger.info(
						{
							rank: index + 1,
							score: result.score,
							source: sourcePath,
							heading: heading || undefined,
							preview: result.content.slice(0, 200),
						},
						`${index + 1}. Score: ${result.score.toFixed(3)} - ${sourcePath}${heading ? ` - ${heading}` : ''}`
					);
				}

				process.exit(0);
			} catch (error) {
				logger.error({ error }, 'Search command failed');
				logger.error(error instanceof Error ? error.message : String(error));
				process.exit(1);
			}
		});

	// Collections command
	program
		.command('collections')
		.description('Manage collections')
		.option('--config <path>', 'Path to config file')
		.option('--list', 'List all collections')
		.option('--delete <name>', 'Delete a collection')
		.option('--info <name>', 'Show collection information')
		.action(async options => {
			try {
				const config = loadConfig(options.config);
				const qdrant = new QdrantProvider(config.qdrant, logger);

				if (options.list) {
					const collections = await qdrant.listCollections();
					logger.info({ count: collections.length }, `=== Collections (${collections.length}) ===`);
					for (const name of collections) {
						logger.info({ collection: name }, name);
					}
				} else if (options.delete) {
					await qdrant.deleteCollection(options.delete);
					logger.info({ collection: options.delete }, `Collection '${options.delete}' deleted`);
				} else if (options.info) {
					const info = await qdrant.getCollectionInfo(options.info);
					logger.info('=== Collection Information ===');
					logger.info({ name: info.name }, `Name: ${info.name}`);
					logger.info({ points: info.pointsCount }, `Points: ${info.pointsCount}`);
					logger.info({ vectors: info.vectorsCount }, `Vectors: ${info.vectorsCount}`);
					logger.info({ status: info.status }, `Status: ${info.status}`);
				} else {
					logger.error('Please specify an option: --list, --delete, or --info');
					process.exit(1);
				}

				process.exit(0);
			} catch (error) {
				logger.error({ error }, 'Collections command failed');
				logger.error(error instanceof Error ? error.message : String(error));
				process.exit(1);
			}
		});

	// Check command
	program
		.command('check')
		.description('Check system prerequisites')
		.option('--config <path>', 'Path to config file')
		.option('--models', 'Check Ollama models')
		.option('--qdrant', 'Check Qdrant connection')
		.option('--all', 'Check all prerequisites')
		.action(async options => {
			try {
				const config = loadConfig(options.config);

				if (options.qdrant || options.all) {
					const qdrant = new QdrantProvider(config.qdrant, logger);
					const connected = await qdrant.checkConnection();
					logger.info({ service: 'qdrant', connected }, `Qdrant: ${connected ? 'CONNECTED' : 'FAILED'}`);
				}

				if (options.models || options.all) {
					// TODO: Implement model checking
					logger.warn('Model checking: NOT IMPLEMENTED');
				}

				process.exit(0);
			} catch (error) {
				logger.error({ error }, 'Check command failed');
				logger.error(error instanceof Error ? error.message : String(error));
				process.exit(1);
			}
		});

	// Status command (also the default when no command specified)
	program
		.command('status', { isDefault: true })
		.description('Show comprehensive system status (default command)')
		.option('--config <path>', 'Path to config file')
		.option('--json', 'Output as JSON')
		.action(async options => {
			try {
				const config = loadConfig(options.config);
				const systemStatus = new SystemStatus(config, logger);
				const report = await systemStatus.getFullStatus();

				if (options.json) {
					systemStatus.printStatusJSON(report);
				} else {
					systemStatus.printStatus(report);
				}

				process.exit(0);
			} catch (error) {
				logger.error({ error }, 'Status command failed');
				logger.error(error instanceof Error ? error.message : String(error));
				process.exit(1);
			}
		});

	// Shutdown command
	program
		.command('shutdown')
		.description('Shutdown managed services')
		.option('--config <path>', 'Path to config file')
		.option('--all', 'Shutdown all services (Docker + llama-server)')
		.option('--docker', 'Shutdown only Docker/Qdrant')
		.option('--llama', 'Shutdown only llama-server processes')
		.option('--service <name>', 'Shutdown specific service (qdrant, embeddings, reranker)')
		.option('--force', 'Force shutdown even if shutdownOnExit is disabled')
		.action(async options => {
			try {
				const config = loadConfig(options.config);
				const serviceManager = new ServiceManager(config, logger);

				logger.info('Shutdown command initiated');

				await serviceManager.shutdown({
					all: options.all,
					docker: options.docker,
					llama: options.llama,
					service: options.service,
					force: options.force || true, // Force by default for manual shutdown
				});

				logger.info('Shutdown command completed');
				process.exit(0);
			} catch (error) {
				logger.error({ error }, 'Shutdown command failed');
				logger.error(error instanceof Error ? error.message : String(error));
				process.exit(1);
			}
		});

	return program;
}

/* c8 ignore start */
if (process.argv[1] === fileURLToPath(import.meta.url)) {
	createProgram().parse();
}
/* c8 ignore stop */
