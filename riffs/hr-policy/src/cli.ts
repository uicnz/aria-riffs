#!/usr/bin/env bun

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import { processDirectory, processDocument } from './core/decompose-docs.js';
import { type DocIndexerConfig, DocIndexerImpl } from './core/indexer.js';
import { SearchServiceImpl } from './core/search.js';
import { cleanQuery } from './core/stop-words.js';
import {
	buildEmbeddingConfig,
	loadConfig,
	loadDecomposerConfig,
	loadDocIndexerConfig,
	loadLoggingConfig,
} from './lib/config.js';
import { createLogger, type LoggerOptions } from './lib/logger.js';
import type {
	DecomposerConfig,
	DocIndexer,
	IndexerConfig,
	Logger,
	SearchResult,
	SearchService,
	SectionsMode,
	SqliteConnection,
} from './lib/types.js';

/**
 * Truncate text to respect maxSnippetLength.
 * Prefers line boundaries but will hard-truncate long first lines.
 */
function truncateSnippet(text: string, maxLength: number): string {
	if (text.length <= maxLength) return text;

	const lines = text.split('\n');
	let charCount = 0;
	const keptLines: string[] = [];

	for (const line of lines) {
		const lineWithNewline = charCount > 0 ? `\n${line}` : line;

		// If this line would exceed limit
		if (charCount + lineWithNewline.length > maxLength) {
			// If we have no lines yet, hard truncate this line
			if (keptLines.length === 0) {
				const truncated = `${line.slice(0, maxLength - 3)}...`;
				return truncated;
			}
			// Otherwise stop here
			break;
		}

		keptLines.push(line);
		charCount += lineWithNewline.length;
	}

	return keptLines.join('\n');
}

/**
 * Get display text for a search result, using snippet if available.
 * Falls back to truncated content if no snippet exists.
 */
function getResultSnippet(result: SearchResult, maxSnippetLength: number): string | null {
	// Prefer snippet text if available
	if (result.snippet?.text) {
		return truncateSnippet(result.snippet.text, maxSnippetLength);
	}
	// Fall back to truncated content
	if (result.content) {
		return truncateSnippet(result.content, maxSnippetLength);
	}
	return null;
}

export interface IndexOptions {
	file?: string;
	reset?: boolean;
	apiKey?: string;
	config?: string;
	verbose?: boolean;
	model?: string;
	dimensions?: number;
	maxEmbedChars?: number;
	sections?: string;
	weightResponse?: number;
}

export interface SearchOptions {
	file?: string;
	apiKey?: string;
	results: string;
	config?: string;
	verbose?: boolean;
	hybrid?: boolean;
	noHybrid?: boolean;
	alpha?: string;
}

export interface DecomposeOptions {
	file?: string;
	input?: string;
	output?: string;
	config?: string;
	primaryPattern?: string;
	fallbackPattern?: string;
	dryRun?: boolean;
	verbose?: boolean;
}

export async function executeIndex(
	indexDir: string,
	opts: IndexOptions,
	cfg: IndexerConfig,
	indexer: DocIndexer,
	logger: Logger
): Promise<void> {
	await indexer.withDatabase(async () => {
		// db parameter passed but not needed for indexing
		await indexer.index(indexDir, !!opts.reset);
	});

	logger.info(
		{
			indexDir,
			model: opts.model ?? cfg.model,
			sections: (opts.sections ?? cfg.sections) as SectionsMode,
			weightResponse: opts.weightResponse ?? cfg.weightResponse,
			useFts: cfg.useFts,
		},
		'Index completed'
	);
}

export async function executeSearch(
	query: string,
	opts: SearchOptions,
	cfg: IndexerConfig,
	logger: Logger,
	indexer: DocIndexer,
	searchService: SearchService
): Promise<void> {
	const hybrid = opts.hybrid ? true : opts.noHybrid ? false : cfg.hybrid;
	const alpha = opts.alpha != null ? parseFloat(opts.alpha) : cfg.alpha;
	const cleanedQuery = cleanQuery(query);

	logger.debug(
		{
			query,
			cleanedQuery,
			results: 'searching',
			hybrid,
			alpha,
			maxSnippetLength: cfg.maxSnippetLength,
			snippetContextLines: cfg.snippetContextLines,
		},
		'Starting search'
	);

	const res = await indexer.withDatabase(async (db: SqliteConnection) => {
		return await searchService.search(
			cleanedQuery,
			parseInt(opts.results, 10),
			{
				hybrid,
				alpha,
			},
			db
		);
	});

	// Log each result with structured fields via Pino
	for (let i = 0; i < res.length; i++) {
		const result = res[i];
		if (!result) continue;

		const meta = result.metadata;
		const snippet = getResultSnippet(result, cfg.maxSnippetLength);
		const lineRange = result.snippet ? `${result.snippet.startLine}-${result.snippet.endLine}` : null;

		logger.info(
			{
				rank: i + 1,
				id: result.id,
				score: `${(result.score * 100).toFixed(1)}%`,
				sem: `${(result.sem_score * 100).toFixed(1)}%`,
				lex: `${(result.lex_score * 100).toFixed(1)}%`,
				path: `${(result.path_score * 100).toFixed(1)}%`,
				title: meta?.title || null,
				sourcePath: meta?.source_path || meta?.relative_path || null,
				lines: lineRange,
				snippet: snippet,
			},
			'Search result'
		);
	}
	logger.info(
		{
			resultCount: res.length,
			originalQuery: query,
			cleanedQuery,
			hybrid,
			alpha,
		},
		'Search completed'
	);
}

