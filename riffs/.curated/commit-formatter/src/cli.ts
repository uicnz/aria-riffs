#!/usr/bin/env bun

/**
 * CLI interface for commit message formatter
 *
 * Rewrites commit messages to follow conventional commit format using Haiku
 */

import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import type { Logger } from 'pino';
import packageManifest from '../package.json' with { type: 'json' };
import { autoStash, autoUnstash } from './core/backup-utils.js';
import { getCommitInfo, getCommits, isGitRepo } from './core/git-utils.js';
import { CommitMessageGenerator } from './core/message-generator.js';
import { loadConfig } from './lib/config.js';
import { createLogger } from './lib/logger.js';
import type { AuthorConfig, ProcessingOptions } from './lib/types.js';
import { AdvisoryMode } from './modes/advisory-mode.js';
import { AssistedMode } from './modes/assisted-mode.js';
import { AutomaticMode } from './modes/automatic-mode.js';
import { TargetMode } from './modes/target-mode.js';

/**
 * Create and configure the CLI program
 */
function createProgram(): Command {
	// Load config once at startup
	const appConfig = loadConfig();
	const riff = appConfig['commit-formatter'];

	const program = new Command();

	// Initialize logger
	let logger: Logger;

	// Hook to initialize logger before each command
	program.hook('preAction', () => {
		logger = createLogger({
			level: appConfig.logging.level,
			verbose: appConfig.logging.verbose,
			file: appConfig.logging.file,
			maxFileSizeMb: appConfig.logging.maxFileSizeMb,
			maxFiles: appConfig.logging.maxFiles,
		});
	});

	program.name('commit-formatter').description(packageManifest.description).version(packageManifest.version);

	// Automatic mode - for old/archived repos
	program
		.command('automatic')
		.description('Automatic mode: Full auto-apply for archived repos')
		.option('-n, --count <number>', 'Number of commits to scan', String(riff.defaults.count))
		.option('--no-skip-conventional', 'Include commits that already follow conventional format')
		.option('--dry-run', 'Show what would be done without making changes')
		.option('--no-backup', 'Skip creating backup branch (not recommended)')
		.option('--no-report', 'Skip generating report files')
		.option('--author-name <name>', 'Rewrite all commits to this author name')
		.option('--author-email <email>', 'Rewrite all commits to this author email')
		.action(async options => {
			try {
				logger.info(
					{ version: packageManifest.version, command: 'automatic' },
					`Commit Message Formatter v${packageManifest.version}`
				);

				if (!isGitRepo()) {
					logger.error('Error: Not a git repository');
					process.exit(1);
				}

				const generator = new CommitMessageGenerator();
				if (!(await generator.testConnection())) {
					logger.error('Failed to connect to Anthropic API');
					logger.error('Check ANTHROPIC_API_KEY in your .env file');
					process.exit(1);
				}

				const authorConfig: AuthorConfig =
					options.authorName && options.authorEmail
						? {
								mode: 'rewrite',
								name: options.authorName,
								email: options.authorEmail,
							}
						: { mode: 'preserve' };

				const processingOptions: ProcessingOptions = {
					mode: 'automatic',
					count: options.count === 'all' ? 99999 : parseInt(options.count, 10),
					dryRun: options.dryRun || false,
					skipConventional: options.skipConventional ?? riff.defaults.skipConventional,
					createBackup: options.backup ?? riff.defaults.createBackup,
					generateReport: options.report ?? riff.defaults.generateReport,
					author: authorConfig,
					logger,
				};

				// Auto-stash for non-dry-run operations
				const wasStashed = !options.dryRun && autoStash(logger);

				try {
					const mode = new AutomaticMode(generator);
					await mode.process(processingOptions);
				} finally {
					// Always restore stash if we created one
					if (wasStashed) {
						autoUnstash(wasStashed, logger);
					}
				}
			} catch (error) {
				logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Error');
				process.exit(1);
			}
		});

	// Assisted mode - for active repos
	program
		.command('assisted')
		.description('Assisted mode: AI assists, you approve, immediate apply')
		.option('-n, --count <number>', 'Number of recent commits to scan', '20')
		.option('--no-skip-conventional', 'Include commits that already follow conventional format')
		.option('--dry-run', 'Show what would be done without making changes')
		.option('--no-backup', 'Skip creating backup branch (not recommended)')
		.option('--no-report', 'Skip generating report files')
		.option('--author-name <name>', 'Rewrite all commits to this author name')
		.option('--author-email <email>', 'Rewrite all commits to this author email')
		.action(async options => {
			try {
				logger.info(
					{ version: packageManifest.version, command: 'assisted' },
					`Commit Message Formatter v${packageManifest.version}`
				);

				if (!isGitRepo()) {
					logger.error('Error: Not a git repository');
					process.exit(1);
				}

				const generator = new CommitMessageGenerator();
				if (!(await generator.testConnection())) {
					logger.error('Failed to connect to Anthropic API');
					process.exit(1);
				}

				const authorConfig: AuthorConfig =
					options.authorName && options.authorEmail
						? {
								mode: 'rewrite',
								name: options.authorName,
								email: options.authorEmail,
							}
						: { mode: 'preserve' };

				const processingOptions: ProcessingOptions = {
					mode: 'assisted',
					count: parseInt(options.count, 10),
					dryRun: options.dryRun || false,
					skipConventional: options.skipConventional,
					createBackup: options.backup,
					generateReport: options.report,
					author: authorConfig,
					logger,
				};

				// Auto-stash for non-dry-run operations
				const wasStashed = !options.dryRun && autoStash(logger);

				try {
					const mode = new AssistedMode(generator);
					await mode.process(processingOptions);
				} finally {
					// Always restore stash if we created one
					if (wasStashed) {
						autoUnstash(wasStashed, logger);
					}
				}
			} catch (error) {
				logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Error');
				process.exit(1);
			}
		});

	// Advisory mode - generate suggestions only
	program
		.command('advisory')
		.description('Advisory mode: Generate suggestions only, never apply')
		.option('-n, --count <number>', 'Number of recent commits to scan', '50')
		.option('--no-skip-conventional', 'Include commits that already follow conventional format')
		.action(async options => {
			try {
				logger.info(
					{ version: packageManifest.version, command: 'advisory' },
					`Commit Message Formatter v${packageManifest.version}`
				);

				if (!isGitRepo()) {
					logger.error('Error: Not a git repository');
					process.exit(1);
				}

				const generator = new CommitMessageGenerator();
				if (!(await generator.testConnection())) {
					logger.error('Failed to connect to Anthropic API');
					process.exit(1);
				}

				const processingOptions: ProcessingOptions = {
					mode: 'advisory',
					count: parseInt(options.count, 10),
					dryRun: true, // Advisory mode never applies
					skipConventional: options.skipConventional,
					createBackup: false, // No backup needed - no changes made
					generateReport: false,
					author: { mode: 'preserve' },
					logger,
				};

				const mode = new AdvisoryMode(generator);
				await mode.process(processingOptions);
			} catch (error) {
				logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Error');
				process.exit(1);
			}
		});

	// Target mode - reformat specific commit by hash
	program
		.command('target <hash>')
		.description('Target mode: Reformat a specific commit with approval')
		.option('--dry-run', 'Preview without applying changes')
		.option('--author-name <name>', 'Rewrite commit author name')
		.option('--author-email <email>', 'Rewrite commit author email')
		.action(async (hash, options) => {
			try {
				logger.info(
					{ version: packageManifest.version, command: 'target' },
					`Commit Message Formatter v${packageManifest.version}`
				);

				if (!isGitRepo()) {
					logger.error('Error: Not a git repository');
					process.exit(1);
				}

				const generator = new CommitMessageGenerator();
				if (!(await generator.testConnection())) {
					logger.error('Failed to connect to Anthropic API');
					process.exit(1);
				}

				const authorConfig: AuthorConfig =
					options.authorName && options.authorEmail
						? {
								mode: 'rewrite',
								name: options.authorName,
								email: options.authorEmail,
							}
						: { mode: 'preserve' };

				// Get commit info
				const commit = getCommitInfo(hash);

				const wasStashed = !options.dryRun && autoStash(logger);
				try {
					const mode = new TargetMode(generator);
					await mode.process(commit, authorConfig, options.dryRun || false, logger);
				} finally {
					if (wasStashed) {
						autoUnstash(wasStashed, logger);
					}
				}
			} catch (error) {
				logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Error');
				process.exit(1);
			}
		});

	// Legacy format command (backwards compatible with v1)
	program
		.command('format')
		.description('[Legacy] Preview formatting suggestions (use automatic/assisted/advisory instead)')
		.option('-n, --count <number>', 'Number of recent commits to scan', '20')
		.option('--dry-run', 'Show suggestions without applying changes (always on for legacy mode)')
		.action(async options => {
			try {
				logger.info(
					{ version: packageManifest.version, command: 'format' },
					`Commit Message Formatter v${packageManifest.version}`
				);
				logger.warn('Note: This is the legacy preview mode');
				logger.warn('Use automatic/assisted/advisory for the new workflow');

				if (!isGitRepo()) {
					logger.error('Error: Not a git repository');
					process.exit(1);
				}

				const generator = new CommitMessageGenerator();
				if (!(await generator.testConnection())) {
					logger.error('Failed to connect to Anthropic API');
					process.exit(1);
				}

				const count = parseInt(options.count, 10);
				logger.info({ count }, `Scanning last ${count} commits`);

				const commits = getCommits(count, true);

				if (commits.length === 0) {
					logger.info('No commits need reformatting');
					return;
				}

				logger.info({ commitsFound: commits.length }, `Found ${commits.length} commits to reformat`);

				for (let i = 0; i < commits.length; i++) {
					const commit = commits[i];
					logger.info(
						{ position: `[${i + 1}/${commits.length}]`, hash: commit.hash.slice(0, 7) },
						`[${i + 1}/${commits.length}] ${commit.hash.slice(0, 7)}`
					);
					logger.info(`  Current: ${commit.message}`);

					try {
						const suggested = await generator.generateCommitMessage(commit);
						logger.info(`  Suggested: ${suggested}`);
					} catch (error) {
						logger.error({ error }, `  Error: ${error}`);
					}
				}

				logger.info('This was a preview. Use one of these modes to apply:');
				logger.info('  bun run commit-formatter:automatic -- --dry-run');
				logger.info('  bun run commit-formatter:assisted');
				logger.info('  bun run commit-formatter:advisory');
			} catch (error) {
				logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Error');
				process.exit(1);
			}
		});

	// Check API connection
	program
		.command('check')
		.description('Test connection to configured LLM provider')
		.action(async () => {
			try {
				const generator = new CommitMessageGenerator();
				const providerName = generator.getProviderName();
				const modelName = generator.getModelName();

				logger.info({ provider: providerName, model: modelName }, `Testing ${providerName} API connection`);
				logger.info(`Provider: ${providerName}`);
				logger.info(`Model: ${modelName}`);

				if (await generator.testConnection()) {
					logger.info(`Successfully connected to ${providerName} API`);
				} else {
					logger.error(`Failed to connect to ${providerName} API`);
					logger.info('Troubleshooting:');
					logger.info(`1. Check ${providerName.toUpperCase()}_API_KEY environment variable`);
					logger.info('2. Verify your API key is valid');
					logger.info('3. Check your internet connection');
					process.exit(1);
				}
			} catch (error) {
				logger.error(
					{ error: error instanceof Error ? error.message : String(error) },
					'Connection test failed'
				);
				process.exit(1);
			}
		});

	// Preview single commit
	program
		.command('preview <hash>')
		.description('Preview formatting for a single commit')
		.action(async hash => {
			try {
				if (!isGitRepo()) {
					logger.error('Error: Not a git repository');
					process.exit(1);
				}

				const generator = new CommitMessageGenerator();
				const commit = getCommitInfo(hash);

				logger.info('Commit Preview');
				logger.info(`Hash: ${commit.hash}`);
				logger.info(`Author: ${commit.author}`);
				logger.info(`Date: ${commit.date}`);
				logger.info(`Current message: ${commit.message}`);

				logger.info('Generating suggestion');
				const suggested = await generator.generateCommitMessage(commit);

				logger.info('Suggested message:');
				logger.info(suggested);
			} catch (error) {
				logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Error');
				process.exit(1);
			}
		});

	program.action(async () => {
		logger.info({ version: packageManifest.version }, `Commit Message Formatter v${packageManifest.version}`);
		program.help();
	});

	return program;
}

process.on('unhandledRejection', error => {
	const appConfig = loadConfig();
	createLogger({
		level: appConfig.logging.level,
		verbose: appConfig.logging.verbose,
		file: appConfig.logging.file,
		maxFileSizeMb: appConfig.logging.maxFileSizeMb,
		maxFiles: appConfig.logging.maxFiles,
	}).fatal({ error }, 'Unhandled error');
	process.exit(1);
});

process.on('SIGINT', () => {
	const appConfig = loadConfig();
	createLogger({
		level: appConfig.logging.level,
		verbose: appConfig.logging.verbose,
		file: appConfig.logging.file,
		maxFileSizeMb: appConfig.logging.maxFileSizeMb,
		maxFiles: appConfig.logging.maxFiles,
	}).warn('Operation interrupted by user');
	process.exit(130);
});

/* c8 ignore start */
if (process.argv[1] === fileURLToPath(import.meta.url)) {
	createProgram().parse(process.argv);
}
/* c8 ignore stop */
