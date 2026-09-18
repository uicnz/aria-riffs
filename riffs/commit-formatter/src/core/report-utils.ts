/**
 * Report generation utilities
 */

import fs from 'node:fs';
import path from 'node:path';
import type { FormattingResult, ProcessingMode, ProcessingStats, ReviewFile, RewriteReport } from '../lib/types.js';

/**
 * Generate a detailed formatting report
 */
export function generateReport(
	mode: ProcessingMode,
	originalBranch: string,
	backupBranch: string | undefined,
	results: FormattingResult[],
	stats: ProcessingStats,
	warnings: string[] = []
): RewriteReport {
	return {
		timestamp: new Date().toISOString(),
		originalBranch,
		backupBranch,
		mode,
		stats,
		results,
		warnings,
	};
}

/**
 * Save report to file
 */
export function saveReportToFile(report: RewriteReport, filename?: string): string {
	const timestamp = new Date().toISOString().split('T')[0];
	const defaultFilename = `commit-reformat-report-${timestamp}.json`;
	const filepath = path.join(process.cwd(), filename || defaultFilename);

	fs.writeFileSync(filepath, JSON.stringify(report, null, 2), 'utf-8');

	return filepath;
}

/**
 * Generate human-readable report
 */
export function generateHumanReport(report: RewriteReport): string {
	let output = '';

	output += '# Commit Formatting Report\n\n';
	output += `**Date**: ${new Date(report.timestamp).toLocaleString()}\n`;
	output += `**Mode**: ${report.mode}\n`;
	output += `**Branch**: ${report.originalBranch}\n`;

	if (report.backupBranch) {
		output += `**Backup**: ${report.backupBranch}\n`;
	}

	output += '\n## Summary\n\n';
	output += `- Total commits scanned: ${report.stats.total}\n`;
	output += `- Successfully formatted: ${report.stats.formatted}\n`;
	output += `- Skipped: ${report.stats.skipped}\n`;
	output += `- Errors: ${report.stats.errors}\n`;

	if (report.warnings.length > 0) {
		output += '\n## Warnings\n\n';
		report.warnings.forEach((warning: string) => {
			output += `- ${warning}\n`;
		});
	}

	output += '\n## Changes\n\n';
	report.results.forEach((result: FormattingResult) => {
		output += `### Commit ${result.hash.slice(0, 7)}\n\n`;
		output += `**Original**: ${result.original}\n\n`;
		output += `**Suggested**: ${result.suggested}\n\n`;
		output += `**Status**: ${result.applied ? 'Applied' : result.approved ? 'Approved' : 'Not Applied'}\n\n`;
	});

	return output;
}

/**
 * Save human-readable report
 */
export function saveHumanReport(report: RewriteReport, filename?: string): string {
	const timestamp = new Date().toISOString().split('T')[0];
	const defaultFilename = `commit-reformat-report-${timestamp}.md`;
	const filepath = path.join(process.cwd(), filename || defaultFilename);

	const content = generateHumanReport(report);
	fs.writeFileSync(filepath, content, 'utf-8');

	return filepath;
}

/**
 * Create review file for advisory mode
 */
export function createReviewFile(branch: string, results: FormattingResult[]): string {
	const timestamp = new Date().toISOString().split('T')[0];
	const filename = `commit-reformat-review-${timestamp}.json`;
	const filepath = path.join(process.cwd(), filename);

	const reviewFile: ReviewFile = {
		timestamp: new Date().toISOString(),
		branch,
		results: results.map((r: FormattingResult) => ({ ...r, approved: false })),
		approved: false,
	};

	fs.writeFileSync(filepath, JSON.stringify(reviewFile, null, 2), 'utf-8');

	return filepath;
}

/**
 * Load review file
 */
export function loadReviewFile(filepath: string): ReviewFile {
	const content = fs.readFileSync(filepath, 'utf-8');
	return JSON.parse(content) as ReviewFile;
}

/**
 * Generate summary for console output
 */
export function formatConsoleSummary(stats: ProcessingStats, mode: ProcessingMode, dryRun: boolean): string {
	let output = '\n';
	output += 'Formatting Summary:\n';
	output += `  Total commits scanned: ${stats.total}\n`;
	output += `  Suggestions generated: ${stats.formatted}\n`;
	output += `  Skipped: ${stats.skipped}\n`;

	if (stats.errors > 0) {
		output += `  Errors: ${stats.errors}\n`;
	}

	output += `  Mode: ${mode}\n`;

	if (dryRun) {
		output += '\nThis was a dry run. No changes were applied.\n';
	}

	return output;
}

/**
 * Create human-readable review file for manual approval
 */
export function createHumanReviewFile(branch: string, results: FormattingResult[]): string {
	const timestamp = new Date().toISOString().split('T')[0];
	const filename = `commit-reformat-review-${timestamp}.md`;
	const filepath = path.join(process.cwd(), filename);

	let content = `# Commit Formatting Review\n\n`;
	content += `**Date**: ${new Date().toLocaleString()}\n`;
	content += `**Branch**: ${branch}\n`;
	content += `**Total Changes**: ${results.length}\n\n`;
	content += `## Instructions\n\n`;
	content += `Review each change below. When ready to apply:\n\n`;
	content += `\`\`\`sh\n`;
	content += `bun run commit-formatter:apply-review ${filename.replace('.md', '.json')}\n`;
	content += `\`\`\`\n\n`;
	content += `## Changes\n\n`;

	results.forEach((result: FormattingResult, index: number) => {
		content += `### ${index + 1}. Commit ${result.hash.slice(0, 7)}\n\n`;
		content += `**Original**: \`${result.original}\`\n\n`;
		content += `**Suggested**: \`${result.suggested}\`\n\n`;
		content += `---\n\n`;
	});

	fs.writeFileSync(filepath, content, 'utf-8');

	return filepath;
}
