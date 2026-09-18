#!/usr/bin/env bun

/**
 * CLI interface for mindmap-converter
 */

import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import type { Logger } from 'pino';
import packageManifest from '../package.json' with { type: 'json' };
import { convertToBullets } from './converters/convert-bullets.js';
import { convertToHeaders } from './converters/convert-headers.js';
import { convertToLegal } from './converters/convert-legal.js';
import { convertToMermaidMindmap } from './converters/convert-mermaid-mindmap.js';
import { convertToNumbered } from './converters/convert-numbered.js';
import { convertToTree } from './converters/convert-tree.js';
import { appendToJsonl, convertToJsonl, searchJsonl } from './core/convert-jsonl.js';
import { parseMindMap } from './core/parse-mm.js';
import { parseOpml } from './core/parse-opml.js';
import { processBatch, processMindmap, scanDirectory } from './core/process-batch.js';
import { DatabaseManager } from './db/database.js';
import { loadConfig } from './lib/config.js';
import { createLogger } from './lib/logger.js';
import type { ConversionOptions, MindmapConverterConfig, MindmapRecord, OutputFormat } from './lib/types.js';
import { detectFormat, generateOutputPath, getFileStats, readFile, writeFile } from './utils/utils.js';

/**
 * Create and configure the CLI program
 */
