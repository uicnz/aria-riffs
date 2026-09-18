import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { Logger } from 'pino';
import { applyMarkdownlint } from '../../core/apply-lint.js';
import { applyAllRules } from '../../core/apply-rules.js';
import { processHtml } from '../../core/process-html.js';
import type { ProcessOptions, Result } from '../../lib/types.js';
import { cleanTempFiles } from '../../utils/clean-temp.js';
import { moveAndRenameMediaFiles } from '../../utils/extract-media.js';
import { cleanDocx } from './clean-docx.js';
import { convertDocxToHtml, convertHtmlToMarkdown } from './convert-docx.js';

function checkPandoc(): boolean {
	const r = spawnSync('pandoc', ['--version'], { encoding: 'utf8' });
	return r.status === 0;
}

/**
 * Sanitize filename to be safe and lowercase
 * - Convert to lowercase
 * - Replace spaces and unsafe chars with hyphens
 * - Remove consecutive hyphens
 * - Trim leading/trailing hyphens
 */
function sanitizeFilename(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '');
}

/**
 * Add .gitkeep files to intermediate directories (directories containing only subdirectories, no files)
 * This improves Git tracking and VS Code/GitHub display
 */
function addGitkeepToIntermediateDirs(rootDir: string): void {
	const processDirectory = (dir: string): boolean => {
		const entries = fs.readdirSync(dir, { withFileTypes: true });

		let hasFiles = false;
		let hasSubdirs = false;

		for (const entry of entries) {
			const fullPath = path.join(dir, entry.name);

			if (entry.isDirectory()) {
				hasSubdirs = true;
				// Recurse into subdirectory
				processDirectory(fullPath);
			} else if (entry.isFile() && entry.name !== '.gitkeep') {
				hasFiles = true;
			}
		}

		// If directory has subdirectories but no files (except .gitkeep), add .gitkeep
		if (hasSubdirs && !hasFiles) {
			const gitkeepPath = path.join(dir, '.gitkeep');
			if (!fs.existsSync(gitkeepPath)) {
				fs.writeFileSync(gitkeepPath, '', 'utf8');
			}
		}

		return hasFiles || hasSubdirs;
	};

	processDirectory(rootDir);
}

export async function processDocxInput(
	inputPath: string,
	outputPath: string,
	options: ProcessOptions,
	logger: Logger,
	enabledRuleSet?: Set<string>,
	markdownlintRulesConfig?: Record<string, boolean>
): Promise<Result> {
	if (!checkPandoc()) {
		logger.error('Pandoc not found on PATH');
		return {
			ok: false,
			code: 1,
			message: 'Pandoc not found. Please install pandoc and ensure it is on your PATH.',
		};
	}

	const stat = fs.statSync(inputPath);
	if (stat.isDirectory()) {
		// Directory processing with recursion options
		logger.info(
			{ inputPath, dirsRecurse: options.dirsRecurse, dirsPreserve: options.dirsPreserve },
			'Processing directory'
		);
		let result: Result;
		if (options.dirsRecurse && options.dirsPreserve) {
			result = await processDocxDirectoryRecursive(
				inputPath,
				outputPath,
				options,
				logger,
				enabledRuleSet,
				markdownlintRulesConfig
			);
		} else if (options.dirsRecurse) {
			result = await processDocxDirectoryRecursiveFlat(
				inputPath,
				outputPath,
				options,
				logger,
				enabledRuleSet,
				markdownlintRulesConfig
			);
		} else {
			result = await processDocxDirectory(
				inputPath,
				outputPath,
				options,
				logger,
				enabledRuleSet,
				markdownlintRulesConfig
			);
		}

		// Add .gitkeep files to intermediate directories after all conversions complete
		if (result.ok && options.gitkeep) {
			addGitkeepToIntermediateDirs(outputPath);
		}

		return result;
	}

	// Single file processing
	const docxBasename = path.basename(inputPath, path.extname(inputPath));
	const sanitizedName = sanitizeFilename(docxBasename);

	// Handle --in-place: output next to source file
	let fileOutputDir: string;
	if (options.inPlace) {
		const inputDir = path.dirname(inputPath);
		fileOutputDir = path.join(inputDir, sanitizedName);
	} else {
		fileOutputDir = path.join(outputPath, sanitizedName);
	}

	return processDocxFile(inputPath, fileOutputDir, options, logger, enabledRuleSet, markdownlintRulesConfig);
}

