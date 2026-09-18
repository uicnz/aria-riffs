/**
 * Assisted Mode - AI assists, you approve, immediate apply
 *
 * For active repos where you want to review and approve each change.
 * Shows suggestions and applies them immediately upon approval.
 */

import * as readline from 'node:readline/promises';
import { createBackupBranch, deleteBackupBranch } from '../core/backup-utils.js';
import { getCommits, getCurrentBranch } from '../core/git-utils.js';
import type { CommitMessageGenerator } from '../core/message-generator.js';
import { applyAllChanges } from '../core/rebase-utils.js';
import { generateReport, saveHumanReport } from '../core/report-utils.js';
import type { BackupInfo, FormattingResult, ProcessingOptions, ProcessingStats } from '../lib/types.js';

export class AssistedMode {
	constructor(private generator: CommitMessageGenerator) {}

	async process(options: ProcessingOptions): Promise<void> {
		const { logger } = options;

		logger.info({ mode: 'assisted', dryRun: options.dryRun }, 'Starting assisted mode processing');
		logger.info('=== ASSISTED MODE ===');
		logger.info('Review and approve each commit - changes applied immediately');

		// Create backup if not dry run
		let backup: BackupInfo | undefined;
		if (!options.dryRun && options.createBackup) {
			logger.info('Creating backup branch');
			backup = createBackupBranch();
			logger.info({ backupBranch: backup.branchName }, `Created backup: ${backup.branchName}`);
		}

		// Get commits
		const count = options.count || 20;
		logger.info({ count }, `Scanning last ${count} commits`);

		const commits = getCommits(count, options.skipConventional);

		if (commits.length === 0) {
			logger.info('No commits need reformatting');
			logger.info('All commits already follow conventional format');
			if (backup) {
				deleteBackupBranch(backup.branchName);
			}
			return;
		}

		logger.info({ commitsToReview: commits.length }, `Found ${commits.length} commits to review`);

		// Process commits interactively
		const results: FormattingResult[] = [];
		const stats: ProcessingStats = {
			total: commits.length,
			formatted: 0,
			skipped: 0,
			errors: 0,
		};

		const rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
		});

		for (let i = 0; i < commits.length; i++) {
			const commit = commits[i];
			const position = `[${i + 1}/${commits.length}]`;

			logger.info(
				{ position, hash: commit.hash.slice(0, 7), message: commit.message },
				`${position} Commit ${commit.hash.slice(0, 7)}`
			);
			logger.info('Current message:');
			logger.info(`  ${commit.message}`);
			logger.info('Files changed:');
			commit.filesChanged.slice(0, 5).forEach(file => {
				logger.info(`  - ${file}`);
			});
			if (commit.filesChanged.length > 5) {
				logger.info(`  ... and ${commit.filesChanged.length - 5} more`);
			}

			// Generate suggestion
			try {
				logger.info('Generating suggestion');
				const suggested = await this.generator.generateCommitMessage(commit);

				logger.info('Suggested message:');
				logger.info(`  ${suggested}`);

				// Ask for approval (readline prompt - not logged)
				const answer = await rl.question('\nApprove this change? (y/n/e=edit/s=skip/q=quit): ');

				const choice = answer.toLowerCase().trim();

				if (choice === 'q' || choice === 'quit') {
					logger.info('User quit assisted mode');
					break;
				} else if (choice === 's' || choice === 'skip') {
					logger.info({ hash: commit.hash.slice(0, 7) }, 'Skipped');
					stats.skipped++;
				} else if (choice === 'e' || choice === 'edit') {
					const edited = await rl.question('Enter custom message: ');
					if (edited.trim()) {
						// Apply custom message immediately
						const singleResult: FormattingResult = {
							hash: commit.hash,
							original: commit.message,
							suggested: edited.trim(),
							approved: true,
							applied: false,
						};

						if (!options.dryRun) {
							try {
								await applyAllChanges([singleResult], options.author, false, logger);
								singleResult.applied = true;
								logger.info(
									{ hash: commit.hash.slice(0, 7), customMessage: edited.trim() },
									'Approved and applied (custom)'
								);
							} catch (error) {
								logger.error(
									{ error: error instanceof Error ? error.message : String(error) },
									'Failed to apply custom change'
								);
								stats.errors++;
								const continueAnswer = await rl.question('Continue to next commit? (y/n): ');
								if (continueAnswer.toLowerCase() !== 'y') {
									logger.info('User chose to stop after apply error');
									break;
								}
							}
						} else {
							logger.info(
								{ hash: commit.hash.slice(0, 7), customMessage: edited.trim() },
								'Approved (custom, dry-run)'
							);
						}

						results.push(singleResult);
						stats.formatted++;
					} else {
						stats.skipped++;
						logger.info({ hash: commit.hash.slice(0, 7) }, 'Skipped (empty input)');
					}
				} else if (choice === 'y' || choice === 'yes' || choice === '') {
					// Apply this single change immediately
					const singleResult: FormattingResult = {
						hash: commit.hash,
						original: commit.message,
						suggested,
						approved: true,
						applied: false,
					};

					if (!options.dryRun) {
						try {
							await applyAllChanges([singleResult], options.author, false, logger);
							singleResult.applied = true;
							logger.info({ hash: commit.hash.slice(0, 7) }, 'Approved and applied');
						} catch (error) {
							logger.error(
								{ error: error instanceof Error ? error.message : String(error) },
								'Failed to apply change'
							);
							stats.errors++;
							const continueAnswer = await rl.question('Continue to next commit? (y/n): ');
							if (continueAnswer.toLowerCase() !== 'y') {
								logger.info('User chose to stop after apply error');
								break;
							}
						}
					} else {
						logger.info({ hash: commit.hash.slice(0, 7) }, 'Approved (dry-run)');
					}

					results.push(singleResult);
					stats.formatted++;
				} else {
					stats.skipped++;
					logger.info({ hash: commit.hash.slice(0, 7) }, 'Skipped');
				}
			} catch (error) {
				stats.errors++;
				logger.error(
					{ error: error instanceof Error ? error.message : String(error) },
					'Error generating suggestion'
				);

				const continueAnswer = await rl.question('Continue? (y/n): ');
				if (continueAnswer.toLowerCase() !== 'y') {
					logger.info('User chose to stop after error');
					break;
				}
			}
		}

		rl.close();

		// Summary
		logger.info('=== SUMMARY ===');
		logger.info('Formatting Summary:');
		logger.info(`  Total commits scanned: ${stats.total}`);
		logger.info(`  Suggestions generated: ${stats.formatted}`);
		logger.info(`  Skipped: ${stats.skipped}`);
		if (stats.errors > 0) {
			logger.info(`  Errors: ${stats.errors}`);
		}
		logger.info(`  Mode: assisted`);
		if (options.dryRun) {
			logger.info('This was a dry run. No changes were applied.');
		}

		if (results.length === 0) {
			logger.info('No changes approved');
			return;
		}

		// Generate report
		if (options.generateReport && !options.dryRun) {
			const branch = getCurrentBranch();
			const report = generateReport('assisted', branch, backup?.branchName, results, stats);
			const mdPath = saveHumanReport(report);
			logger.info('Report saved:');
			logger.info({ mdPath }, `  ${mdPath}`);
		}

		if (!options.dryRun && backup) {
			logger.info('=== NEXT STEPS ===');
			logger.info('1. Verify changes: git log --oneline');
			logger.info('2. If satisfied, continue with normal workflow');
			logger.info(
				{ backupBranch: backup.branchName, restoreCommand: `git reset --hard ${backup.branchName}` },
				`3. To restore: git reset --hard ${backup.branchName}`
			);
		}
	}
}