function createProgram(): Command {
	// Configuration and logger
	let config: MindmapConverterConfig;
	let logger: Logger;

	const program = new Command();

	program
		.name('mindmap-converter')
		.description(packageManifest.description)
		.version(packageManifest.version)
		.option('-c, --config <path>', 'Path to configuration file')
		.hook('preAction', thisCommand => {
			// Load config before any command runs
			const opts = thisCommand.opts();
			config = loadConfig(opts.config);

			// Initialize logger with config
			logger = createLogger({
				level: config.logging.level,
				verbose: config.logging.verbose,
				file: config.logging.file,
				maxFileSizeMb: config.logging.maxFileSizeMb,
				maxFiles: config.logging.maxFiles,
			});
		});

	program
		.command('convert')
		.description('Convert OPML or FreeMind file to Markdown')
		.argument('<input>', 'Input file path (.opml or .mm)')
		.argument('[output]', 'Output file path (optional, defaults to input name with .md extension)')
		.option('-f, --format <format>', 'Input format (opml or mm), auto-detected if not specified')
		.option('--output-format <format>', 'Output format (headers, bullets, numbered, tree, mermaid-mindmap)')
		.option('-m, --max-heading <level>', 'Maximum heading level (1-6)')
		.option('--no-bullets', 'Disable bullet points after max heading level')
		.option('--no-hierarchy', 'Flatten hierarchy instead of preserving it')
		.option('-v, --verbose', 'Enable verbose output')
		.action(async (input: string, output: string | undefined, options) => {
			try {
				const riff = config['mindmap-converter'];

				// Use config defaults, overridden by CLI options
				const maxHeading = options.maxHeading
					? parseInt(options.maxHeading, 10)
					: riff.conversion.maxHeadingLevel;

				const useBullets =
					options.bullets !== undefined ? options.bullets !== false : riff.conversion.useBulletPoints;

				const preserveHierarchy =
					options.hierarchy !== undefined ? options.hierarchy !== false : riff.conversion.preserveHierarchy;

				const verbose = options.verbose !== undefined ? options.verbose : config.logging.verbose;

				// Recreate logger if verbose mode enabled via CLI flag
				if (options.verbose && !config.logging.verbose) {
					logger = createLogger({
						level: config.logging.level,
						verbose: true,
						file: config.logging.file,
						maxFileSizeMb: config.logging.maxFileSizeMb,
						maxFiles: config.logging.maxFiles,
					});
				}

				const outputFormat: OutputFormat = options.outputFormat || riff.conversion.defaultFormat;

				const conversionOptions: ConversionOptions = {
					inputPath: input,
					outputPath: output || generateOutputPath(input),
					format: options.format,
					outputFormat: outputFormat,
					markdownOptions: {
						maxHeadingLevel: maxHeading,
						useBulletPoints: useBullets,
						preserveHierarchy: preserveHierarchy,
					},
					verbose: verbose,
				};

				await convertFile(conversionOptions);
			} catch (error) {
				logger.error({ error: (error as Error).message }, 'Conversion failed');
				process.exit(1);
			}
		});

	program
		.command('validate')
		.description('Validate OPML or FreeMind file structure')
		.argument('<input>', 'Input file path (.opml or .mm)')
		.action(async (input: string) => {
			try {
				const format = detectFormat(input);
				const content = await readFile(input);

				const isValid =
					format === 'opml'
						? (await import('./core/parse-opml.js')).validateOpml(content)
						: (await import('./core/parse-mm.js')).validateMindMap(content);

				if (isValid) {
					logger.info({ input, format: format.toUpperCase() }, 'File validation successful');
					process.exit(0);
				} else {
					logger.error({ input, format: format.toUpperCase() }, 'File validation failed');
					process.exit(1);
				}
			} catch (error) {
				logger.error({ error: (error as Error).message }, 'Validation error');
				process.exit(1);
			}
		});

	program
		.command('batch')
		.description('Batch convert mindmap files from a directory')
		.argument('<source-dir>', 'Source directory to scan for mindmap files')
		.argument('[output-dir]', 'Output directory (default: .aria/exports/mindmap)')
		.option('--no-preserve-structure', 'Flatten output structure instead of mirroring source')
		.option('-v, --verbose', 'Enable verbose output')
		.action(async (sourceDir: string, outputDir: string | undefined, options) => {
			try {
				const riff = config['mindmap-converter'];

				if (options.verbose && !config.logging.verbose) {
					logger = createLogger({
						level: config.logging.level,
						verbose: true,
						file: config.logging.file,
						maxFileSizeMb: config.logging.maxFileSizeMb,
						maxFiles: config.logging.maxFiles,
					});
				}

				const dbManager = new DatabaseManager(riff.database, riff.paths.database.file);

				logger.info({ sourceDir }, 'Scanning for mindmap files');

				const files = await scanDirectory(sourceDir);

				if (files.length === 0) {
					logger.warn({ sourceDir }, 'No mindmap files found');
					process.exit(0);
				}

				logger.info({ found: files.length }, 'Found mindmap files');

				const output = outputDir || riff.paths.output.dir;

				const result = await processBatch(files, config, dbManager, logger, {
					outputDirectory: output,
					preserveStructure: options.preserveStructure !== false,
				});

				dbManager.close();

				logger.info(result, 'Batch processing complete');
				process.exit(result.failed > 0 ? 1 : 0);
			} catch (error) {
				logger.error({ error: (error as Error).message }, 'Batch processing failed');
				process.exit(1);
			}
		});

	program
		.command('export')
		.description('Convert and export mindmap files to database (no markdown files)')
		.argument('<source-dir>', 'Source directory to scan for mindmap files')
		.option('-v, --verbose', 'Enable verbose output')
		.action(async (sourceDir: string, options) => {
			try {
				const riff = config['mindmap-converter'];

				if (options.verbose && !config.logging.verbose) {
					logger = createLogger({
						level: config.logging.level,
						verbose: true,
						file: config.logging.file,
						maxFileSizeMb: config.logging.maxFileSizeMb,
						maxFiles: config.logging.maxFiles,
					});
				}

				const dbManager = new DatabaseManager(riff.database, riff.paths.database.file);

				logger.info({ sourceDir }, 'Scanning for mindmap files');

				const files = await scanDirectory(sourceDir);

				if (files.length === 0) {
					logger.warn({ sourceDir }, 'No mindmap files found');
					process.exit(0);
				}

				logger.info({ found: files.length }, 'Found mindmap files');

				let completed = 0;
				let failed = 0;

				for (let i = 0; i < files.length; i++) {
					const filePath = files[i];
					if (!filePath) continue;
					try {
						await processMindmap(filePath, config, dbManager, logger, {
							saveToDatabase: true,
						});
						completed++;

						if ((i + 1) % riff.batch.saveInterval === 0) {
							logger.info(
								{ processed: i + 1, total: files.length, completed, failed },
								'Export progress'
							);
						}
					} catch (_error) {
						failed++;
					}
				}

				dbManager.close();

				logger.info({ total: files.length, completed, failed }, 'Export to database complete');
				process.exit(failed > 0 ? 1 : 0);
			} catch (error) {
				logger.error({ error: (error as Error).message }, 'Export failed');
				process.exit(1);
			}
		});

	program
		.command('db-stats')
		.description('Show database statistics')
		.action(async () => {
			try {
				const riff = config['mindmap-converter'];
				const dbManager = new DatabaseManager(riff.database, riff.paths.database.file);
				const stats = await dbManager.getStats();

				logger.info(stats, 'Database statistics');
				logger.info(`Total records: ${stats.total}`);
				logger.info(`Completed: ${stats.completed}`);
				logger.info(`Pending: ${stats.pending}`);
				logger.info(`Failed: ${stats.failed}`);
				logger.info(`OPML files: ${stats.byFormat.opml}`);
				logger.info(`FreeMind files: ${stats.byFormat.mm}`);

				dbManager.close();
			} catch (error) {
				logger.error({ error: (error as Error).message }, 'Failed to get stats');
				process.exit(1);
			}
		});

	program
		.command('db-list')
		.description('List all mindmap records in database')
		.option('-s, --status <status>', 'Filter by status (pending, completed, failed)')
		.option('-f, --format <format>', 'Filter by format (opml, mm)')
		.action(async options => {
			try {
				const riff = config['mindmap-converter'];
				const dbManager = new DatabaseManager(riff.database, riff.paths.database.file);

				let records: MindmapRecord[];

				if (options.status) {
					records = await dbManager.getMindmapsByStatus(options.status);
				} else {
					records = await dbManager.getAllMindmaps();
				}

				if (options.format) {
					records = records.filter(r => r.format === options.format);
				}

				logger.info({ count: records.length }, 'Found records');

				for (const record of records) {
					logger.info(
						{
							id: record.id,
							file: record.file_path,
							title: record.title,
							format: record.format,
							nodes: record.node_count,
							status: record.status,
							converted: record.converted_path,
						},
						'Record'
					);
				}

				dbManager.close();
			} catch (error) {
				logger.error({ error: (error as Error).message }, 'Failed to list records');
				process.exit(1);
			}
		});

	program
		.command('db-search')
		.description('Search mindmap records by title or content')
		.argument('<query>', 'Search query')
		.action(async (query: string) => {
			try {
				const riff = config['mindmap-converter'];
				const dbManager = new DatabaseManager(riff.database, riff.paths.database.file);
				const results = await dbManager.searchMindmaps(query);

				logger.info({ query, count: results.length }, 'Search results');

				for (const record of results) {
					logger.info(
						{
							id: record.id,
							file: record.file_path,
							title: record.title,
							format: record.format,
							nodes: record.node_count,
						},
						'Match'
					);
				}

				dbManager.close();
			} catch (error) {
				logger.error({ error: (error as Error).message }, 'Search failed');
				process.exit(1);
			}
		});

	program
		.command('export-jsonl')
		.description('Export mindmap files to JSONL format (appends to master file)')
		.argument('<source-dir>', 'Source directory to scan for mindmap files')
		.option('-o, --output <file>', 'Output JSONL file (default: .aria/exports/mindmap/mindmaps.jsonl)')
		.option('--no-append', 'Overwrite file instead of appending')
		.option('-v, --verbose', 'Enable verbose output')
		.action(async (sourceDir: string, options) => {
			try {
				const riff = config['mindmap-converter'];

				if (options.verbose && !config.logging.verbose) {
					logger = createLogger({
						level: config.logging.level,
						verbose: true,
						file: config.logging.file,
						maxFileSizeMb: config.logging.maxFileSizeMb,
						maxFiles: config.logging.maxFiles,
					});
				}

				const jsonlFile = options.output || riff.paths.output.master;
				const appendMode = options.append !== false;

				// If not appending, clear the file first
				if (!appendMode) {
					logger.info({ jsonlFile }, 'Overwrite mode: clearing existing file');
					await writeFile(jsonlFile, '');
				}

				logger.info({ sourceDir }, 'Scanning for mindmap files');

				const files = await scanDirectory(sourceDir);

				if (files.length === 0) {
					logger.warn({ sourceDir }, 'No mindmap files found');
					process.exit(0);
				}

				logger.info({ found: files.length, output: jsonlFile, append: appendMode }, 'Exporting to JSONL');

				let exported = 0;
				let failed = 0;

				for (const file of files) {
					try {
						logger.debug({ file }, 'Processing mindmap');

						const content = await readFile(file);
						const format = detectFormat(file);

						const parseResult = format === 'opml' ? parseOpml(content) : parseMindMap(content);

						const title = parseResult.metadata?.title || path.basename(file, path.extname(file));

						const jsonlRecord = convertToJsonl(parseResult.root, file, format, title);

						await appendToJsonl(jsonlFile, jsonlRecord);

						exported++;

						logger.debug({ file, title }, 'Exported to JSONL');

						if ((exported + failed) % riff.batch.saveInterval === 0) {
							logger.info(
								{ processed: exported + failed, total: files.length, exported, failed },
								'Export progress'
							);
						}
					} catch (error) {
						failed++;
						logger.error({ file, error: (error as Error).message }, 'Failed to export');
					}
				}

				logger.info({ total: files.length, exported, failed, output: jsonlFile }, 'JSONL export complete');
				process.exit(failed > 0 ? 1 : 0);
			} catch (error) {
				logger.error({ error: (error as Error).message }, 'JSONL export failed');
				process.exit(1);
			}
		});

	program
		.command('jsonl-search')
		.description('Search mindmaps in JSONL file')
		.argument('<query>', 'Search query')
		.option('-f, --file <file>', 'JSONL file to search (default: .aria/exports/mindmap/mindmaps.jsonl)')
		.action(async (query: string, options) => {
			try {
				const riff = config['mindmap-converter'];
				const jsonlFile = options.file || riff.paths.output.master;

				logger.info({ query, file: jsonlFile }, 'Searching JSONL');

				const results = await searchJsonl(jsonlFile, query);

				logger.info({ query, count: results.length }, 'Search results');

				for (const record of results) {
					logger.info(
						{
							file: record.file_path,
							title: record.title,
							format: record.format,
							nodes: record.node_count,
							exported: record.exported_at,
						},
						'Match'
					);
				}
			} catch (error) {
				logger.error({ error: (error as Error).message }, 'JSONL search failed');
				process.exit(1);
			}
		});

	/**
	 * Main conversion function
	 */
	async function convertFile(options: ConversionOptions): Promise<void> {
		const { inputPath, outputPath, format, outputFormat, markdownOptions, formatOptions } = options;

		logger.debug({ inputPath }, 'Reading input file');

		const content = await readFile(inputPath);
		const detectedFormat = format || detectFormat(inputPath);

		logger.debug({ format: detectedFormat.toUpperCase() }, 'Detected format');
		logger.debug('Parsing mindmap structure');

		const parseResult = detectedFormat === 'opml' ? parseOpml(content) : parseMindMap(content);

		if (parseResult.metadata?.title) {
			logger.debug({ title: parseResult.metadata.title }, 'Found mindmap title');
		}

		const selectedOutputFormat = outputFormat || 'headers';
		logger.debug({ outputFormat: selectedOutputFormat }, 'Converting to output format');

		let markdown: string;

		switch (selectedOutputFormat) {
			case 'bullets':
				markdown = convertToBullets(parseResult.root);
				break;
			case 'numbered':
				markdown = convertToNumbered(parseResult.root);
				break;
			case 'legal':
				markdown = convertToLegal(parseResult.root);
				break;
			case 'tree':
				markdown = convertToTree(parseResult.root, formatOptions);
				break;
			case 'mermaid-mindmap':
				markdown = convertToMermaidMindmap(parseResult.root, formatOptions);
				break;
			default:
				markdown = convertToHeaders(parseResult.root, markdownOptions);
				break;
		}

		logger.debug({ outputPath }, 'Writing output file');

		await writeFile(outputPath, markdown);

		const stats = await getFileStats(outputPath);

		logger.info(
			{
				input: inputPath,
				output: outputPath,
				size: stats.sizeFormatted,
				format: detectedFormat.toUpperCase(),
				outputFormat: selectedOutputFormat,
			},
			'Conversion completed successfully'
		);
	}

	program
		.command('list-formats')
		.description('List all available output formats')
		.action(() => {
			const formats = [
				{
					name: 'headers',
					description: 'Nested Markdown headers (h1-h6) - Default',
					useCase: 'Formal documentation, knowledge bases, technical specifications',
				},
				{
					name: 'bullets',
					description: 'Mixed format: numbered top-level, bullets for sub-items',
					useCase: 'Quick references, checklists, mindmaps, notes',
				},
				{
					name: 'numbered',
					description: 'Nested numbered lists with proper ordered list syntax',
					useCase: 'Procedures, step-by-step guides, sequential content',
				},
				{
					name: 'legal',
					description: 'Hierarchical numbering (1, 1.1, 1.1.1) for formal documents',
					useCase: 'Legal documents, formal specifications, technical standards',
				},
				{
					name: 'tree',
					description: 'Unix tree command style visualization',
					useCase: 'README files, visual hierarchy, developer documentation',
				},
				{
					name: 'mermaid-mindmap',
					description: 'Interactive Mermaid mindmap diagram',
					useCase: 'Interactive documentation, web-based docs, GitHub README',
				},
			];

			logger.info('Available output formats:');
			logger.info('');

			for (const format of formats) {
				logger.info(`  ${format.name}`);
				logger.info(`    Description: ${format.description}`);
				logger.info(`    Use cases: ${format.useCase}`);
				logger.info('');
			}

			logger.info('Usage: bun riffs/mindmap-converter/src/cli.ts convert <input> --output-format <format>');
		});

	return program;
}

/* c8 ignore start */
if (process.argv[1] === fileURLToPath(import.meta.url)) {
	createProgram().parse(process.argv);
}
/* c8 ignore stop */
