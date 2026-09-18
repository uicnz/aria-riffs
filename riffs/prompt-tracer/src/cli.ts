#!/usr/bin/env bun

import { type ChildProcess, execSync, spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import type { Logger } from 'pino';
import { parse } from 'shell-quote';
import { patchCliVersionCheck } from './core/cli-patcher.js';
import { extractSystemPrompt, findAndExtractUserMessage } from './core/content-extractor.js';
import { parseJsonl } from './core/jsonl-parser.js';
import { formatOutput } from './core/output-formatter.js';
import { filterAndSortRiffs, selectBestRequest } from './core/request-filter.js';
import { loadConfig, type PromptTracerConfig, type PromptTracerRiffConfig } from './lib/config.js';
import { createLogger } from './lib/logger.js';
import type { RequestResponsePair } from './lib/types.js';
import { exists, readDir, readFile, writeFile } from './services/file-service.js';
import {
	downloadPackage,
	getAllVersionsBetween,
	getLatestVersion,
	getVersionReleaseDate,
	setLogger as setNpmLogger,
} from './services/npm-service.js';
import { setLogger as setShellLogger } from './services/shell-service.js';
import { cleanupTempDir, createTempWorkDir } from './services/temp-service.js';

const foreignBrandWord = 'Claude';
const upstreamCodingCliName = `${foreignBrandWord} Code`;
const upstreamCodingCliLabel = 'Anthropic coding CLI';

// ESM __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CLI options interface
interface CliOptions {
	latest?: boolean;
	binaryPath?: string;
	claudeArgs?: string;
	verbose?: boolean;
	separateTrace?: boolean;
}

/**
 * Find the upstream coding CLI executable.
 *
 * Resolution order:
 * 1. Config value (claudeExecutablePath from config.yaml)
 * 2. System PATH (via 'which claude')
 * 3. Aria silo fallback (~/.aria/silos/anthropic/local/node_modules/.bin/claude)
 *
 * @param configPath - Optional path from riff config
 * @returns Path to Claude CLI or null if not found
 */
function findSystemClaude(configPath?: string): string | null {
	// 1. Config-specified path takes priority
	if (configPath && fs.existsSync(configPath)) {
		return fs.realpathSync(configPath);
	}

	// 2. System PATH discovery
	try {
		let claudePath = execSync('which claude', {
			encoding: 'utf-8',
			stdio: ['pipe', 'pipe', 'pipe'],
		}).trim();

		if (!claudePath) return null;

		// Handle shell aliases (e.g., "claude: aliased to /path/to/claude")
		const aliasMatch = claudePath.match(/:\s*aliased to\s+(.+)$/);
		if (aliasMatch?.[1]) {
			claudePath = aliasMatch[1];
		}

		// Resolve symlinks to get actual file
		if (fs.existsSync(claudePath)) {
			const realPath = fs.realpathSync(claudePath);

			// Check if it's a bash wrapper
			const content = fs.readFileSync(realPath, 'utf-8');
			if (content.startsWith('#!/bin/bash')) {
				// Parse bash wrapper to find actual executable
				const execMatch = content.match(/exec\s+"([^"]+)"/);
				if (execMatch?.[1]) {
					return execMatch[1];
				}
			}

			return realPath;
		}

		return claudePath;
	} catch (_error) {
		// 3. Aria silo fallback (NOT ~/.claude/)
		const os = require('node:os');
		const fallbackPath = path.join(
			os.homedir(),
			'.aria',
			'silos',
			'anthropic',
			'local',
			'node_modules',
			'.bin',
			'claude'
		);

		if (fs.existsSync(fallbackPath)) {
			return fs.realpathSync(fallbackPath);
		}

		return null;
	}
}

/**
 * Create and configure the CLI program
 */