export async function executeDecompose(
	inputFileOrDir: string | undefined,
	outputDir: string,
	opts: DecomposeOptions,
	logger: Logger,
	config: DecomposerConfig
): Promise<void> {
	// Determine if single-file or directory mode
	const isSingleFile = !!inputFileOrDir;
	const inputPath = inputFileOrDir || opts.input || config.inputDirectory;

	if (!inputPath) {
		logger.error({}, 'No input file or directory specified');
		throw new Error('Must specify either a file argument or --input directory option');
	}

	if (opts.dryRun) {
		logger.info({ inputPath, outputDir, mode: isSingleFile ? 'file' : 'directory' }, 'DRY RUN: Would decompose');
		return;
	}

	const primaryPattern = opts.primaryPattern || config.primaryPattern;
	const fallbackPattern = opts.fallbackPattern || config.fallbackPattern;

	if (isSingleFile) {
		logger.info({ inputFile: inputPath, outputDir }, 'Starting single-file decomposition');
		const sections = await processDocument(inputPath, outputDir, primaryPattern, fallbackPattern);

		// Log each section created
		for (const section of sections) {
			logger.info(
				{
					filename: section.filename,
					heading: section.heading,
				},
				'Section created'
			);
		}

		logger.info(
			{
				inputFile: inputPath,
				outputDir,
				sectionsCreated: sections.length,
			},
			'Single-file decomposition completed'
		);
	} else {
		logger.info({ inputDir: inputPath, outputDir, mode: 'directory' }, 'Starting directory decomposition');
		const sections = await processDirectory(
			inputPath,
			outputDir,
			config.filePatterns,
			primaryPattern,
			fallbackPattern
		);

		logger.info(
			{
				inputDir: inputPath,
				outputDir,
				sectionsCreated: sections.length,
			},
			'Directory decomposition completed'
		);
	}
}

async function actionDecompose(inputFile: string | undefined, opts: DecomposeOptions): Promise<void> {
	// Load logging config from file, with verbose flag override
	const loggingConfig = loadLoggingConfig(opts.config);
	const loggerOptions: LoggerOptions = {
		level: opts.verbose ? 'DEBUG' : loggingConfig.level,
		verbose: opts.verbose ?? loggingConfig.verbose,
		file: loggingConfig.file,
		maxFileSizeMb: loggingConfig.maxFileSizeMb,
		maxFiles: loggingConfig.maxFiles,
	};
	const logger = createLogger(loggerOptions);

	// Load decomposer config from file, with command-line options taking precedence
	const config = await loadDecomposerConfig(opts.config);

	const outputDir = opts.output || config.outputDirectory;

	await executeDecompose(inputFile, outputDir, opts, logger, config);
}

async function actionIndex(directory: string, opts: IndexOptions): Promise<void> {
	const cfg = await loadDocIndexerConfig(opts.config);
	const fullConfig = loadConfig(opts.config);
	const riffPaths = fullConfig['hr-policy'].paths;

	// Create logger with config (override verbose if flag set)
	const logging = cfg.logging;
	const loggerOptions: LoggerOptions = {
		level: logging?.level ?? 'INFO',
		verbose: (opts.verbose || logging?.verbose) ?? false,
		file: logging?.file ?? 'hr-policy.log',
		maxFileSizeMb: logging?.maxFileSizeMb ?? 10,
		maxFiles: logging?.maxFiles ?? 7,
	};
	const logger = createLogger(loggerOptions);

	// Use config paths as defaults
	const dbFile = opts.file || path.resolve(process.cwd(), riffPaths.database.indexer);
	const indexDir = directory || riffPaths.input.sections;

	const embeddingConfig = buildEmbeddingConfig();
	const indexerConfig: DocIndexerConfig = {
		embeddingConfig,
		model: opts.model ?? cfg.model,
		dimensions: opts.dimensions ?? cfg.dimensions,
		maxEmbedChars: opts.maxEmbedChars ?? cfg.maxEmbedChars,
		sections: (opts.sections ?? cfg.sections) as SectionsMode,
		weightResponse: opts.weightResponse ?? cfg.weightResponse,
		useFts: cfg.useFts,
	};
	const indexer = new DocIndexerImpl(logger, dbFile, indexerConfig);

	await executeIndex(indexDir, opts, cfg, indexer, logger);
}

