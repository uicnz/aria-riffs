#!/usr/bin/env bun
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import type { Logger } from 'pino';
import { buildOrgTree, countEmployees, getTreeDepth } from './core/build-tree.js';
import { decompose } from './core/decompose.js';
import { type EmbeddingProvider, indexSections } from './core/indexer.js';
import { parseCSV } from './core/parse-csv.js';
import { fullSanitization } from './core/sanitize-data.js';
import { search } from './core/search.js';
import { cleanQuery } from './core/stop-words.js';
import { validateEmails, validateEmployees } from './core/validate-employees.js';
import { HrStafferDatabase } from './db/database.js';
import { formatAsMarkdown } from './formatters/format-markdown.js';
import { formatAsMermaid, generateIndividualTeamFiles } from './formatters/format-mermaid.js';
import { formatAsText } from './formatters/format-text.js';
import { loadConfig } from './lib/config.js';
import { createLogger } from './lib/logger.js';
import type { DecomposerConfig, ScoringWeights, SearchResult } from './lib/types.js';
import { createEmbeddingService } from './providers/embedding-client.js';

/**
 * Generate organizational chart from CSV file with formatting and optional database storage.
 * Orchestrates the full pipeline: load config, parse, sanitize, validate, build tree, format, and save.
 *
 * @param csvFile - Optional path to CSV file (overrides config if provided)
 * @param options - CLI options that may override config values
 * @param logger - Pino logger instance
 * @throws Error if config loading, validation, or file operations fail
 */
export function generateOrgChart(
	csvFile: string | undefined,
	options: {
		title?: boolean;
		department?: boolean;
		includeEmail?: boolean;
		maxDepth?: number;
		output?: string;
		textOnly?: boolean;
		markdownOnly?: boolean;
		mermaidOnly?: boolean;
		config?: string;
	},
	logger: Logger
): void {
	// Load configuration (with optional custom path)
	const config = loadConfig(options.config);
	const riff = config['hr-staffer'];

	// Use CLI argument or config value for CSV file
	const inputCsvFile = csvFile || riff.paths.input.staff;
	logger.info({ inputFile: inputCsvFile }, 'Starting organizational chart generation');

	// Parse the CSV file
	let employees = parseCSV(inputCsvFile);
	logger.info({ employeeCount: employees.length }, 'Loaded employees from CSV');

	// Sanitize employee data
	logger.debug({}, 'Sanitizing employee data');
	employees = fullSanitization(employees);
	logger.info({}, 'Data sanitization complete');

	// Validate employee data
	logger.debug({}, 'Validating employee data');
	const structureValidation = validateEmployees(employees);
	const emailValidation = validateEmails(employees);

	// Log validation errors
	if (structureValidation.errors.length > 0 || emailValidation.errors.length > 0) {
		const allErrors = [...structureValidation.errors, ...emailValidation.errors];
		for (const error of allErrors) {
			logger.error({ validationError: error }, 'Validation error');
		}
	}

	// Log validation warnings
	if (structureValidation.warnings.length > 0 || emailValidation.warnings.length > 0) {
		const allWarnings = [...structureValidation.warnings, ...emailValidation.warnings];
		for (const warning of allWarnings) {
			logger.warn({ validationWarning: warning }, 'Validation warning');
		}
	}

	// Stop if validation failed
	if (!structureValidation.valid || !emailValidation.valid) {
		logger.error({}, 'Validation failed - please fix errors before generating org chart');
		process.exit(1);
	}

	logger.info({}, 'Validation passed');

	// Build the organizational tree
	const orgTree = buildOrgTree(employees);
	const depth = getTreeDepth(orgTree);
	const totalCount = countEmployees(orgTree);

	logger.info({ treeDepth: depth, totalEmployees: totalCount }, 'Organizational tree built');

	// Format options: CLI flags override config
	const formatOptions = {
		includeTitle: options.title !== undefined ? options.title : riff.display.includeTitle,
		includeDepartment: options.department !== undefined ? options.department : riff.display.includeDepartment,
		includeEmail: options.includeEmail || riff.display.includeEmail,
		maxDepth: options.maxDepth || riff.display.maxDepth || Infinity,
	};

	logger.debug({ formatOptions }, 'Format options resolved');

	const outputDir = options.output || riff.paths.output.chart;

	// Ensure output directory exists
	if (!existsSync(outputDir)) {
		mkdirSync(outputDir, { recursive: true });
		logger.debug({ outputDir }, 'Created output directory');
	}

	// Determine which formats to generate (CLI flags override config)
	const generateText =
		options.textOnly || (!options.markdownOnly && !options.mermaidOnly && riff.output.formats.text);
	const generateMarkdown =
		options.markdownOnly || (!options.textOnly && !options.mermaidOnly && riff.output.formats.markdown);
	const generateMermaid =
		options.mermaidOnly || (!options.textOnly && !options.markdownOnly && riff.output.formats.mermaid);

	if (generateText) {
		const textOutput = formatAsText(orgTree, formatOptions);
		const filePath = `${outputDir}/org-chart.txt`;
		writeFileSync(filePath, textOutput);
		logger.info({ file: filePath }, 'Generated text output');
	}

	// Get breakdown teams config for both markdown and mermaid
	const breakDownTeams = riff.mermaid.breakDownTeams || [];

	if (generateMarkdown) {
		const markdownOutput = formatAsMarkdown(orgTree, formatOptions, breakDownTeams);
		const filePath = `${outputDir}/org-chart.md`;
		writeFileSync(filePath, markdownOutput);
		logger.info({ file: filePath }, 'Generated markdown output');
	}

	if (generateMermaid) {
		// Generate the combined mermaid file with markdown wrappers
		const mermaidOutput = formatAsMermaid(orgTree, formatOptions, breakDownTeams);
		const filePath = `${outputDir}/org-chart.mermaid`;
		writeFileSync(filePath, mermaidOutput);
		logger.info({ file: filePath }, 'Generated mermaid output');

		// Generate individual team mermaid files (pure syntax, no markdown)
		const teamFiles = generateIndividualTeamFiles(orgTree, formatOptions, breakDownTeams);
		for (const [filename, content] of teamFiles) {
			const teamFilePath = `${outputDir}/${filename}`;
			writeFileSync(teamFilePath, content);
			logger.info({ file: teamFilePath }, 'Generated team mermaid file');
		}
	}

	logger.info({ outputDir }, 'All outputs generated successfully');

	// Save to database if enabled
	if (riff.database?.enabled) {
		const dbPath = riff.paths.database.file;
		logger.info({ dbPath }, 'Saving to database');

		const db = new HrStafferDatabase(dbPath);

		try {
			db.initialize();
			db.upsertEmployees(employees);
			db.recordImport(inputCsvFile, employees.length, depth);
			logger.info({ dbPath, employeeCount: employees.length }, 'Database updated successfully');
		} finally {
			db.close();
		}
	}
}

