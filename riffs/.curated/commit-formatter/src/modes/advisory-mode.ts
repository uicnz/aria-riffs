/**
 * Advisory Mode - Generate suggestions only, never apply
 *
 * For repos where you want to review suggestions without making any changes.
 * Generates a markdown report with all suggestions for manual review.
 * No backup branch needed since no changes are made.
 */

import { getCommits, getCurrentBranch } from '../core/git-utils.js';
import type { CommitMessageGenerator } from '../core/message-generator.js';
import { generateReport, saveHumanReport } from '../core/report-utils.js';
import type { FormattingResult, ProcessingOptions, ProcessingStats } from '../lib/types.js';

export class AdvisoryMode {
	constructor(private generator: CommitMessageGenerator) {}

	async process(options: ProcessingOptions): Promise<void> {
		const { logger } = options;

		logger.info({ mode: 'advisory' }, 'Starting advisory mode processing');
		logger.info('=== ADVISORY MODE ===');
		logger.info('Generate suggestions only - no changes will be applied');

		// Get commits
		const count = options.count || 50;
		logger.info({ count }, `Scanning last ${count} commits`);

		const commits = getCommits(count, options.skipConventional);

		if (commits.length === 0) {
			logger.info('No commits need reformatting');
			return;
		}

		logger.info({ commitsToProcess: commits.length }, `Found ${commits.length} commits to process`);
		logger.info('Generating suggestions');

		// Process all commits
		const results: FormattingResult[] = [];
		const stats: ProcessingStats = {
			total: commits.length,
			formatted: 0,
			skipped: 0,
			errors: 0,
		};

		for (let i = 0; i < commits.length; i++) {
			const commit = commits[i];
			const position = `[${i + 1}/${commits.length}]`;

			try {
				const suggested = await this.generator.generateCommitMessage(commit);

				results.push({
					hash: commit.hash,
					original: commit.message,
					suggested,
					approved: false,
					applied: false,
				});

				stats.formatted++;
				logger.info(
					{
						position,
						hash: commit.hash.slice(0, 7),
						original: commit.message,
						suggested,
					},
					'Commit formatted successfully'
				);
			} catch (error) {
				stats.errors++;
				logger.error(
					{
						position,
						hash: commit.hash.slice(0, 7),
						error: error instanceof Error ? error.message : String(error),
					},
					'Failed to format commit'
				);
			}
		}

		// Generate report (markdown only)
		const branch = getCurrentBranch();
		const report = generateReport('advisory', branch, undefined, results, stats);
		const mdPath = saveHumanReport(report);

		// Summary
		logger.info('=== SUMMARY ===');
		logger.info('Formatting Summary:');
		logger.info(`  Total commits scanned: ${stats.total}`);
		logger.info(`  Suggestions generated: ${stats.formatted}`);
		logger.info(`  Skipped: ${stats.skipped}`);
		if (stats.errors > 0) {
			logger.info(`  Errors: ${stats.errors}`);
		}
		logger.info(`  Mode: advisory`);
		logger.info('Advisory mode - no changes applied');

		logger.info('=== REPORT CREATED ===');
		logger.info('Suggestions saved to:');
		logger.info(`  ${mdPath}`);

		logger.info('=== NEXT STEPS ===');
		logger.info('1. Review the suggestions in the markdown file');
		logger.info('2. To apply changes, use automatic or assisted mode');
		logger.info('3. Or manually apply changes using git rebase -i');
	}
}
