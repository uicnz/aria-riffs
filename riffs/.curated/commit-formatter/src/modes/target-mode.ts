/**
 * Target Mode - Reformat a single specific commit
 *
 * For targeting a specific commit by hash with human-in-the-loop approval.
 */

import * as readline from 'node:readline/promises';
import type { Logger } from 'pino';
import type { CommitMessageGenerator } from '../core/message-generator.js';
import { rewriteCommit } from '../core/rebase-utils.js';
import type { AuthorConfig, CommitInfo } from '../lib/types.js';

export class TargetMode {
	constructor(private generator: CommitMessageGenerator) {}

	async process(commit: CommitInfo, authorConfig: AuthorConfig, dryRun: boolean, logger: Logger): Promise<boolean> {
		logger.info('=== TARGET MODE ===');
		logger.info(`Targeting commit: ${commit.hash.slice(0, 7)}`);

		// Show commit info
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
		logger.info('Generating suggestion...');
		const suggested = await this.generator.generateCommitMessage(commit);

		logger.info('Suggested message:');
		logger.info(`  ${suggested}`);

		// Ask for approval
		const rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
		});

		const answer = await rl.question('\nApprove this change? (y/n/e=edit): ');
		const choice = answer.toLowerCase().trim();
		rl.close();

		if (choice === 'y' || choice === 'yes' || choice === '') {
			if (!dryRun) {
				logger.info('Applying change...');
				await rewriteCommit(commit.hash, suggested, authorConfig, logger);
				logger.info('Change applied successfully');
			} else {
				logger.info('Approved (dry-run)');
			}
			return true;
		} else if (choice === 'e' || choice === 'edit') {
			const rl2 = readline.createInterface({
				input: process.stdin,
				output: process.stdout,
			});
			const edited = await rl2.question('Enter custom message: ');
			rl2.close();

			if (edited.trim()) {
				if (!dryRun) {
					logger.info('Applying custom message...');
					await rewriteCommit(commit.hash, edited.trim(), authorConfig, logger);
					logger.info('Custom message applied successfully');
				} else {
					logger.info(`Custom message (dry-run): ${edited.trim()}`);
				}
				return true;
			} else {
				logger.info('Cancelled (empty input)');
				return false;
			}
		} else {
			logger.info('Cancelled');
			return false;
		}
	}
}