/**
 * Decompose a markdown file into individual sections with YAML frontmatter.
 *
 * @param options - CLI options (inputFile, outputDir, dryRun, headerPattern, logger)
 */
export function runDecompose(options: {
	inputFile?: string;
	outputDir?: string;
	dryRun?: boolean;
	headerPattern?: string;
	logger: Logger;
}): void {
	const { logger } = options;

	logger.info({ command: 'decompose' }, 'Starting decompose command');

	// Load config file for defaults
	const config = loadConfig();
	const riff = config['hr-staffer'];

	const decomposerConfig: DecomposerConfig = {
		input_file: options.inputFile || riff.paths.input.chart,
		output_directory: options.outputDir || riff.paths.output.sections,
		header_pattern: options.headerPattern || riff.decomposer?.headerPattern || '^#{1,6} .+',
	};

	logger.debug(
		{
			inputFile: decomposerConfig.input_file,
			outputDirectory: decomposerConfig.output_directory,
			headerPattern: decomposerConfig.header_pattern,
			dryRun: options.dryRun || false,
		},
		'Decompose configuration'
	);

	if (options.dryRun) {
		logger.info({}, 'Dry run mode - no files will be written');
	}

	logger.info({ inputFile: decomposerConfig.input_file }, 'Starting decomposition');
	const result = decompose(decomposerConfig, options.dryRun || false);

	logger.info(
		{
			sectionCount: result.sectionCount,
			fileCount: result.files.length,
			dryRun: options.dryRun || false,
		},
		'Decomposition complete'
	);

	for (const file of result.files) {
		if (options.dryRun) {
			logger.info({ file }, 'Would write file (dry run)');
		} else {
			logger.info({ file }, 'File written');
		}
	}

	logger.info({ command: 'decompose' }, 'Decompose command completed');
}

/**
 * Index decomposed sections into the database with embeddings.
 *
 * @param options - Index options (sectionsDir, dbPath, embeddingService, logger, reset)
 */
