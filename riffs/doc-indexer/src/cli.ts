#!/usr/bin/env bun

import * as fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import type { Logger } from 'pino';
import packageManifest from '../package.json' with { type: 'json' };
import { DocIndexer } from './core/indexer.js';
import { SearchService } from './core/search.js';
import { GraphExporter, validateGraph } from './graph/exporter.js';
import { loadConfig } from './lib/config.js';
import { createLogger } from './lib/logger.js';
import type { DocIndexerConfig } from './lib/schema.js';
import type { AriaDocConfig, SearchConfig } from './lib/types.js';
import { generateHtml } from './viewer/index.js';

function buildRuntimeConfig(config: DocIndexerConfig, overrides?: Partial<AriaDocConfig>): AriaDocConfig {
	const riffConfig = config['doc-indexer'];
	const baseSearch: SearchConfig = {
		...config.searchReference,
		...riffConfig.search,
	};
	const search = overrides?.search ? { ...baseSearch, ...overrides.search } : baseSearch;

	return {
		model: riffConfig.model,
		dimensions: riffConfig.dimensions,
		maxEmbedChars: riffConfig.maxEmbedChars,
		sections: riffConfig.sections,
		weightResponse: riffConfig.weightResponse,
		useFts: riffConfig.useFts,
		hybrid: riffConfig.hybrid,
		alpha: riffConfig.alpha,
		showMetadata: riffConfig.showMetadata,
		highlight: riffConfig.highlight,
		highlightColor: riffConfig.highlightColor,
		rfp: riffConfig.rfp,
		tui: riffConfig.tui,
		...overrides,
		search,
	};
}

/**
 * Initialize logger with config.
 * CLI always outputs to console (verbose=true), TUI handles its own display.
 */
function initLogger(config: DocIndexerConfig, debugLevel: boolean): Logger {
	return createLogger({
		level: debugLevel ? 'debug' : config.logging.level,
		verbose: true,
		file: config.logging.file,
		maxFileSizeMb: config.logging.maxFileSizeMb,
		maxFiles: config.logging.maxFiles,
	});
}

/**
 * Initialize silent logger (file only, no console output).
 * Used when outputting JSON to keep stdout clean for programmatic consumption.
 */
function initSilentLogger(config: DocIndexerConfig): Logger {
	return createLogger({
		level: config.logging.level,
		verbose: false,
		file: config.logging.file,
		maxFileSizeMb: config.logging.maxFileSizeMb,
		maxFiles: config.logging.maxFiles,
	});
}

/**
 * Create and configure the CLI program
 */