async function actionSearch(query: string, opts: SearchOptions): Promise<void> {
	const cfg = await loadDocIndexerConfig(opts.config);
	const fullConfig = loadConfig(opts.config);
	const riffPaths = fullConfig['hr-policy'].paths;

	// Create logger with config (override verbose if flag set)
	const logging = cfg.logging;
	const loggerOptions: LoggerOptions = {
		level: logging?.level ?? 'INFO',
		verbose: (opts.verbose || logging?.verbose) ?? false,
		file: logging?.file ?? 'hr-policy.log',
		maxFileSizeMb: logging?.maxFileSizeMb ?? 10,
		maxFiles: logging?.maxFiles ?? 7,
	};
	const logger = createLogger(loggerOptions);

	const dbFile = opts.file || path.resolve(process.cwd(), riffPaths.database.indexer);

	const embeddingConfig = buildEmbeddingConfig();
	const searchIndexerConfig: DocIndexerConfig = {
		embeddingConfig,
		useFts: cfg.useFts,
		hybrid: cfg.hybrid,
		alpha: cfg.alpha,
		snippetContextLines: cfg.snippetContextLines,
		maxSnippetLength: cfg.maxSnippetLength,
	};
	const indexer = new DocIndexerImpl(logger, dbFile, searchIndexerConfig);

	const searchService = new SearchServiceImpl(logger, indexer);

	await executeSearch(query, opts, cfg, logger, indexer, searchService);
}

function createProgram(): Command {
	const program = new Command();
	program.name('hr-policy').description('Aria hr-policy - Document indexing and semantic search').version('2.0.0');

	// Index command
	program
		.command('index')
		.argument('[directory]', 'Directory to index')
		.option('-f, --file <path>', 'SQLite DB file')
		.option('-r, --reset', 'Reset (clear) existing documents')
		.option('-k, --api-key <key>', 'OpenAI API key')
		.option('-c, --config <path>', 'Path to config file')
		.option('-v, --verbose', 'Enable verbose/debug output')
		.option('--model <name>', 'Embedding model')
		.option('--dimensions <n>', 'Embedding dimensions', v => parseInt(v, 10))
		.option('--max-embed-chars <n>', 'Max characters per item for embedding', v => parseInt(v, 10))
		.option('--sections <mode>', 'response|request|both|full')
		.option('--weight-response <x>', 'Bias embeddings toward Response', v => parseFloat(v))
		.action(actionIndex);

	// Search command (outputs via Pino logger; use TUI for rich display)
	program
		.command('search')
		.argument('<query>')
		.option('-f, --file <path>', 'SQLite DB file')
		.option('-k, --api-key <key>', 'OpenAI API key')
		.option('-n, --results <num>', 'Number of results', '5')
		.option('-c, --config <path>', 'Path to config file')
		.option('-v, --verbose', 'Enable verbose/debug output')
		.option('--hybrid', 'Enable hybrid lexical+semantic search via FTS5')
		.option('--no-hybrid', 'Disable hybrid search')
		.option('--alpha <x>', 'Lexical weight when hybrid is on (0..1)')
		.action(actionSearch);

	// Decompose command
	program
		.command('decompose')
		.argument('[file]', 'Markdown file to decompose (single-file mode)')
		.option('-i, --input <dir>', 'Input directory for batch processing (directory mode)')
		.option('-o, --output <dir>', 'Output directory for decomposed sections')
		.option('-c, --config <path>', 'Path to config file')
		.option('--primary-pattern <regex>', 'Regex pattern for primary boundaries (default: ^## .+)')
		.option('--fallback-pattern <regex>', 'Regex pattern for fallback boundaries (default: ^### .+)')
		.option('--dry-run', 'Show what would be done without writing files')
		.option('-v, --verbose', 'Enable verbose/debug output')
		.action(actionDecompose);

	return program;
}

/* c8 ignore start */
if (process.argv[1] === fileURLToPath(import.meta.url)) {
	createProgram().parse(process.argv);
}
/* c8 ignore stop */
