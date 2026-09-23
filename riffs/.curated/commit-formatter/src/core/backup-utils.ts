/**
 * Backup and safety utilities for commit history rewriting
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { Logger } from 'pino';
import { type BackupInfo, CommitFormatterError } from '../lib/types.js';

/**
 * Create a backup branch before rewriting history
 */
export function createBackupBranch(customName?: string): BackupInfo {
	try {
		const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
		const originalBranch = execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
		const branchName = customName || `backup-before-reformat-${timestamp}`;

		// Check if branch already exists
		try {
			execSync(`git rev-parse --verify ${branchName}`, { stdio: 'pipe' });
			throw new CommitFormatterError(
				`Backup branch '${branchName}' already exists. Delete it first or use a different name.`
			);
		} catch {
			// Branch doesn't exist, which is what we want
		}

		// Create backup branch
		execSync(`git branch ${branchName}`, { encoding: 'utf-8' });

		// Get commit count
		const commitCount = parseInt(execSync('git rev-list --count HEAD', { encoding: 'utf-8' }).trim(), 10);

		return {
			branchName,
			createdAt: new Date().toISOString(),
			originalBranch,
			commitCount,
		};
	} catch (error) {
		throw new CommitFormatterError(`Failed to create backup branch: ${error}`);
	}
}

/**
 * Push backup branch to remote
 */
export function pushBackupToRemote(branchName: string): void {
	try {
		execSync(`git push origin ${branchName}`, { encoding: 'utf-8' });
	} catch (error) {
		throw new CommitFormatterError(`Failed to push backup branch: ${error}`);
	}
}

/**
 * Delete backup branch
 */
export function deleteBackupBranch(branchName: string): void {
	try {
		execSync(`git branch -D ${branchName}`, { encoding: 'utf-8' });
	} catch (error) {
		throw new CommitFormatterError(`Failed to delete backup branch: ${error}`);
	}
}

/**
 * Restore from backup branch
 */
export function restoreFromBackup(branchName: string, logger: Logger): void {
	try {
		const currentBranch = execSync('git branch --show-current', { encoding: 'utf-8' }).trim();

		// Reset current branch to backup
		execSync(`git reset --hard ${branchName}`, { encoding: 'utf-8' });

		logger.info({ currentBranch, backupBranch: branchName }, `Restored ${currentBranch} from backup ${branchName}`);
	} catch (error) {
		throw new CommitFormatterError(`Failed to restore from backup: ${error}`);
	}
}

/**
 * Verify repository is in a clean state
 */
export function verifyCleanState(): boolean {
	try {
		const status = execSync('git status --porcelain', { encoding: 'utf-8' });
		return status.trim() === '';
	} catch (error) {
		throw new CommitFormatterError(`Failed to check git status: ${error}`);
	}
}

/**
 * Auto-stash uncommitted changes before rebase operations
 * @returns true if changes were stashed, false otherwise
 */
export function autoStash(logger: Logger): boolean {
	try {
		if (verifyCleanState()) {
			return false; // No changes to stash
		}

		logger.info('Auto-stashing uncommitted changes');
		execSync('git stash push -m "commit-formatter: auto-stash before rebase"', { encoding: 'utf-8' });
		return true;
	} catch (error) {
		throw new CommitFormatterError(`Failed to stash changes: ${error}`);
	}
}

/**
 * Restore auto-stashed changes after rebase operations
 * @param wasStashed Whether changes were stashed (from autoStash return value)
 * @param logger Logger instance
 */
export function autoUnstash(wasStashed: boolean, logger: Logger): void {
	if (!wasStashed) {
		return; // Nothing was stashed
	}

	try {
		logger.info('Restoring auto-stashed changes');
		execSync('git stash pop', { encoding: 'utf-8', stdio: 'pipe' });
	} catch (error) {
		logger.warn(
			{ error: error instanceof Error ? error.message : String(error) },
			'Failed to restore stash - you may need to run: git stash pop'
		);
	}
}

/**
 * Get list of all backup branches
 */
export function listBackupBranches(): string[] {
	try {
		const branches = execSync('git branch --list "backup-before-reformat-*"', {
			encoding: 'utf-8',
		}).trim();

		if (!branches) {
			return [];
		}

		return branches
			.split('\n')
			.map(b => b.trim().replace(/^\*\s+/, ''))
			.filter(Boolean);
	} catch (error) {
		throw new CommitFormatterError(`Failed to list backup branches: ${error}`);
	}
}

/**
 * Create documentation file for history rewrite
 */
export function createRewriteDocumentation(backupInfo: BackupInfo, reportPath: string): string {
	const docContent = `# Commit History Rewrite Documentation

## Overview

This repository's commit history was reformatted to follow conventional commit standards using the Aria commit-formatter riff.

## Backup Information

- **Original Branch**: ${backupInfo.originalBranch}
- **Backup Branch**: ${backupInfo.branchName}
- **Rewrite Date**: ${backupInfo.createdAt}
- **Original Commit Count**: ${backupInfo.commitCount}

## Restoration Instructions

If you need to restore the original commit history:

\`\`\`sh
# Switch to the backup branch
git checkout ${backupInfo.branchName}

# Or reset current branch to backup
git reset --hard ${backupInfo.branchName}
\`\`\`

## For Team Members

After this history rewrite, you'll need to update your local repository:

\`\`\`sh
# Option 1: Fresh clone (simplest)
git clone <repository-url>

# Option 2: Update existing clone
git fetch origin
git reset --hard origin/${backupInfo.originalBranch}
\`\`\`

## Detailed Report

See the detailed formatting report at: ${reportPath}

## Riff Information

- **Riff**: Aria Commit Formatter
- **Version**: 1.0.0
- **Documentation**: See riffs/.curated/commit-formatter/README.md
`;

	const docPath = path.join(process.cwd(), 'commit-history-rewrite.md');
	fs.writeFileSync(docPath, docContent, 'utf-8');

	return docPath;
}