function* counter(start = 1): Generator<number, never, unknown> {
	let i = start;
	while (true) yield i++;
}

export async function processDocxFile(
	docxFile: string,
	outputDir: string,
	options: ProcessOptions,
	logger: Logger,
	enabledRuleSet?: Set<string>,
	markdownlintRulesConfig?: Record<string, boolean>
): Promise<Result> {
	try {
		logger.info({ docxFile, outputDir }, 'Processing file');
		fs.mkdirSync(outputDir, { recursive: true });
		const docxBasename = path.basename(docxFile, path.extname(docxFile));
		const sanitizedBasename = sanitizeFilename(docxBasename);
		const mdOutput = path.join(outputDir, `${sanitizedBasename}.md`);
		const htmlOutput = path.join(outputDir, `${sanitizedBasename}.html`);
		const tempProcessedHtmlPath = path.join(outputDir, `${sanitizedBasename}_processed.html`);

		let currentInput = docxFile;
		let cleanedDocxPath: string | undefined;
		if (options.cleanFirst) {
			logger.debug({ docxFile }, 'Cleaning document before conversion');
			cleanedDocxPath = path.join(outputDir, `${sanitizedBasename}_cleaned.docx`);
			const ok = cleanDocx(docxFile, cleanedDocxPath);
			if (ok) currentInput = cleanedDocxPath;
		}

		logger.debug({ currentInput, htmlOutput }, 'Converting DOCX to HTML');
		const [htmlOk, extractedNames] = convertDocxToHtml(currentInput, htmlOutput);
		if (!htmlOk) {
			logger.error({ currentInput }, 'DOCX to HTML conversion failed');
			return { ok: false, code: 1, message: 'DOCX→HTML failed' };
		}

		const renameMap = moveAndRenameMediaFiles(htmlOutput, outputDir, sanitizedBasename, extractedNames, counter());
		logger.debug({ mediaCount: Object.keys(renameMap).length }, 'Media files processed');

		// Read pristine HTML and create processed version with updated image references
		let processedHtml = fs.readFileSync(htmlOutput, 'utf8');

		// Update image references in the processed HTML only
		if (Object.keys(renameMap).length > 0) {
			for (const [orig, renamed] of Object.entries(renameMap)) {
				const origRe = new RegExp(
					`src=["']([^"']*/)?(media/)?${orig.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`,
					'g'
				);
				processedHtml = processedHtml.replace(origRe, `src="${renamed}"`);
			}
		}

		processedHtml = processHtml(processedHtml);
		fs.writeFileSync(tempProcessedHtmlPath, processedHtml, 'utf8');

		logger.debug({ tempProcessedHtmlPath, mdOutput }, 'Converting HTML to Markdown');
		const mdOk = convertHtmlToMarkdown(tempProcessedHtmlPath, mdOutput, outputDir, logger);
		if (!mdOk) {
			logger.error({ tempProcessedHtmlPath }, 'HTML to Markdown conversion failed');
			return { ok: false, code: 1, message: 'HTML→Markdown failed' };
		}

		let md = fs.readFileSync(mdOutput, 'utf8');
		logger.debug('Applying Aria rules');
		md = applyAllRules(
			md,
			{ htmlFilePath: tempProcessedHtmlPath, docxFilenameStem: sanitizedBasename },
			enabledRuleSet
		);
		fs.writeFileSync(mdOutput, `${md.trimEnd()}\n`, 'utf8');

		if (options.lint) {
			logger.debug({ mdOutput, fix: options.lintFix }, 'Applying markdownlint');
			await applyMarkdownlint(mdOutput, {
				fix: options.lintFix,
				configPath: options.lintConfigPath ?? undefined,
				rules: markdownlintRulesConfig,
			});
		}

		// Clean up intermediate temp files
		const tempFilesToClean = [tempProcessedHtmlPath];
		if (cleanedDocxPath) {
			tempFilesToClean.push(cleanedDocxPath);
		}
		cleanTempFiles(tempFilesToClean);
		logger.debug({ cleaned: tempFilesToClean.length }, 'Temp files cleaned');

		logger.info({ mdOutput }, 'File conversion completed');
		return { ok: true };
	} catch (err) {
		logger.error({ error: (err as Error).message, docxFile }, 'File processing failed');
		return { ok: false, code: 1, message: (err as Error).message };
	}
}