export async function runIndex(options: {
	sectionsDir: string;
	dbPath: string;
	embeddingService: EmbeddingProvider;
	logger: Logger;
	reset?: boolean;
}): Promise<void> {
	const { sectionsDir, dbPath, embeddingService, logger, reset = false } = options;

	logger.info({ sectionsDir, dbPath, reset }, 'Starting section indexing');

	if (reset) {
		logger.info({}, 'Reset mode - clearing existing documents');
	}

	logger.debug({ sectionsDir, dbPath }, 'Initializing database');

	// Initialize database
	const db = new HrStafferDatabase(dbPath);
	db.initialize();
	db.initDocumentTables({ useFts: true });

	try {
		logger.info({ sectionsDir, reset }, 'Starting indexing');

		// Index sections
		const result = await indexSections({
			sectionsDir,
			db,
			embeddingService,
			logger,
			reset,
		});

		logger.info({ documentCount: result.documentCount }, 'Indexing complete');
	} finally {
		db.close();
	}
}

/**
 * Search indexed documents for matching content.
 *
 * @param options - Search options (query, dbPath, embeddingService, nResults, hybrid, weights, fieldWeights, logger)
 */
export async function runSearch(options: {
	query: string;
	dbPath: string;
	embeddingService: EmbeddingProvider;
	nResults?: number;
	hybrid?: boolean;
	weights?: ScoringWeights;
	fieldWeights?: { department: number; title: number; manager: number; location: number };
	logger?: Logger;
}): Promise<SearchResult[]> {
	const { query, dbPath, embeddingService, nResults = 5, hybrid = true, weights, fieldWeights, logger } = options;

	logger?.debug({ query, dbPath }, 'Initializing database for search');

	// Initialize database
	const db = new HrStafferDatabase(dbPath);
	db.initialize();
	db.initDocumentTables({ useFts: true });

	try {
		logger?.debug({ query, hybrid, nResults }, 'Executing search');

		// Run search (search.ts provides defaults for weights/fieldWeights when omitted)
		const results = await search({
			query,
			db,
			embeddingService,
			options: { hybrid, nResults, weights, fieldWeights },
		});

		logger?.debug({ resultCount: results.length }, 'Search returned results');
		return results;
	} finally {
		db.close();
	}
}

/**
 * Initialize logger with config and CLI verbose flag override
 */
function initLogger(configPath?: string, verbose?: boolean): Logger {
	const config = loadConfig(configPath);

	return createLogger({
		level: config.logging.level,
		verbose: verbose || config.logging.verbose,
		file: config.logging.file,
		maxFileSizeMb: config.logging.maxFileSizeMb,
		maxFiles: config.logging.maxFiles,
	});
}

