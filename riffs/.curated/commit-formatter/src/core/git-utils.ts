/**
 * Git utilities for extracting commit information
 */

import { execSync } from 'node:child_process';
import { CommitFormatterError, type CommitInfo } from '../lib/types.js';

/**
 * Get list of commits to process
 */
export function getCommits(count: number, skipConventional: boolean = true): CommitInfo[] {
	try {
		// Get commit hashes
		const hashesOutput = execSync(`git log --format=%H -n ${count}`, {
			encoding: 'utf-8',
		}).trim();

		if (!hashesOutput) {
			return [];
		}

		const hashes = hashesOutput.split('\n');
		const commits: CommitInfo[] = [];

		for (const hash of hashes) {
			const commit = getCommitInfo(hash);

			// Skip if already conventional format (optional)
			if (skipConventional && isConventionalCommit(commit.message)) {
				continue;
			}

			commits.push(commit);
		}

		return commits;
	} catch (error) {
		throw new CommitFormatterError(`Failed to get commits: ${error}`);
	}
}

/**
 * Get detailed information about a specific commit
 */
export function getCommitInfo(hash: string): CommitInfo {
	try {
		// Get commit details
		const details = execSync(`git show --format=%s%n%an%n%aI --no-patch ${hash}`, {
			encoding: 'utf-8',
		}).trim();

		const [message, author, date] = details.split('\n');

		// Get files changed
		const filesOutput = execSync(`git show --name-only --format= ${hash}`, {
			encoding: 'utf-8',
		}).trim();

		const filesChanged = filesOutput ? filesOutput.split('\n').filter(Boolean) : [];

		// Get diff summary
		const diffSummary = execSync(`git show --stat ${hash}`, {
			encoding: 'utf-8',
		}).trim();

		return {
			hash,
			message,
			author,
			date,
			filesChanged,
			diffSummary,
		};
	} catch (error) {
		throw new CommitFormatterError(`Failed to get commit info for ${hash}: ${error}`);
	}
}

/**
 * Check if a commit message already follows conventional commit format
 * Matches Conventional Commits v1.0.0 specification
 */
export function isConventionalCommit(message: string): boolean {
	// Pattern: type(optional-scope)!?: description
	// Supports breaking change indicator (!)
	const conventionalPattern = /^(feat|fix|build|chore|ci|docs|style|refactor|perf|test)(\([a-z0-9-]+\))?!?:\s.+/;
	return conventionalPattern.test(message);
}

/**
 * Check if we're in a git repository
 */
export function isGitRepo(): boolean {
	try {
		execSync('git rev-parse --git-dir', { encoding: 'utf-8', stdio: 'pipe' });
		return true;
	} catch {
		return false;
	}
}

/**
 * Get current branch name
 */
export function getCurrentBranch(): string {
	try {
		return execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
	} catch (error) {
		throw new CommitFormatterError(`Failed to get current branch: ${error}`);
	}
}