export async function processDocxDirectory(
	inputDir: string,
	outputDir: string,
	options: ProcessOptions,
	logger: Logger,
	enabledRuleSet?: Set<string>,
	markdownlintRulesConfig?: Record<string, boolean>
): Promise<Result> {
	const files = fs.readdirSync(inputDir).filter(f => f.toLowerCase().endsWith('.docx') && !f.startsWith('~$'));
	if (files.length === 0) {
		logger.info({ inputDir }, 'No DOCX files found in directory');
		return { ok: true };
	}
	logger.info({ inputDir, fileCount: files.length }, 'Processing directory (non-recursive)');
	for (const file of files) {
		const abs = path.join(inputDir, file);
		const baseName = path.basename(file, path.extname(file));
		const sanitizedName = sanitizeFilename(baseName);
		// ALWAYS create subdirectory for each document
		const targetDir = path.join(outputDir, sanitizedName);
		const res = await processDocxFile(abs, targetDir, options, logger, enabledRuleSet, markdownlintRulesConfig);
		if (!res.ok) return res;
	}
	return { ok: true };
}

/**
 * Recursively process directory tree with --dirs-recurse (flat output)
 * Traverses subdirectories but outputs all conversions to same level
 */
export async function processDocxDirectoryRecursiveFlat(
	inputDir: string,
	outputDir: string,
	options: ProcessOptions,
	logger: Logger,
	enabledRuleSet?: Set<string>,
	markdownlintRulesConfig?: Record<string, boolean>
): Promise<Result> {
	const entries = fs.readdirSync(inputDir, { withFileTypes: true });
	logger.debug({ inputDir }, 'Scanning directory (recursive flat)');

	for (const entry of entries) {
		const fullPath = path.join(inputDir, entry.name);

		if (entry.isDirectory()) {
			// Recurse into subdirectory
			const res = await processDocxDirectoryRecursiveFlat(
				fullPath,
				outputDir,
				options,
				logger,
				enabledRuleSet,
				markdownlintRulesConfig
			);
			if (!res.ok) return res;
		} else if (entry.name.toLowerCase().endsWith('.docx') && !entry.name.startsWith('~$')) {
			// Process DOCX file
			const baseName = path.basename(entry.name, path.extname(entry.name));
			const sanitizedName = sanitizeFilename(baseName);
			const targetDir = path.join(outputDir, sanitizedName);
			const res = await processDocxFile(
				fullPath,
				targetDir,
				options,
				logger,
				enabledRuleSet,
				markdownlintRulesConfig
			);
			if (!res.ok) return res;
		}
	}

	return { ok: true };
}

/**
 * Recursively process directory tree with --dirs-recurse --dirs-preserve
 * Preserves source directory structure in output
 */
export async function processDocxDirectoryRecursive(
	inputDir: string,
	outputDir: string,
	options: ProcessOptions,
	logger: Logger,
	enabledRuleSet?: Set<string>,
	markdownlintRulesConfig?: Record<string, boolean>,
	inputRoot?: string
): Promise<Result> {
	// Track the original input root for relative path calculation
	const root = inputRoot ?? inputDir;
	const entries = fs.readdirSync(inputDir, { withFileTypes: true });
	logger.debug({ inputDir }, 'Scanning directory (recursive preserve)');

	for (const entry of entries) {
		const fullPath = path.join(inputDir, entry.name);

		if (entry.isDirectory()) {
			// Recurse into subdirectory, passing along the root
			const res = await processDocxDirectoryRecursive(
				fullPath,
				outputDir,
				options,
				logger,
				enabledRuleSet,
				markdownlintRulesConfig,
				root
			);
			if (!res.ok) return res;
		} else if (entry.name.toLowerCase().endsWith('.docx') && !entry.name.startsWith('~$')) {
			// Calculate relative path from root to current directory
			let relativePath = path.relative(root, inputDir);

			// Sanitize directory names in the path if requested
			if (options.dirsSanitize && relativePath) {
				const pathComponents = relativePath.split(path.sep);
				const sanitizedComponents = pathComponents.map(component => sanitizeFilename(component));
				relativePath = sanitizedComponents.join(path.sep);
			}

			const baseName = path.basename(entry.name, path.extname(entry.name));
			const sanitizedName = sanitizeFilename(baseName);

			// Build output path: outputDir + relativePath + sanitizedName
			const targetDir = path.join(outputDir, relativePath, sanitizedName);

			const res = await processDocxFile(
				fullPath,
				targetDir,
				options,
				logger,
				enabledRuleSet,
				markdownlintRulesConfig
			);
			if (!res.ok) return res;
		}
	}

	return { ok: true };
}