function createProgram(): Command {
	// Config and logger instances (initialized in preAction hook)
	let config: PromptTracerConfig;
	let riffConfig: PromptTracerRiffConfig;
	let logger: Logger;

	const program = new Command();

	program
		.name('prompt-tracer')
		.description('Extract and analyze system prompts and riffs from upstream CLI versions')
		.version('1.0.0')
		.argument('[version]', 'Upstream CLI version to extract (e.g., 2.0.0) - uses the system install if omitted')
		.option('--latest', 'Extract all versions from specified version to latest')
		.option('--binary-path <path>', 'Use a custom upstream CLI binary instead of npm or system discovery')
		.option('--claude-args <args>', 'Pass additional arguments to the upstream CLI')
		.option('--separate-trace', 'Create separate timestamped trace file instead of appending to single file')
		.option('-v, --verbose', 'Enable verbose debug output')
		.hook('preAction', thisCommand => {
			// Load config and initialize logger before any command runs
			config = loadConfig();
			riffConfig = config['prompt-tracer'];
			const opts = thisCommand.opts();
			logger = createLogger({
				level: config.logging.level,
				verbose: opts.verbose || config.logging.verbose,
				file: config.logging.file,
				maxFileSizeMb: config.logging.maxFileSizeMb,
				maxFiles: config.logging.maxFiles,
			});

			// Set logger for all services
			setNpmLogger(logger);
			setShellLogger(logger);
		})
		.action(async (version, options) => {
			await main(version, options);
		});

	async function runClaudeWithInterception(
		claudePath: string,
		traceBaseName: string,
		claudeArgs?: string
	): Promise<string> {
		const traceDir = riffConfig.paths.output.traces;

		if (!fs.existsSync(traceDir)) {
			fs.mkdirSync(traceDir, { recursive: true });
		}

		const traceFile = path.join(traceDir, `${traceBaseName}.jsonl`);

		// Loader is compiled to .js in dist/, but .ts in src/ for bun execution
		let loaderPath = path.join(__dirname, 'core', 'interceptor-loader.js');
		if (!fs.existsSync(loaderPath)) {
			// Running from src/ with bun - use .ts version
			loaderPath = path.join(__dirname, 'core', 'interceptor-loader.ts');
			if (!fs.existsSync(loaderPath)) {
				logger.error({ dirname: __dirname }, 'Interceptor loader not found');
				process.exit(1);
			}
		}

		logger.info('Starting upstream CLI with traffic logging');
		logger.debug({ binary: claudePath, trace: path.resolve(traceFile) }, 'Configuration');

		let additionalArgs: string[] = [];
		if (claudeArgs) {
			const parsed = parse(claudeArgs);
			additionalArgs = parsed.filter((entry): entry is string => typeof entry === 'string');
		}

		const command = ['-p', `"${new Date().toISOString()} is the date. Write a haiku about it."`, ...additionalArgs];

		// Use Bun preload so the interceptor is injected without a Node dependency.
		const spawnArgs = ['--preload', loaderPath, claudePath, ...command];
		const child: ChildProcess = spawn('bun', spawnArgs, {
			env: {
				...process.env,
				PROMPT_TRACER_INCLUDE_ALL_REQUESTS: 'false',
				PROMPT_TRACER_TRACE_NAME: traceBaseName,
				PROMPT_TRACER_TRACE_DIRECTORY: traceDir,
			},
			stdio: 'inherit',
			cwd: process.cwd(),
		});

		return new Promise((resolve, reject) => {
			child.on('error', (error: Error) => {
				logger.error({ error: error.message }, 'Error starting upstream CLI');
				reject(error);
			});

			child.on('exit', (code: number | null, signal: string | null) => {
				if (signal) {
					logger.warn({ signal }, 'Upstream CLI terminated by signal');
				} else if (code !== 0 && code !== null) {
					logger.warn({ exitCode: code }, 'Upstream CLI exited with non-zero code');
				} else {
					logger.info('Upstream CLI session completed');
				}
				resolve(traceFile);
			});

			const handleSignal = (signal: string) => {
				logger.info({ signal }, 'Received shutdown signal');
				if (child.pid) {
					child.kill(signal as NodeJS.Signals);
				}
			};

			process.on('SIGINT', () => handleSignal('SIGINT'));
			process.on('SIGTERM', () => handleSignal('SIGTERM'));
		});
	}

	async function extractPromptsFromLog(
		traceFile: string,
		outputPath: string,
		versionOrLabel: string,
		customBinaryPath?: string
	): Promise<void> {
		logger.info('Extracting prompts from trace');

		if (!exists(traceFile)) {
			throw new Error(`Trace file not found: ${traceFile}`);
		}

		const traceContent = readFile(traceFile);
		const pairs: RequestResponsePair[] = parseJsonl(traceContent);

		if (pairs.length === 0) {
			throw new Error('No API requests found in trace file');
		}

		logger.debug({ requestCount: pairs.length }, 'Found API requests');

		const request = selectBestRequest(pairs);
		const userMessage = findAndExtractUserMessage(request.request.body.messages);
		const systemPrompt = extractSystemPrompt(request.request.body);
		const riffs = filterAndSortRiffs(request.request.body.riffs);

		const releaseDate = customBinaryPath ? 'Custom Binary' : getVersionReleaseDate(versionOrLabel);
		const versionLabel = customBinaryPath ? `Custom Binary (${path.basename(outputPath)})` : versionOrLabel;

		logger.debug({ riffCount: riffs.length, hasSystemPrompt: !!systemPrompt }, 'Extracted components');

		const output = formatOutput({
			versionLabel,
			releaseDate,
			userMessage,
			systemPrompt,
			riffs,
		});

		writeFile(outputPath, output);

		logger.info(
			{
				version: customBinaryPath ? 'custom binary' : versionOrLabel,
				output: path.basename(outputPath),
				size: `${Math.round(output.length / 1024)}KB`,
			},
			'Prompts extracted successfully'
		);
	}

	async function processVersion(
		versionOrLabel: string,
		_originalCwd: string,
		customBinaryPath?: string,
		claudeArgs?: string,
		separateTrace?: boolean
	): Promise<void> {
		const outputFilename = customBinaryPath
			? `prompt-tracer-${new Date().toISOString().replace(/[:.]/g, '-')}.md`
			: `prompt-tracer-${versionOrLabel}.md`;

		// Get output directory from config and ensure it exists
		const outputDir = path.resolve(riffConfig.paths.output.reports);
		if (!fs.existsSync(outputDir)) {
			fs.mkdirSync(outputDir, { recursive: true });
		}

		const outputPath = path.join(outputDir, outputFilename);

		if (exists(outputPath)) {
			logger.debug({ version: customBinaryPath ? 'custom binary' : versionOrLabel }, 'Skipping - already exists');
			return;
		}

		logger.info(
			{ version: versionOrLabel, binary: customBinaryPath },
			customBinaryPath ? 'Processing custom binary' : 'Processing version'
		);

		let cliPath: string;
		let tmpDir: string | undefined;
		let packageDir: string | undefined;

		try {
			if (customBinaryPath) {
				cliPath = customBinaryPath;
			} else {
				tmpDir = createTempWorkDir('prompt-tracer');
				packageDir = path.join(tmpDir, 'package');
				cliPath = path.join(packageDir, 'cli.js');

				logger.debug({ version: versionOrLabel }, 'Downloading upstream CLI package');
				downloadPackage(versionOrLabel, packageDir);

				if (!exists(cliPath)) {
					logger.error({ version: versionOrLabel, expectedPath: cliPath }, 'CLI file not found');
					try {
						const packageFiles = readDir(packageDir);
						logger.debug({ files: packageFiles }, 'Package contents');
					} catch (_e) {
						logger.debug('Could not list package directory');
					}
					throw new Error(`CLI file not found at ${cliPath}`);
				}
			}

			// Patch version check if not using custom binary
			if (!customBinaryPath && packageDir) {
				const cliContent = readFile(cliPath);
				const patchResult = patchCliVersionCheck(cliContent);

				if (patchResult.message) {
					logger.debug({ message: patchResult.message }, 'Patch result');
				}

				// Look for potential wrapper function
				const wrapperRegex = new RegExp(
					`function\\s+(\\w+)\\s*\\([^)]*\\)\\s*\\{[^}]*It looks like your version of ${upstreamCodingCliName}`
				);
				const wrapperMatch = cliContent.match(wrapperRegex);

				if (wrapperMatch) {
					const wrapperName = wrapperMatch[1];
					const wrapperCallRegex = new RegExp(`(${wrapperName}\\s*\\([^)]*\\))`, 'g');
					if (wrapperCallRegex.test(cliContent)) {
						patchResult.content = patchResult.content.replace(wrapperCallRegex, '// $1 // patched');
						patchResult.patched = true;
					}
				}

				if (patchResult.patched) {
					writeFile(cliPath, patchResult.content);
					logger.debug({ version: versionOrLabel }, 'Version check patched');
				} else if (!customBinaryPath) {
					logger.warn(
						{ version: versionOrLabel },
						'Could not find version check to patch, continuing anyway'
					);
				}
			}

			// Run Claude with interception
			// Use single trace file for appending (default) or timestamped file if --separate-trace
			const traceBaseName = separateTrace
				? `prompt-tracer-${new Date().toISOString().replace(/[:.]/g, '-')}`
				: 'prompt-tracer';

			const traceFile = await runClaudeWithInterception(cliPath, traceBaseName, claudeArgs);

			// Extract prompts from trace
			await extractPromptsFromLog(traceFile, outputPath, versionOrLabel, customBinaryPath);
		} finally {
			if (tmpDir) {
				cleanupTempDir(tmpDir);
			}
		}
	}

	async function main(version: string | undefined, options: CliOptions): Promise<void> {
		const originalCwd = process.cwd();

		logger.info({ version: '1.0.0' }, 'Prompt Tracer started');

		// If no version and no binary path, try to use system Claude
		if (!version && !options.binaryPath) {
			const systemClaude = findSystemClaude(riffConfig.claudeExecutablePath);
			if (systemClaude) {
				logger.info({ claudePath: systemClaude }, 'Using system-installed upstream CLI');
				options.binaryPath = systemClaude;
			} else {
				logger.error(
					{
						usage: 'prompt-tracer [version] [OPTIONS]',
						examples: [
							'prompt-tracer                                          # Use system-installed Claude',
							'prompt-tracer 2.0.0                                    # Extract prompts from version 2.0.0',
							'prompt-tracer 2.0.0 --latest                           # Extract prompts from 2.0.0 to latest',
							'prompt-tracer --binary-path /path/to/cli.js            # Test custom binary',
							'prompt-tracer 2.0.0 --claude-args "--verbose"          # Pass args to Claude',
						],
						solutions: [
							`Install ${upstreamCodingCliLabel} (claude.ai/code)`,
							'Specify a version number',
							'Provide --binary-path',
						],
					},
					'No upstream CLI found'
				);
				process.exit(1);
			}
		}

		if (options.latest && options.binaryPath) {
			logger.warn('--latest flag is ignored when using --binary-path');
		}

		if (options.binaryPath) {
			if (version && version !== 'custom' && !version.startsWith('--')) {
				logger.debug({ label: version }, 'Using custom label for binary output');
			}
			await processVersion(
				version || 'custom',
				originalCwd,
				options.binaryPath,
				options.claudeArgs,
				options.separateTrace
			);
		} else if (options.latest) {
			if (!version) {
				logger.error('Version required when using --latest flag');
				process.exit(1);
			}
			const latestVersion = getLatestVersion();
			logger.info({ startVersion: version, endVersion: latestVersion }, 'Fetching version range');

			const versions = getAllVersionsBetween(version, latestVersion);
			logger.debug({ versionCount: versions.length }, 'Found versions');

			for (const v of versions) {
				try {
					await processVersion(v, originalCwd, undefined, options.claudeArgs, options.separateTrace);
				} catch (error) {
					logger.error(
						{ version: v, error: error instanceof Error ? error.message : String(error) },
						'Version processing failed'
					);
					if (error instanceof Error && error.stack && options.verbose) {
						logger.debug({ stack: error.stack }, 'Error stack trace');
					}
				}
			}

			logger.info({ completedCount: versions.length }, 'Batch processing completed');
		} else {
			if (!version) {
				logger.error('Version required');
				process.exit(1);
			}
			await processVersion(version, originalCwd, undefined, options.claudeArgs, options.separateTrace);
		}
	}

	return program;
}

/* c8 ignore start */
if (process.argv[1] === fileURLToPath(import.meta.url)) {
	createProgram().parse();
}
/* c8 ignore stop */