function createProgram(): Command {
	const program = new Command();
	program.name('doc-indexer').description(packageManifest.description).version(packageManifest.version);

	// Index command
	program
		.command('index')
		.argument('[directory]', 'Directory to index')
		.option('-f, --file <path>', 'SQLite DB file')
		.option('-r, --reset', 'Reset (clear) existing documents')
		.option('-k, --api-key <key>', 'OpenAI API key')
		.option('-c, --config <path>', 'Path to config file')
		.option('-v, --verbose', 'Enable verbose logging output')
		.option('--model <name>', 'Embedding model')
		.option('--dimensions <n>', 'Embedding dimensions', v => parseInt(v, 10))
		.option('--max-embed-chars <n>', 'Max characters per item for embedding', v => parseInt(v, 10))
		.option('--sections <mode>', 'response|request|both|full')
		.option('--weight-response <x>', 'Bias embeddings toward Response', v => parseFloat(v))
		.action(async (directory, opts) => {
			const config = loadConfig(opts.config);
			const riffConfig = config['doc-indexer'];
			const logger = initLogger(config, !!opts.verbose);

			// Use config paths as defaults
			const dbFile = opts.file || path.resolve(process.cwd(), riffConfig.paths.database.file);
			const indexDir = directory || riffConfig.paths.input.documents || '';

			logger.info({ dbFile, indexDir, reset: !!opts.reset }, 'Starting document indexing');

			const runtimeConfig = buildRuntimeConfig(config, {
				model: opts.model ?? riffConfig.model,
				dimensions: opts.dimensions ?? riffConfig.dimensions,
				maxEmbedChars: opts.maxEmbedChars ?? riffConfig.maxEmbedChars,
				sections: opts.sections ?? riffConfig.sections,
				weightResponse: opts.weightResponse ?? riffConfig.weightResponse,
			});

			const indexer = new DocIndexer(dbFile, logger, opts.apiKey, {
				...runtimeConfig,
			});

			await indexer.connect();
			logger.debug('Database connection established');

			const fullRfpPath = riffConfig.paths.input.fullRfp || undefined;
			await indexer.index(indexDir, !!opts.reset, fullRfpPath);
			await indexer.close();

			logger.info(
				{
					dbFile,
					indexDir,
					model: opts.model ?? riffConfig.model,
					sections: opts.sections ?? riffConfig.sections,
					weightResponse: opts.weightResponse ?? riffConfig.weightResponse,
					useFts: riffConfig.useFts,
				},
				'Document indexing completed'
			);
		});

	// Search command
	program
		.command('search')
		.argument('<query>')
		.option('-f, --file <path>', 'SQLite DB file')
		.option('-k, --api-key <key>', 'OpenAI API key')
		.option('-n, --results <num>', 'Number of results', '5')
		.option('-c, --config <path>', 'Path to config file')
		.option('-v, --verbose', 'Enable verbose logging output')
		.option('--hybrid', 'Enable hybrid lexical+semantic search via FTS5')
		.option('--no-hybrid', 'Disable hybrid search')
		.option('--alpha <x>', 'Lexical weight when hybrid is on (0..1)')
		.option('--category <val>', 'Filter by metadata.category')
		.option('--department <val>', 'Filter by metadata.department')
		.option('--priority <val>', 'Filter by metadata.priority')
		.option('--identifier <val>', 'Filter by metadata.identifier')
		.option('--no-metadata', 'Hide metadata box in results')
		.option('--no-highlight', 'Disable query term highlighting')
		.option('--json', 'Output raw JSON instead of pretty format')
		.option('--include-full', 'Include FTS-only hits from full RFP sources (lexical only)')
		.action(async (query, opts) => {
			const config = loadConfig(opts.config);
			const riffConfig = config['doc-indexer'];
			// Suppress console logging when JSON output is requested for clean stdout
			const logger = opts.json ? initSilentLogger(config) : initLogger(config, !!opts.verbose);

			const dbFile = opts.file || path.resolve(process.cwd(), riffConfig.paths.database.file);

			const hybrid = opts.hybrid ? true : opts.noHybrid ? false : riffConfig.hybrid;
			const alpha = opts.alpha != null ? parseFloat(opts.alpha) : riffConfig.alpha;

			logger.info({ query, dbFile, hybrid, alpha }, 'Starting search');

			const runtimeConfig = buildRuntimeConfig(config);
			const indexer = new DocIndexer(dbFile, logger, opts.apiKey, runtimeConfig);
			await indexer.connect();

			const searchService = new SearchService(indexer);

			const res = await searchService.search(query, parseInt(opts.results, 10), {
				hybrid,
				alpha,
				includeFull: !!opts.includeFull,
				filters: {
					category: opts.category,
					department: opts.department,
					priority: opts.priority,
					identifier: opts.identifier,
				},
			});

			await indexer.close();

			logger.info({ query, resultCount: res.length, hybrid, alpha }, 'Search completed');

			// Output mode: JSON for agent consumption or structured logging
			if (opts.json) {
				// Clean JSON output to stdout for programmatic consumption
				const jsonOutput = {
					query,
					resultCount: res.length,
					hybrid,
					alpha,
					results: res.map(result => ({
						id: result.id,
						identifier: result.metadata.identifier,
						title: result.metadata.title,
						score: result.score,
						semScore: result.sem_score,
						lexScore: result.lex_score,
						category: result.metadata.category,
						department: result.metadata.department,
						priority: result.metadata.priority,
						path: result.metadata.relative_path,
						fullPath: result.metadata.full_path,
						snippet: result.snippet?.text ?? null,
						snippetLines: result.snippet
							? { start: result.snippet.startLine, end: result.snippet.endLine }
							: null,
					})),
				};
				process.stdout.write(`${JSON.stringify(jsonOutput, null, 2)}\n`);
			} else {
				// Log results as structured data
				for (const result of res) {
					logger.info(
						{
							id: result.id,
							score: result.score,
							semScore: result.sem_score,
							lexScore: result.lex_score,
							title: result.metadata.title,
							category: result.metadata.category,
							department: result.metadata.department,
							identifier: result.metadata.identifier,
							priority: result.metadata.priority,
							relativePath: result.metadata.relative_path,
							snippet: result.snippet?.text?.slice(0, 200) ?? null,
						},
						'Search result'
					);
				}
			}
		});

	// Graph export command
	program
		.command('graph')
		.option('-f, --file <path>', 'SQLite DB file')
		.option('-o, --out <file>', 'Output graph JSON')
		.option('-c, --config <path>', 'Path to config file')
		.option('-v, --verbose', 'Enable verbose logging output')
		.option('--include-content', 'Include document content in graph (larger file)')
		.option('--no-assets', 'Exclude asset nodes from graph')
		.action(async opts => {
			const config = loadConfig(opts.config);
			const riffConfig = config['doc-indexer'];
			const logger = initLogger(config, !!opts.verbose);

			const dbFile = opts.file || path.resolve(process.cwd(), riffConfig.paths.database.file);

			// Setup output directory and paths
			const outputDir = path.resolve(process.cwd(), riffConfig.paths.output.dir);
			await fs.mkdir(outputDir, { recursive: true });

			const graphFile = opts.out || path.join(outputDir, riffConfig.paths.template.graph);
			const documentsFile = path.join(outputDir, riffConfig.paths.template.documents);

			logger.info({ dbFile, graphFile, documentsFile }, 'Starting graph export');

			const runtimeConfig = buildRuntimeConfig(config);
			const indexer = new DocIndexer(dbFile, logger, undefined, runtimeConfig);
			await indexer.connect();

			const exporter = new GraphExporter(indexer.getDb(), logger);
			await exporter.exportGraph(graphFile, {
				includeContent: !!opts.includeContent,
				includeAssets: opts.assets !== false,
			});

			// Also generate documents.jsonl for markdown viewing
			await exporter.exportDocumentsJsonl(documentsFile);

			await indexer.close();

			logger.info({ graphFile, documentsFile }, 'Graph export completed');
		});

	// HTML viewer generation command
	program
		.command('graph:html')
		.argument('[graphJson]', 'Path to graph JSON produced by graph command')
		.option('-o, --out <file>', 'Output HTML file')
		.option('-c, --config <path>', 'Path to config file')
		.option('-v, --verbose', 'Enable verbose logging output')
		.option('--mode <mode>', 'Initial mode: dim|hide', 'dim')
		.option('--rfp <name>', "Initial RFP scope (or 'all')", 'all')
		.option('--title <title>', 'Page title', 'RFP Knowledge Graph')
		.action(async (graphJson, opts) => {
			const config = loadConfig(opts.config);
			const riffConfig = config['doc-indexer'];
			const logger = initLogger(config, !!opts.verbose);

			const outputDir = path.resolve(process.cwd(), riffConfig.paths.output.dir);
			const jsonFile = graphJson || path.join(outputDir, riffConfig.paths.template.graph);
			const outFile = opts.out || path.join(outputDir, riffConfig.paths.template.viewer);
			const documentsPath = path.join(outputDir, riffConfig.paths.template.documents);

			logger.info({ jsonFile, outFile }, 'Generating HTML viewer');

			await generateHtml(jsonFile, outFile, {
				initialMode: opts.mode,
				initialRfp: opts.rfp,
				title: opts.title,
				documentsPath,
			});

			logger.info({ outFile }, 'Graph HTML written');
		});

	// Graph validation command
	program
		.command('graph:validate')
		.argument('<graphJson>', 'Path to graph JSON to validate')
		.option('-c, --config <path>', 'Path to config file')
		.option('-v, --verbose', 'Enable verbose logging output')
		.action(async (graphJson, opts) => {
			const config = loadConfig(opts.config);
			const logger = initLogger(config, !!opts.verbose);

			logger.info({ graphJson }, 'Validating graph JSON');
			const result = await validateGraph(graphJson);

			if (result.valid) {
				logger.info({ graphJson }, 'Graph JSON is valid');
			} else {
				logger.warn({ graphJson, problemCount: result.problems.length }, 'Validation found problems');
				for (const p of result.problems) {
					logger.error({ problem: p }, 'Validation problem');
				}
				process.exitCode = 1;
			}
		});

	return program;
}

/* c8 ignore start */
if (process.argv[1] === fileURLToPath(import.meta.url)) {
	createProgram().parse();
}
/* c8 ignore stop */
