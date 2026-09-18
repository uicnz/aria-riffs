#!/usr/bin/env bun

/**
 * riff-auditor CLI - Command line interface for riff health auditing
 */

import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import { RiffAuditor } from './core/riff-auditor.js';
import { loadConfig } from './lib/config.js';
import { createLogger } from './lib/logger.js';
import type { HealthSummary, RiffHealth } from './lib/types.js';

export function shouldFailStrictAudit(summary: Pick<HealthSummary, 'hasIssues' | 'unhealthy'>): boolean {
	return summary.hasIssues.length > 0 || summary.unhealthy.length > 0;
}

export function shouldFailStrictCheck(result: Pick<RiffHealth, 'status'>): boolean {
	return result.status !== 'healthy';
}

/**
 * Create and configure the CLI program
 */
function createProgram(): Command {
	const program = new Command();
	program
		.name('riff-auditor')
		.description('Aria riff-auditor - Comprehensive health checker for all riffs')
		.version('1.0.0');

	// Default audit command (runs full audit)
	program
		.command('audit', { isDefault: true })
		.description('Run comprehensive riff health audit')
		.option('-c, --config <path>', 'Path to config file')
		.option('-v, --verbose', 'Enable verbose logging output')
		.option('-o, --output <path>', 'Output directory for report')
		.option('--json', 'Output JSON to stdout (suppresses console logging)')
		.option('--strict', 'Exit with code 1 if any riff is not healthy (for CI)')
		.action(async opts => {
			const config = loadConfig(opts.config);
			const riffConfig = config['riff-auditor'];

			// Override output directory if specified
			if (opts.output) {
				riffConfig.paths.output.dir = opts.output;
			}

			const logger = createLogger({
				level: opts.verbose ? 'debug' : config.logging.level,
				verbose: opts.verbose ?? config.logging.verbose,
				silent: opts.json, // Suppress console when outputting JSON
				file: config.logging.file,
				maxFileSizeMb: config.logging.maxFileSizeMb,
				maxFiles: config.logging.maxFiles,
			});

			const auditor = new RiffAuditor(riffConfig, logger);
			const summary = await auditor.execute();

			// Output JSON to stdout if requested
			if (opts.json) {
				process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
			}

			if (opts.strict && shouldFailStrictAudit(summary)) {
				process.exitCode = 1;
			}
		});

	// Single riff audit command
	program
		.command('check <riff>')
		.description('Audit a single riff')
		.option('-c, --config <path>', 'Path to config file')
		.option('-v, --verbose', 'Enable verbose logging output')
		.option('--json', 'Output JSON to stdout')
		.option('--strict', 'Exit with code 1 if the riff is not healthy (for CI)')
		.action(async (riff, opts) => {
			const config = loadConfig(opts.config);
			const riffConfig = config['riff-auditor'];

			const logger = createLogger({
				level: opts.verbose ? 'debug' : config.logging.level,
				verbose: opts.verbose ?? config.logging.verbose,
				silent: opts.json, // Suppress console when outputting JSON
				file: config.logging.file,
				maxFileSizeMb: config.logging.maxFileSizeMb,
				maxFiles: config.logging.maxFiles,
			});

			const auditor = new RiffAuditor(riffConfig, logger);
			const result = await auditor.auditRiff(riff);

			if (opts.json) {
				process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
			} else {
				if (result.status === 'healthy') {
					logger.info({ riff, status: 'healthy' }, 'Riff OK');
				} else if (result.status === 'issues') {
					logger.warn({ riff, issues: result.issues }, 'Riff has issues');
				} else {
					logger.error({ riff, issues: result.issues }, 'Riff unhealthy');
				}
			}

			if (opts.strict && shouldFailStrictCheck(result)) {
				process.exitCode = 1;
			}
		});

	// List riffs command
	program
		.command('list')
		.description('List all discovered riffs')
		.option('-c, --config <path>', 'Path to config file')
		.option('--json', 'Output JSON to stdout')
		.action(async opts => {
			const config = loadConfig(opts.config);
			const { listRiffDirs } = await import('./audits/utils.js');
			const { resolve } = await import('node:path');
			const { existsSync } = await import('node:fs');

			const repoRoot = process.cwd();
			const riffsDir = resolve(repoRoot, 'riffs');
			const logger = createLogger({
				level: config.logging.level,
				verbose: config.logging.verbose,
				silent: opts.json,
				file: config.logging.file,
				maxFileSizeMb: config.logging.maxFileSizeMb,
				maxFiles: config.logging.maxFiles,
			});

			const riffs = listRiffDirs(riffsDir);

			// Check for co-located configs (config.yaml in each riff's directory)
			const riffsWithConfig = riffs.filter(t => existsSync(resolve(riffsDir, t, 'config.yaml')));
			const riffsWithoutConfig = riffs.filter(t => !existsSync(resolve(riffsDir, t, 'config.yaml')));

			const result = {
				riffs,
				riffsWithConfig,
				riffsWithoutConfig,
			};

			if (opts.json) {
				process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
			} else {
				logger.info({ riffs }, `Riffs: ${riffs.join(', ')}`);
				logger.info({ riffsWithConfig }, `With config: ${riffsWithConfig.join(', ') || '(none)'}`);
				if (riffsWithoutConfig.length > 0) {
					logger.warn({ riffsWithoutConfig }, `Missing config: ${riffsWithoutConfig.join(', ')}`);
				}
			}
		});

	return program;
}

/* c8 ignore start */
if (process.argv[1] === fileURLToPath(import.meta.url)) {
	createProgram().parse();
}

/* c8 ignore stop */

export { createProgram };