export function createProgram(): Command {
	const program = new Command();

	program
		.name('hr-staffer')
		.description('Generate organizational charts from staff directory CSV files')
		.version('1.0.0');

	// Generate command (default action for backward compatibility)
	program
		.command('generate', { isDefault: true })
		.description('Generate organizational chart from CSV file')
		.argument('[csv-file]', 'Path to CSV file containing staff directory (overrides config)')
		.option('-c, --config <path>', 'Path to config file')
		.option('-o, --output <directory>', 'Output directory for generated files (overrides config)')
		.option('--text-only', 'Generate only text output')
		.option('--markdown-only', 'Generate only markdown output')
		.option('--mermaid-only', 'Generate only mermaid diagram')
		.option('--no-title', 'Exclude job titles from output (overrides config)')
		.option('--no-department', 'Exclude departments from output (overrides config)')
		.option('--include-email', 'Include email addresses in output (overrides config)')
		.option('--max-depth <levels>', 'Maximum tree depth to display (overrides config)', parseInt)
		.option('-v, --verbose', 'Enable verbose (debug) logging')
		.action((csvFile, options) => {
			const logger = initLogger(options.config, options.verbose);
			try {
				generateOrgChart(csvFile, options, logger);
			} catch (error) {
				logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Command failed');
				process.exit(1);
			}
		});

	// Decompose command
	program
		.command('decompose')
		.description('Decompose a markdown file into individual sections with YAML frontmatter')
		.option('-c, --config <path>', 'Path to config file')
		.option('--input <file>', 'Path to input markdown file (default: from config)')
		.option('--output <dir>', 'Directory to write decomposed section files (default: from config)')
		.option('--dry-run', 'Show what would be done without writing files')
		.option('--header-pattern <pattern>', 'Regex pattern to match headers (default: from config)')
		.option('-v, --verbose', 'Enable verbose (debug) logging')
		.action(options => {
			const logger = initLogger(options.config, options.verbose);
			try {
				runDecompose({
					inputFile: options.input,
					outputDir: options.output,
					dryRun: options.dryRun,
					headerPattern: options.headerPattern,
					logger,
				});
			} catch (error) {
				logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Command failed');
				process.exit(1);
			}
		});

	// Index command
	program
		.command('index')
		.description('Index decomposed sections into database with embeddings for semantic search')
		.option('-c, --config <path>', 'Path to config file')
		.option('--sections-dir <dir>', 'Directory containing decomposed section files (default: from config)')
		.option('--reset', 'Clear existing documents before indexing')
		.option('-v, --verbose', 'Enable verbose (debug) logging')
		.action(async options => {
			const logger = initLogger(options.config, options.verbose);
			try {
				// Load config for defaults
				const config = loadConfig(options.config);
				const riff = config['hr-staffer'];
				const embeddingsConfig = riff.embeddings;

				logger.info({ command: 'index' }, 'Starting index command');

				if (!embeddingsConfig) {
					throw new Error('Embeddings not configured. Add embeddings section to config.');
				}

				const sectionsDir = options.sectionsDir || riff.paths.input.sections;
				const dbPath = riff.paths.database.file;
				const embeddingService = createEmbeddingService(embeddingsConfig);

				logger.debug({ sectionsDir, dbPath, reset: options.reset }, 'Index configuration');

				await runIndex({
					sectionsDir,
					dbPath,
					embeddingService,
					reset: options.reset,
					logger,
				});

				logger.info({ command: 'index' }, 'Index command completed');
			} catch (error) {
				logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Command failed');
				process.exit(1);
			}
		});

	// Search command - outputs JSON only; use TUI for rich display
	program
		.command('search')
		.description('Search indexed documents (outputs JSON; use "tui" command for rich display)')
		.argument('<query>', 'Search query text')
		.option('-c, --config <path>', 'Path to config file')
		.option('-n, --results <count>', 'Number of results to return', '5')
		.option('--hybrid', 'Enable hybrid search (semantic + lexical)')
		.option('--no-hybrid', 'Disable hybrid search (semantic only)')
		.option('-v, --verbose', 'Enable verbose (debug) logging')
		.action(async (query, options) => {
			const logger = initLogger(options.config, options.verbose);
			try {
				// Load config for defaults
				const config = loadConfig(options.config);
				const riff = config['hr-staffer'];
				const searchConfig = riff.search;
				const embeddingsConfig = riff.embeddings;

				logger.info({ command: 'search', query }, 'Starting search command');

				if (!embeddingsConfig) {
					throw new Error('Embeddings not configured. Add embeddings section to config.');
				}

				const dbPath = riff.paths.database.file;
				const embeddingService = createEmbeddingService(embeddingsConfig);

				const hybrid = options.hybrid ?? searchConfig?.hybrid ?? true;
				const weights = searchConfig?.weights;
				const fieldWeights = searchConfig?.fieldWeights;
				const nResults = parseInt(options.results, 10) || searchConfig?.defaultResults || 5;

				logger.debug({ query, hybrid, nResults }, 'Search configuration');

				const results = await runSearch({
					query,
					dbPath,
					embeddingService,
					nResults,
					hybrid,
					weights,
					fieldWeights,
					logger,
				});

				// Log each result with all scoring component breakdowns
				for (let i = 0; i < results.length; i++) {
					const result = results[i];
					const meta = result.metadata;
					logger.info(
						{
							rank: i + 1,
							id: result.id,
							score: `${(result.score * 100).toFixed(1)}%`,
							titleMatch: `${(result.title_score * 100).toFixed(1)}%`,
							nameMatch: `${(result.name_score * 100).toFixed(1)}%`,
							sem: `${(result.sem_score * 100).toFixed(1)}%`,
							lex: `${(result.lex_score * 100).toFixed(1)}%`,
							field: `${(result.field_score * 100).toFixed(1)}%`,
							jobTitle: meta['job_title'] || null,
							department: meta['department'] || null,
							manager: meta['manager'] || null,
							city: meta['city'] || null,
							sectionFile: meta['relative_path'] || null,
							sourcePath: meta['source_path'] || null,
						},
						'Search result'
					);
				}

				logger.info(
					{
						resultCount: results.length,
						originalQuery: query,
						cleanedQuery: cleanQuery(query),
						hybrid,
					},
					'Search completed'
				);
			} catch (error) {
				logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Command failed');
				process.exit(1);
			}
		});

	return program;
}

// We have a test that exercises this code, but the code coverage riff doesn't detect it because it is run in a separate process.
/* c8 ignore start */
if (process.argv[1] === fileURLToPath(import.meta.url)) {
	createProgram().parse(process.argv);
}
/* c8 ignore stop */
