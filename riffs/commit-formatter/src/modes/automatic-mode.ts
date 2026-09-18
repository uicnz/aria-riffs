/**
 * Automatic Mode - Full auto-apply without human intervention
 *
 * For old/archived repos that are no longer under active development.
 * Rewrites all commit history automatically with safety backups.
 */

import {
	createBackupBranch,
	createRewriteDocumentation,
	deleteBackupBranch,
	restoreFromBackup,
} from '../core/backup-utils.js';
import { getCommits, getCurrentBranch } from '../core/git-utils.js';
import type { CommitMessageGenerator } from '../core/message-generator.js';
import { applyAllChanges } from '../core/rebase-utils.js';
import { generateReport, saveHumanReport, saveReportToFile } from '../core/report-utils.js';
import type { BackupInfo, FormattingResult, ProcessingOptions, ProcessingStats } from '../lib/types.js';

export class AutomaticMode {
	constructor(private generator: CommitMessageGenerator) {}

	async process(options: ProcessingOptions): Promise<void> {
		const { logger } = options;

		logger.info({ mode: 'automatic', dryRun: options.dryRun }, 'Starting automatic mode processing');
		logger.info('=== AUTOMATIC MODE ===');
		logger.info('Full auto-apply for archived repositories');

		// Create backup branch (skip for dry-run)
		let backup: BackupInfo | undefined;
		if (!options.dryRun) {
			logger.info('Creating backup branch');
			backup = createBackupBranch();
			logger.info(
				{ backupBranch: backup.branchName, commitCount: backup.commitCount },
				`Created backup: ${backup.branchName}`
			);
		} else {
			logger.info('DRY RUN MODE - No backup branch will be created');
		}

		// Get commits
		const count = options.count || 99999; // All commits by default
		logger.info({ count: count === 99999 ? 'all' : count }, `Scanning ${count === 99999 ? 'all' : count} commits`);

		const commits = getCommits(count, options.skipConventional);

		if (commits.length === 0) {
			logger.info('No commits need reformatting');
			logger.info('All commits already follow conventional format');
			if (backup) {
				deleteBackupBranch(backup.branchName);
			}
			return;
		}

		logger.info({ commitsFound: commits.length }, `Found ${commits.length} commits to reformat`);

		if (options.dryRun) {
			logger.info('DRY RUN MODE - No changes will be applied');
		}

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
					approved: true,
					applied: !options.dryRun,
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

		// Apply changes
		if (results.length > 0) {
			if (!options.dryRun) {
				logger.info({ changeCount: results.length }, 'Applying changes');
			}
			try {
				await applyAllChanges(results, options.author, options.dryRun, logger);
				if (!options.dryRun) {
					logger.info('Changes applied successfully');
				}
			} catch (error) {
				logger.error(
					{ error: error instanceof Error ? error.message : String(error) },
					'Error applying changes'
				);
				if (backup) {
					logger.warn({ backupBranch: backup.branchName }, `Restoring from backup: ${backup.branchName}`);
					restoreFromBackup(backup.branchName, logger);
				}
				process.exit(1);
			}
		}

		// Generate report
		if (options.generateReport && !options.dryRun) {
			const branch = getCurrentBranch();
			const report = generateReport('automatic', branch, backup?.branchName, results, stats);

			const jsonPath = saveReportToFile(report);
			const mdPath = saveHumanReport(report);

			logger.info('Reports generated:');
			logger.info({ jsonPath }, `  JSON: ${jsonPath}`);
			logger.info({ mdPath }, `  Markdown: ${mdPath}`);

			// Create history documentation
			if (backup) {
				const docPath = createRewriteDocumentation(backup, jsonPath);
				logger.info('Documentation created:');
				logger.info({ docPath }, `  ${docPath}`);
			}
		}

		// Summary
		logger.info('=== SUMMARY ===');
		logger.info('Formatting Summary:');
		logger.info(`  Total commits scanned: ${stats.total}`);
		logger.info(`  Suggestions generated: ${stats.formatted}`);
		logger.info(`  Skipped: ${stats.skipped}`);
		if (stats.errors > 0) {
			logger.info(`  Errors: ${stats.errors}`);
		}
		logger.info(`  Mode: automatic`);
		if (options.dryRun) {
			logger.info('This was a dry run. No changes were applied.');
		}

		if (!options.dryRun && backup) {
			logger.warn('IMPORTANT NEXT STEPS:');
			logger.warn('1. Verify changes: git log --oneline');
			logger.warn(`2. Push backup: git push origin ${backup.branchName}`);
			logger.warn('3. Force push: git push --force-with-lease origin main');
			logger.warn('4. Team members must re-clone or reset their local copies');
			logger.info(
				{ backupBranch: backup.branchName, restoreCommand: `git reset --hard ${backup.branchName}` },
				`Backup branch: ${backup.branchName}`
			);
			logger.info(`To restore: git reset --hard ${backup.branchName}`);
		}
	}
}
