import fs from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	createHumanReviewFile,
	createReviewFile,
	formatConsoleSummary,
	generateHumanReport,
	generateReport,
	loadReviewFile,
	saveHumanReport,
	saveReportToFile,
} from '../../../src/core/report-utils.js';
import type { FormattingResult, ProcessingStats } from '../../../src/lib/types.js';
import { mockFormattingResults } from '../../fixtures/mock-commits.js';

// Mock fs
vi.mock('node:fs');

describe('report-utils', () => {
	const mockResults = mockFormattingResults;

	const mockStats: ProcessingStats = {
		total: 10,
		formatted: 8,
		skipped: 1,
		errors: 1,
	};

	describe('generateReport', () => {
		it('creates report with all required fields', () => {
			const report = generateReport('automatic', 'main', 'backup-20251103', mockResults, mockStats);

			expect(report).toHaveProperty('timestamp');
			expect(report).toHaveProperty('originalBranch');
			expect(report).toHaveProperty('backupBranch');
			expect(report).toHaveProperty('mode');
			expect(report).toHaveProperty('stats');
			expect(report).toHaveProperty('results');
			expect(report).toHaveProperty('warnings');
		});

		it('includes correct mode', () => {
			const report = generateReport('assisted', 'main', undefined, mockResults, mockStats);
			expect(report.mode).toBe('assisted');
		});

		it('includes original branch name', () => {
			const report = generateReport('advisory', 'feature-branch', undefined, mockResults, mockStats);
			expect(report.originalBranch).toBe('feature-branch');
		});

		it('includes backup branch when provided', () => {
			const report = generateReport('automatic', 'main', 'backup-123', mockResults, mockStats);
			expect(report.backupBranch).toBe('backup-123');
		});

		it('handles undefined backup branch', () => {
			const report = generateReport('assisted', 'main', undefined, mockResults, mockStats);
			expect(report.backupBranch).toBeUndefined();
		});

		it('includes all results', () => {
			const report = generateReport('automatic', 'main', undefined, mockResults, mockStats);
			expect(report.results).toHaveLength(3);
			expect(report.results).toEqual(mockResults);
		});

		it('includes stats', () => {
			const report = generateReport('automatic', 'main', undefined, mockResults, mockStats);
			expect(report.stats.total).toBe(10);
			expect(report.stats.formatted).toBe(8);
			expect(report.stats.skipped).toBe(1);
			expect(report.stats.errors).toBe(1);
		});

		it('includes warnings when provided', () => {
			const warnings = ['Warning 1', 'Warning 2'];
			const report = generateReport('automatic', 'main', undefined, mockResults, mockStats, warnings);
			expect(report.warnings).toHaveLength(2);
			expect(report.warnings).toEqual(warnings);
		});

		it('defaults to empty warnings array', () => {
			const report = generateReport('automatic', 'main', undefined, mockResults, mockStats);
			expect(report.warnings).toHaveLength(0);
			expect(Array.isArray(report.warnings)).toBe(true);
		});

		it('generates valid ISO timestamp', () => {
			const report = generateReport('automatic', 'main', undefined, mockResults, mockStats);
			const timestamp = new Date(report.timestamp);
			expect(timestamp.toString()).not.toBe('Invalid Date');
		});

		it('handles empty results', () => {
			const report = generateReport('automatic', 'main', undefined, [], mockStats);
			expect(report.results).toHaveLength(0);
		});
	});

	describe('generateHumanReport', () => {
		it('creates markdown formatted report', () => {
			const report = generateReport('automatic', 'main', 'backup-123', mockResults, mockStats);
			const markdown = generateHumanReport(report);

			expect(markdown).toContain('# Commit Formatting Report');
			expect(typeof markdown).toBe('string');
		});

		it('includes report metadata', () => {
			const report = generateReport('assisted', 'feature-branch', undefined, mockResults, mockStats);
			const markdown = generateHumanReport(report);

			expect(markdown).toContain('**Mode**: assisted');
			expect(markdown).toContain('**Branch**: feature-branch');
		});

		it('includes backup branch when present', () => {
			const report = generateReport('automatic', 'main', 'backup-20251103', mockResults, mockStats);
			const markdown = generateHumanReport(report);

			expect(markdown).toContain('**Backup**: backup-20251103');
		});

		it('omits backup when not present', () => {
			const report = generateReport('assisted', 'main', undefined, mockResults, mockStats);
			const markdown = generateHumanReport(report);

			expect(markdown).not.toContain('**Backup**:');
		});

		it('includes summary statistics', () => {
			const report = generateReport('automatic', 'main', undefined, mockResults, mockStats);
			const markdown = generateHumanReport(report);

			expect(markdown).toContain('## Summary');
			expect(markdown).toContain('Total commits scanned: 10');
			expect(markdown).toContain('Successfully formatted: 8');
			expect(markdown).toContain('Skipped: 1');
			expect(markdown).toContain('Errors: 1');
		});

		it('includes warnings section when warnings exist', () => {
			const warnings = ['Warning about X', 'Warning about Y'];
			const report = generateReport('automatic', 'main', undefined, mockResults, mockStats, warnings);
			const markdown = generateHumanReport(report);

			expect(markdown).toContain('## Warnings');
			expect(markdown).toContain('Warning about X');
			expect(markdown).toContain('Warning about Y');
		});

		it('omits warnings section when no warnings', () => {
			const report = generateReport('automatic', 'main', undefined, mockResults, mockStats);
			const markdown = generateHumanReport(report);

			expect(markdown).not.toContain('## Warnings');
		});

		it('includes changes section with all commits', () => {
			const report = generateReport('automatic', 'main', undefined, mockResults, mockStats);
			const markdown = generateHumanReport(report);

			expect(markdown).toContain('## Changes');
			expect(markdown).toContain('### Commit abc123d');
			expect(markdown).toContain('**Original**: wip: test');
			expect(markdown).toContain('**Suggested**: feat: add test feature');
		});

		it('shows correct status for applied commits', () => {
			const report = generateReport('automatic', 'main', undefined, mockResults, mockStats);
			const markdown = generateHumanReport(report);

			expect(markdown).toContain('**Status**: Applied');
		});

		it('shows correct status for approved but not applied', () => {
			const report = generateReport('advisory', 'main', undefined, mockResults, mockStats);
			const markdown = generateHumanReport(report);

			expect(markdown).toContain('**Status**: Approved');
		});

		it('shows correct status for not applied', () => {
			const results: FormattingResult[] = [
				{
					hash: 'abc123',
					original: 'test',
					suggested: 'feat: test',
					approved: false,
					applied: false,
				},
			];
			const report = generateReport('advisory', 'main', undefined, results, mockStats);
			const markdown = generateHumanReport(report);

			expect(markdown).toContain('**Status**: Not Applied');
		});

		it('truncates commit hash to 7 characters', () => {
			const report = generateReport('automatic', 'main', undefined, mockResults, mockStats);
			const markdown = generateHumanReport(report);

			expect(markdown).toContain('### Commit abc123d');
			expect(markdown).toContain('### Commit def456g');
			expect(markdown).not.toContain('abc123def456ghi789jkl012');
			expect(markdown).not.toContain('def456ghi789jkl012mno345');
		});

		it('handles empty results array', () => {
			const report = generateReport('automatic', 'main', undefined, [], mockStats);
			const markdown = generateHumanReport(report);

			expect(markdown).toContain('# Commit Formatting Report');
			expect(markdown).toContain('## Summary');
			expect(markdown).toContain('## Changes');
		});

		it('handles multiple results', () => {
			const manyResults: FormattingResult[] = Array.from({ length: 10 }, (_, i) => ({
				hash: `hash${i}abc123def456`,
				original: `original ${i}`,
				suggested: `feat: suggestion ${i}`,
				approved: true,
				applied: true,
			}));

			const report = generateReport('automatic', 'main', undefined, manyResults, mockStats);
			const markdown = generateHumanReport(report);

			for (let i = 0; i < 10; i++) {
				expect(markdown).toContain(`original ${i}`);
				expect(markdown).toContain(`suggestion ${i}`);
			}
		});
	});

	describe('saveReportToFile', () => {
		beforeEach(() => {
			vi.clearAllMocks();
		});

		it('saves report as JSON file', () => {
			vi.mocked(fs.writeFileSync).mockImplementation(() => {});

			const report = generateReport('automatic', 'main', undefined, mockResults, mockStats);
			const path = saveReportToFile(report);

			expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
			expect(path).toContain('.json');
		});

		it('uses custom filename when provided', () => {
			vi.mocked(fs.writeFileSync).mockImplementation(() => {});

			const report = generateReport('automatic', 'main', undefined, mockResults, mockStats);
			const path = saveReportToFile(report, 'custom-report.json');

			expect(path).toContain('custom-report.json');
		});

		it('writes formatted JSON with 2-space indentation', () => {
			let writtenContent = '';
			vi.mocked(fs.writeFileSync).mockImplementation((_path, content) => {
				writtenContent = content as string;
			});

			const report = generateReport('automatic', 'main', undefined, mockResults, mockStats);
			saveReportToFile(report);

			const parsed = JSON.parse(writtenContent);
			expect(parsed).toEqual(report);
		});

		it('uses UTF-8 encoding', () => {
			vi.mocked(fs.writeFileSync).mockImplementation(() => {});

			const report = generateReport('automatic', 'main', undefined, mockResults, mockStats);
			saveReportToFile(report);

			expect(fs.writeFileSync).toHaveBeenCalledWith(expect.any(String), expect.any(String), 'utf-8');
		});
	});

	describe('saveHumanReport', () => {
		beforeEach(() => {
			vi.clearAllMocks();
		});

		it('saves markdown report file', () => {
			vi.mocked(fs.writeFileSync).mockImplementation(() => {});

			const report = generateReport('automatic', 'main', undefined, mockResults, mockStats);
			const path = saveHumanReport(report);

			expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
			expect(path).toContain('.md');
		});

		it('uses custom filename when provided', () => {
			vi.mocked(fs.writeFileSync).mockImplementation(() => {});

			const report = generateReport('automatic', 'main', undefined, mockResults, mockStats);
			const path = saveHumanReport(report, 'custom-report.md');

			expect(path).toContain('custom-report.md');
		});

		it('writes markdown content from generateHumanReport', () => {
			let writtenContent = '';
			vi.mocked(fs.writeFileSync).mockImplementation((_path, content) => {
				writtenContent = content as string;
			});

			const report = generateReport('automatic', 'main', undefined, mockResults, mockStats);
			saveHumanReport(report);

			expect(writtenContent).toContain('# Commit Formatting Report');
			expect(writtenContent).toContain('## Summary');
		});
	});

	describe('createReviewFile', () => {
		beforeEach(() => {
			vi.clearAllMocks();
		});

		it('creates JSON review file for advisory mode', () => {
			vi.mocked(fs.writeFileSync).mockImplementation(() => {});

			const path = createReviewFile('main', mockResults);

			expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
			expect(path).toContain('.json');
			expect(path).toContain('review');
		});

		it('includes branch and results in file', () => {
			let writtenContent = '';
			vi.mocked(fs.writeFileSync).mockImplementation((_path, content) => {
				writtenContent = content as string;
			});

			createReviewFile('feature-branch', mockResults);

			const parsed = JSON.parse(writtenContent);
			expect(parsed.branch).toBe('feature-branch');
			expect(parsed.results).toHaveLength(3);
		});
	});

	describe('createHumanReviewFile', () => {
		beforeEach(() => {
			vi.clearAllMocks();
		});

		it('creates markdown review file', () => {
			vi.mocked(fs.writeFileSync).mockImplementation(() => {});

			const path = createHumanReviewFile('main', mockResults);

			expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
			expect(path).toContain('.md');
			expect(path).toContain('review');
		});

		it('writes markdown formatted content', () => {
			let writtenContent = '';
			vi.mocked(fs.writeFileSync).mockImplementation((_path, content) => {
				writtenContent = content as string;
			});

			createHumanReviewFile('main', mockResults);

			expect(writtenContent).toContain('# Commit Formatting Review');
			expect(writtenContent).toContain('abc123d');
		});
	});

	describe('loadReviewFile', () => {
		beforeEach(() => {
			vi.clearAllMocks();
		});

		it('loads and parses review file', () => {
			const mockReviewFile = {
				branch: 'main',
				results: mockResults,
			};

			vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockReviewFile));

			const loaded = loadReviewFile('review.json');

			expect(loaded.branch).toBe('main');
			expect(loaded.results).toHaveLength(3);
		});

		it('throws on invalid JSON', () => {
			vi.mocked(fs.readFileSync).mockReturnValue('invalid json {{{');

			expect(() => loadReviewFile('bad.json')).toThrow();
		});

		it('reads file with UTF-8 encoding', () => {
			vi.mocked(fs.readFileSync).mockReturnValue('{"branch":"main","results":[]}');

			loadReviewFile('review.json');

			expect(fs.readFileSync).toHaveBeenCalledWith('review.json', 'utf-8');
		});
	});

	describe('formatConsoleSummary', () => {
		it('formats summary with all stats', () => {
			const summary = formatConsoleSummary(mockStats, 'automatic', false);

			expect(summary).toContain('Formatting Summary:');
			expect(summary).toContain('Total commits scanned: 10');
			expect(summary).toContain('Suggestions generated: 8');
			expect(summary).toContain('Skipped: 1');
			expect(summary).toContain('Mode: automatic');
		});

		it('includes errors when present', () => {
			const summary = formatConsoleSummary(mockStats, 'assisted', false);

			expect(summary).toContain('Errors: 1');
		});

		it('omits errors when zero', () => {
			const statsNoErrors: ProcessingStats = {
				total: 10,
				formatted: 10,
				skipped: 0,
				errors: 0,
			};

			const summary = formatConsoleSummary(statsNoErrors, 'advisory', false);

			expect(summary).not.toContain('Errors:');
		});

		it('includes dry-run message when dryRun is true', () => {
			const summary = formatConsoleSummary(mockStats, 'automatic', true);

			expect(summary).toContain('This was a dry run. No changes were applied.');
		});

		it('omits dry-run message when dryRun is false', () => {
			const summary = formatConsoleSummary(mockStats, 'automatic', false);

			expect(summary).not.toContain('dry run');
		});

		it('shows mode correctly for all modes', () => {
			expect(formatConsoleSummary(mockStats, 'automatic', false)).toContain('Mode: automatic');
			expect(formatConsoleSummary(mockStats, 'assisted', false)).toContain('Mode: assisted');
			expect(formatConsoleSummary(mockStats, 'advisory', false)).toContain('Mode: advisory');
			expect(formatConsoleSummary(mockStats, 'preview', false)).toContain('Mode: preview');
		});
	});
});
