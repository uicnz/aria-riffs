/**
 * Service wrapper for npm operations
 */

import { execSync } from 'node:child_process';
import type { Logger } from 'pino';
import { quote } from 'shell-quote';
import { compareVersions } from '../core/version-utils.js';

// Module-level logger (set by setLogger)
let logger: Logger;

/**
 * Set the logger instance for this service
 */
export function setLogger(loggerInstance: Logger): void {
	logger = loggerInstance;
}

/**
 * Get the latest published version of the upstream coding CLI from npm
 * @returns Latest version string
 */
export function getLatestVersion(): string {
	try {
		const output = execSync('npm view @anthropic-ai/claude-code version', {
			encoding: 'utf-8',
			stdio: ['pipe', 'pipe', 'pipe'],
		}).trim();
		return output;
	} catch (error) {
		const errorObj = error as {
			stdout?: string;
			stderr?: string;
			message?: string;
		};
		logger.error(
			{
				command: 'npm view @anthropic-ai/claude-code version',
				stdout: errorObj.stdout,
				stderr: errorObj.stderr,
				error: error instanceof Error ? error.message : String(error),
			},
			'Failed to fetch latest version from npm'
		);
		process.exit(1);
	}
}

/**
 * Get all versions between start and end (inclusive)
 * @param startVersion - Starting version
 * @param endVersion - Ending version
 * @returns Sorted array of versions
 */
export function getAllVersionsBetween(startVersion: string, endVersion: string): string[] {
	try {
		const output = execSync('npm view @anthropic-ai/claude-code versions --json', {
			encoding: 'utf-8',
			stdio: ['pipe', 'pipe', 'pipe'],
		});
		const allVersions: string[] = JSON.parse(output);

		return allVersions
			.filter(v => {
				return compareVersions(v, startVersion) >= 0 && compareVersions(v, endVersion) <= 0;
			})
			.sort(compareVersions);
	} catch (error) {
		const errorObj = error as {
			stdout?: string;
			stderr?: string;
			message?: string;
		};
		logger.error(
			{
				command: 'npm view @anthropic-ai/claude-code versions --json',
				stdout: errorObj.stdout,
				stderr: errorObj.stderr,
				error: error instanceof Error ? error.message : String(error),
			},
			'Failed to fetch version list from npm'
		);
		process.exit(1);
	}
}

/**
 * Get release date for a specific version
 * @param version - Version to look up
 * @returns Release date in YYYY-MM-DD format, or "Unknown" if not found
 */
export function getVersionReleaseDate(version: string): string {
	try {
		const output = execSync(`npm view @anthropic-ai/claude-code@${quote([version])} time --json`, {
			encoding: 'utf-8',
			stdio: ['pipe', 'pipe', 'pipe'],
		});
		const times = JSON.parse(output);
		const releaseDate = new Date(times[version]);
		return releaseDate.toISOString().split('T')[0];
	} catch (_error) {
		return 'Unknown';
	}
}

/**
 * Download a specific version using npm pack
 * @param version - Version to download
 * @param targetDir - Directory to download into
 */
export function downloadPackage(version: string, targetDir: string): void {
	try {
		execSync(`npm pack @anthropic-ai/claude-code@${quote([version])}`, {
			cwd: targetDir,
			stdio: ['pipe', 'pipe', 'pipe'],
		});
	} catch (error) {
		const errorObj = error as {
			stdout?: string;
			stderr?: string;
			message?: string;
		};
		logger.error(
			{
				version,
				command: `npm pack @anthropic-ai/claude-code@${version}`,
				stdout: errorObj.stdout,
				stderr: errorObj.stderr,
				error: error instanceof Error ? error.message : String(error),
			},
			'Failed to download package from npm'
		);
		throw error;
	}
}
