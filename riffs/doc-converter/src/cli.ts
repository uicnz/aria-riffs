#!/usr/bin/env bun
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import type { Logger } from 'pino';
import { buildOptions, loadConfig } from './lib/config.js';
import { createLogger } from './lib/logger.js';
import type { DocType, ProcessOptions } from './lib/types.js';
import { processDocxInput } from './processors/docx/process-docx.js';
import { RULES } from './rules/index.js';

/**
 * Initialize logger with config and CLI verbose flag override
 */
function initLogger(config: ReturnType<typeof loadConfig>, verbose: boolean): Logger {
	const loggingConfig = config.logging;
	return createLogger({
		level: loggingConfig.level,
		verbose: verbose || loggingConfig.verbose,
		file: loggingConfig.file,
		maxFileSizeMb: loggingConfig.maxFileSizeMb,
		maxFiles: loggingConfig.maxFiles,
	});
}

/**
 * Create and configure the CLI program
 */
function createProgram(): Command {
	const program = new Command();

	program.name('doc-converter').description('Convert Office documents to Markdown').version('1.0.0');

	program
		.argument('[input]', 'Input file or directory')
		.argument('[output]', 'Output directory (optional, uses config default if not provided)')
		.option('--type <type>', 'Document type (docx/pptx/xlsx/auto)', 'auto')
		.option('--clean-first', 'Clean document before conversion')
		.option('--config <path>', 'Path to configuration file')
		.option('--lint', 'Apply markdownlint after conversion')
		.option('--lint-fix', 'Auto-fix markdownlint issues')
		.option('--lint-config <path>', 'Path to .markdownlintrc')
		.option('--in-place', 'Export next to source document (single files only)')
		.option('--dirs-recurse', 'Traverse subdirectories recursively')
		.option('--dirs-preserve', 'Preserve source directory hierarchy in output')
		.option('--dirs-sanitize, --dirs-sanitise', 'Sanitize directory names in preserved paths (kebab-case)')
		.option('--no-gitkeep', 'Disable .gitkeep file generation in intermediate directories')
		.option('-v, --verbose', 'Enable verbose logging output')
		.action(async (input: string | undefined, output: string | undefined, options: Record<string, unknown>) => {
			// Load config from default location or explicit path; CLI wins
			const config = loadConfig(options.config as string | undefined);
			const verbose = options.verbose === true;
			const logger = initLogger(config, verbose);
			logger.debug({ configPath: options.config, verbose }, 'Logger initialized');

			// Show help if no input provided
			if (!input) {
				logger.info({ version: '1.0.0' }, 'Aria Doc Converter');
				logger.info('Convert Office documents to Markdown with 18 ariaRules');
				program.help();
				return;
			}

			const riffConfig = config['doc-converter'];
			const fromConfig: Partial<ProcessOptions> = {
				type: riffConfig.type,
				cleanFirst: riffConfig.cleanFirst,
				lint: config.markdownlint.enabled,
				lintFix: config.markdownlint.fix,
				lintConfigPath: config.markdownlint.configPath,
				inPlace: riffConfig.inPlace,
				dirsRecurse: riffConfig.dirsRecurse,
				dirsPreserve: riffConfig.dirsPreserve,
				dirsSanitize: riffConfig.dirsSanitize,
				gitkeep: riffConfig.gitkeep,
			};
			const cliPartial: Partial<ProcessOptions> = {};

			// Only set CLI options if they were explicitly provided
			if (options.type !== undefined) cliPartial.type = options.type as DocType;
			if (options.cleanFirst) cliPartial.cleanFirst = true;
			if (options.config) cliPartial.configPath = options.config as string;
			if (options.lint) cliPartial.lint = true;
			if (options.lintFix) cliPartial.lintFix = true;
			if (options.lintConfig) cliPartial.lintConfigPath = options.lintConfig as string;
			if (options.inPlace) cliPartial.inPlace = true;
			if (options.dirsRecurse) cliPartial.dirsRecurse = true;
			if (options.dirsPreserve) cliPartial.dirsPreserve = true;
			if (options.dirsSanitize) cliPartial.dirsSanitize = true;
			if (options.gitkeep === false) cliPartial.gitkeep = false; // --no-gitkeep

			const opt: ProcessOptions = buildOptions({ ...fromConfig, ...cliPartial });

			const inputPath = path.resolve(process.cwd(), input);

			// Validation: --in-place and output argument are mutually exclusive
			if (opt.inPlace && output) {
				logger.error('Cannot use --in-place with an output directory argument');
				process.exit(1);
			}

			// Validation: --dirs-preserve requires --dirs-recurse
			if (opt.dirsPreserve && !opt.dirsRecurse) {
				logger.error('--dirs-preserve requires --dirs-recurse to be enabled');
				process.exit(1);
			}

			// Validation: --dirs-sanitize requires --dirs-preserve
			if (opt.dirsSanitize && !opt.dirsPreserve) {
				logger.error('--dirs-sanitize requires --dirs-preserve to be enabled');
				process.exit(1);
			}

			// Determine output path
			let outputPath: string;
			if (opt.inPlace) {
				// For --in-place, we'll derive output from input location later
				// Set a placeholder for now; processDocxInput will handle it
				outputPath = '';
			} else if (output) {
				outputPath = path.resolve(process.cwd(), output);
			} else if (riffConfig.paths.output.dir) {
				outputPath = path.resolve(process.cwd(), riffConfig.paths.output.dir);
			} else {
				logger.error(
					'No output directory specified. Provide an output argument or set paths.output.dir in config file.'
				);
				process.exit(1);
			}

			if (!fs.existsSync(inputPath)) {
				logger.error({ inputPath }, 'Input path not found');
				process.exit(1);
			}

			// Validation: --in-place only works with single files
			if (opt.inPlace) {
				const stat = fs.statSync(inputPath);
				if (stat.isDirectory()) {
					logger.error('--in-place only works with single files, not directories');
					process.exit(1);
				}
			}

			if (outputPath && !fs.existsSync(outputPath)) {
				fs.mkdirSync(outputPath, { recursive: true });
			}

			if (opt.type === 'auto') {
				const stat = fs.statSync(inputPath);
				if (stat.isDirectory()) {
					// For recursive mode, search deeply for files
					const findFiles = (dir: string): string[] => {
						const entries = fs.readdirSync(dir, { withFileTypes: true });
						let files: string[] = [];
						for (const entry of entries) {
							if (entry.isDirectory() && opt.dirsRecurse) {
								files = files.concat(findFiles(path.join(dir, entry.name)));
							} else if (entry.isFile()) {
								files.push(entry.name);
							}
						}
						return files;
					};

					const files = findFiles(inputPath);
					if (files.some(f => f.toLowerCase().endsWith('.docx'))) opt.type = 'docx';
					else if (files.some(f => f.toLowerCase().endsWith('.pptx'))) opt.type = 'pptx';
					else if (files.some(f => f.toLowerCase().endsWith('.xlsx'))) opt.type = 'xlsx';
					else {
						logger.error({ inputPath }, 'Could not auto-detect document type for directory');
						process.exit(1);
					}
				} else {
					const ext = path.extname(inputPath).toLowerCase();
					if (ext === '.docx') opt.type = 'docx';
					else if (ext === '.pptx') opt.type = 'pptx';
					else if (ext === '.xlsx') opt.type = 'xlsx';
					else {
						logger.error({ inputPath }, 'Could not auto-detect document type for file');
						process.exit(1);
					}
				}
			}

			// Build enabled rule set from config (defaults to all)
			let enabledRuleSet: Set<string> | undefined;
			{
				const all = new Set(Object.keys(RULES));
				if (!config.ariaRules.enabled) {
					enabledRuleSet = new Set();
				} else if (config.ariaRules.rules) {
					enabledRuleSet = new Set(all);
					for (const [code, enabled] of Object.entries(config.ariaRules.rules)) {
						const key = code.toUpperCase();
						if (!all.has(key)) continue;
						if (!enabled) enabledRuleSet.delete(key);
						else enabledRuleSet.add(key);
					}
				}
			}

			// Build MD rules config
			let markdownlintRulesConfig: Record<string, boolean> | undefined;
			if (config.markdownlintRules.enabled && config.markdownlintRules.rules) {
				markdownlintRulesConfig = {};
				for (const [code, enabled] of Object.entries(config.markdownlintRules.rules)) {
					if (typeof enabled === 'boolean') {
						markdownlintRulesConfig[code.toUpperCase()] = enabled;
					}
				}
			}

			if (opt.type === 'docx') {
				logger.info({ inputPath, outputPath, type: opt.type }, 'Starting DOCX conversion');
				const result = await processDocxInput(
					inputPath,
					outputPath,
					opt,
					logger,
					enabledRuleSet,
					markdownlintRulesConfig
				);
				if (result.ok) {
					logger.info({ inputPath, outputPath }, 'Conversion completed successfully');
				} else {
					logger.error({ inputPath, message: result.message, code: result.code }, 'Conversion failed');
				}
				process.exit(result.ok ? 0 : (result.code ?? 1));
			}

			if (opt.type === 'pptx') {
				logger.error('PowerPoint (PPTX) conversion is not yet implemented');
				process.exit(2);
			}
			if (opt.type === 'xlsx') {
				logger.error('Excel (XLSX) conversion is not yet implemented');
				process.exit(2);
			}
		});

	return program;
}

/* c8 ignore start */
if (process.argv[1] === fileURLToPath(import.meta.url)) {
	createProgram().parse();
}
/* c8 ignore stop */
