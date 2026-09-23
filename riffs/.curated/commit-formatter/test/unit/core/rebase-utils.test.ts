import { execSync } from 'node:child_process';
import fs from 'node:fs';
import pino from 'pino';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	abortRebase,
	applyAllChanges,
	createManualScript,
	generateManualInstructions,
	rewriteLastCommit,
	verifyRebase,
} from '../../../src/core/rebase-utils.js';
import type { AuthorConfig } from '../../../src/lib/types.js';
import { mockFormattingResults } from '../../fixtures/mock-commits.js';

// Mock child_process
vi.mock('node:child_process');

// Mock fs
vi.mock('node:fs');

describe('rebase-utils', () => {
	const preserveAuthorConfig: AuthorConfig = {
		mode: 'preserve',
	};

	const rewriteAuthorConfig: AuthorConfig = {
		mode: 'rewrite',
		name: 'Test Author',
		email: 'test@example.com',
	};

	describe('generateManualInstructions', () => {
		it('returns message when no results', () => {
			const instructions = generateManualInstructions([], preserveAuthorConfig);
			expect(instructions).toBe('No changes to apply.');
		});

		it('generates instructions with header', () => {
			const instructions = generateManualInstructions(mockFormattingResults, preserveAuthorConfig);
			expect(instructions).toContain('MANUAL REBASE INSTRUCTIONS');
			expect(instructions).toContain('='.repeat(60));
		});

		it('includes interactive rebase option', () => {
			const instructions = generateManualInstructions(mockFormattingResults, preserveAuthorConfig);
			expect(instructions).toContain('Option 1: Interactive Rebase');
			expect(instructions).toContain('git rebase -i');
		});

		it('includes automated script option', () => {
			const instructions = generateManualInstructions(mockFormattingResults, preserveAuthorConfig);
			expect(instructions).toContain('Option 2: Automated Script');
			expect(instructions).toContain('bun run commit-formatter:format -- --apply');
		});

		it('lists all commits to reword', () => {
			const instructions = generateManualInstructions(mockFormattingResults, preserveAuthorConfig);
			expect(instructions).toContain('abc123');
			expect(instructions).toContain('def456');
			expect(instructions).toContain('ghi789');
		});

		it('shows original messages for each commit', () => {
			const instructions = generateManualInstructions(mockFormattingResults, preserveAuthorConfig);
			expect(instructions).toContain('wip: test');
			expect(instructions).toContain('fixed bug');
			expect(instructions).toContain('update docs');
		});

		it('shows suggested messages for each commit', () => {
			const instructions = generateManualInstructions(mockFormattingResults, preserveAuthorConfig);
			expect(instructions).toContain('feat: add test feature');
			expect(instructions).toContain('fix: resolve critical issue');
			expect(instructions).toContain('docs: update documentation');
		});

		it('uses full hashes in git commands but truncates for display', () => {
			const instructions = generateManualInstructions(mockFormattingResults, preserveAuthorConfig);
			// Full hash in git command
			expect(instructions).toContain('git rebase -i abc123def456ghi789jkl012^');
			// Truncated hash in commit list
			expect(instructions).toContain('Commit abc123d:');
		});

		it('includes force push instructions', () => {
			const instructions = generateManualInstructions(mockFormattingResults, preserveAuthorConfig);
			expect(instructions).toContain('After rewriting history');
			expect(instructions).toContain('git push --force-with-lease');
			expect(instructions).toContain('git log --oneline');
		});

		it('includes team notification reminder', () => {
			const instructions = generateManualInstructions(mockFormattingResults, preserveAuthorConfig);
			expect(instructions).toContain('Notify team members');
		});

		it('omits author rewrite section when mode is preserve', () => {
			const instructions = generateManualInstructions(mockFormattingResults, preserveAuthorConfig);
			expect(instructions).not.toContain('filter-branch');
			expect(instructions).not.toContain('GIT_AUTHOR_NAME');
		});

		it('includes author rewrite section when mode is rewrite', () => {
			const instructions = generateManualInstructions(mockFormattingResults, rewriteAuthorConfig);
			expect(instructions).toContain('rewrite authors');
			expect(instructions).toContain('filter-branch');
			expect(instructions).toContain('GIT_AUTHOR_NAME="Test Author"');
			expect(instructions).toContain('GIT_AUTHOR_EMAIL="test@example.com"');
		});

		it('uses correct hash range for author rewrite', () => {
			const instructions = generateManualInstructions(mockFormattingResults, rewriteAuthorConfig);
			const firstHash = mockFormattingResults[0].hash;
			expect(instructions).toContain(`${firstHash}^..HEAD`);
		});

		it('handles single result', () => {
			const singleResult = [mockFormattingResults[0]];
			const instructions = generateManualInstructions(singleResult, preserveAuthorConfig);
			expect(instructions).toContain('MANUAL REBASE INSTRUCTIONS');
			expect(instructions).toContain(mockFormattingResults[0].hash.slice(0, 7));
		});

		it('handles many results', () => {
			const manyResults = Array.from({ length: 10 }, (_, i) => ({
				hash: `hash${i}abc123`,
				original: `original ${i}`,
				suggested: `feat: suggestion ${i}`,
				approved: true,
				applied: false,
			}));

			const instructions = generateManualInstructions(manyResults, preserveAuthorConfig);

			for (let i = 0; i < 10; i++) {
				expect(instructions).toContain(`original ${i}`);
				expect(instructions).toContain(`suggestion ${i}`);
			}
		});
	});

	describe('createManualScript', () => {
		beforeEach(() => {
			vi.clearAllMocks();
		});

		it('creates shell script with default path', () => {
			vi.mocked(fs.writeFileSync).mockImplementation(() => {});

			const scriptPath = createManualScript(mockFormattingResults, preserveAuthorConfig);

			expect(scriptPath).toContain('apply-commit-formatting.sh');
			expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
		});

		it('uses custom output path when provided', () => {
			vi.mocked(fs.writeFileSync).mockImplementation(() => {});

			const scriptPath = createManualScript(mockFormattingResults, preserveAuthorConfig, '/custom/path.sh');

			expect(scriptPath).toBe('/custom/path.sh');
		});

		it('generates valid bash script', () => {
			let scriptContent = '';
			vi.mocked(fs.writeFileSync).mockImplementation((_path, content) => {
				scriptContent = content as string;
			});

			createManualScript(mockFormattingResults, preserveAuthorConfig);

			expect(scriptContent).toContain('#!/bin/bash');
			expect(scriptContent).toContain('set -e');
			expect(scriptContent).toContain('git rebase -i');
		});

		it('sets executable permissions (0o755)', () => {
			vi.mocked(fs.writeFileSync).mockImplementation(() => {});

			createManualScript(mockFormattingResults, preserveAuthorConfig);

			expect(fs.writeFileSync).toHaveBeenCalledWith(expect.any(String), expect.any(String), { mode: 0o755 });
		});

		it('includes all commit suggestions as comments', () => {
			let scriptContent = '';
			vi.mocked(fs.writeFileSync).mockImplementation((_path, content) => {
				scriptContent = content as string;
			});

			createManualScript(mockFormattingResults, preserveAuthorConfig);

			expect(scriptContent).toContain('feat: add test feature');
			expect(scriptContent).toContain('fix: resolve critical issue');
			expect(scriptContent).toContain('docs: update documentation');
		});
	});

	describe('verifyRebase', () => {
		beforeEach(() => {
			vi.clearAllMocks();
		});

		it('returns true when rebase is complete', () => {
			vi.mocked(fs.existsSync).mockReturnValue(false); // no rebase-merge dir
			vi.mocked(execSync).mockReturnValue(''); // no conflicts

			const result = verifyRebase();
			expect(result).toBe(true);
		});

		it('returns false when rebase is in progress', () => {
			vi.mocked(fs.existsSync).mockReturnValue(true); // rebase-merge exists

			const result = verifyRebase();
			expect(result).toBe(false);
		});

		it('returns false when conflicts exist', () => {
			vi.mocked(fs.existsSync).mockReturnValue(false);
			vi.mocked(execSync).mockReturnValue('UU conflicted-file.ts\n'); // unmerged

			const result = verifyRebase();
			expect(result).toBe(false);
		});

		it('returns false when git status fails', () => {
			vi.mocked(fs.existsSync).mockReturnValue(false);
			vi.mocked(execSync).mockImplementation(() => {
				throw new Error('git error');
			});

			const result = verifyRebase();
			expect(result).toBe(false);
		});
	});

	describe('abortRebase', () => {
		beforeEach(() => {
			vi.clearAllMocks();
		});

		it('executes git rebase --abort', () => {
			vi.mocked(execSync).mockReturnValue('');

			abortRebase();

			expect(execSync).toHaveBeenCalledWith('git rebase --abort', expect.any(Object));
		});

		it('handles case when no rebase is in progress', () => {
			vi.mocked(execSync).mockImplementation(() => {
				throw new Error('No rebase in progress');
			});

			expect(() => abortRebase()).not.toThrow();
		});
	});

	describe('rewriteLastCommit', () => {
		const mockLogger = pino();

		beforeEach(() => {
			vi.clearAllMocks();
		});

		it('logs dry-run message and returns early when dryRun is true', () => {
			const spy = vi.spyOn(mockLogger, 'info');

			rewriteLastCommit('feat: new message', preserveAuthorConfig, true, mockLogger);

			expect(spy).toHaveBeenCalledWith('DRY RUN - Would rewrite HEAD to: feat: new message');
			expect(execSync).not.toHaveBeenCalled();
		});

		it('amends commit with new message', () => {
			vi.mocked(execSync).mockReturnValue('');

			rewriteLastCommit('feat: new message', preserveAuthorConfig, false, mockLogger);

			expect(execSync).toHaveBeenCalledWith(expect.stringContaining('git commit --amend'), expect.any(Object));
			expect(execSync).toHaveBeenCalledWith(expect.stringContaining('feat: new message'), expect.any(Object));
		});

		it('escapes special characters in commit message', () => {
			vi.mocked(execSync).mockReturnValue('');

			rewriteLastCommit('feat: "test" with $var and `backtick`', preserveAuthorConfig, false, mockLogger);

			const call = vi.mocked(execSync).mock.calls[0][0] as string;
			expect(call).toContain('\\"test\\"');
			expect(call).toContain('\\$var');
			expect(call).toContain('\\`backtick\\`');
		});

		it('includes author when mode is rewrite', () => {
			vi.mocked(execSync).mockReturnValue('');

			rewriteLastCommit('feat: test', rewriteAuthorConfig, false, mockLogger);

			const call = vi.mocked(execSync).mock.calls[0][0] as string;
			expect(call).toContain('--author="Test Author <test@example.com>"');
		});

		it('omits author flag when mode is preserve', () => {
			vi.mocked(execSync).mockReturnValue('');

			rewriteLastCommit('feat: test', preserveAuthorConfig, false, mockLogger);

			const call = vi.mocked(execSync).mock.calls[0][0] as string;
			expect(call).not.toContain('--author');
		});

		it('uses --no-verify flag', () => {
			vi.mocked(execSync).mockReturnValue('');

			rewriteLastCommit('feat: test', preserveAuthorConfig, false, mockLogger);

			const call = vi.mocked(execSync).mock.calls[0][0] as string;
			expect(call).toContain('--no-verify');
		});
	});

	describe('applyAllChanges', () => {
		const mockLogger = pino();

		beforeEach(() => {
			vi.clearAllMocks();
		});

		it('logs dry-run changes and returns when dryRun is true', async () => {
			const spy = vi.spyOn(mockLogger, 'info');

			await applyAllChanges(mockFormattingResults, preserveAuthorConfig, true, mockLogger);

			expect(spy).toHaveBeenCalledWith('DRY RUN - Would apply these changes:');
			expect(execSync).not.toHaveBeenCalled();
		});

		it('returns early when no results', async () => {
			await applyAllChanges([], preserveAuthorConfig, false, mockLogger);

			expect(execSync).not.toHaveBeenCalled();
		});

		it('executes interactive rebase when not dry-run', async () => {
			vi.mocked(execSync).mockReturnValue('parent-hash'); // getParentCommit
			vi.mocked(fs.writeFileSync).mockImplementation(() => {});
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.unlinkSync).mockImplementation(() => {});
			vi.mocked(execSync).mockReturnValue(''); // git rebase

			await applyAllChanges(mockFormattingResults, preserveAuthorConfig, false, mockLogger);

			const calls = vi.mocked(execSync).mock.calls.map(call => call[0]);
			expect(calls.some(cmd => (cmd as string).includes('git rebase -i'))).toBe(true);
		});

		it('cleans up script file after rebase', async () => {
			vi.mocked(execSync).mockReturnValue('parent-hash');
			vi.mocked(fs.writeFileSync).mockImplementation(() => {});
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.unlinkSync).mockImplementation(() => {});

			await applyAllChanges(mockFormattingResults, preserveAuthorConfig, false, mockLogger);

			expect(fs.unlinkSync).toHaveBeenCalled();
		});

		it('cleans up script file even on error', async () => {
			vi.mocked(execSync).mockReturnValueOnce('parent-hash');
			vi.mocked(fs.writeFileSync).mockImplementation(() => {});
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.unlinkSync).mockImplementation(() => {});
			vi.mocked(execSync).mockImplementationOnce(() => {
				throw new Error('rebase failed');
			});

			await expect(
				applyAllChanges(mockFormattingResults, preserveAuthorConfig, false, mockLogger)
			).rejects.toThrow();
			expect(fs.unlinkSync).toHaveBeenCalled();
		});

		it('includes author in rebase script when mode is rewrite', async () => {
			let rebaseTodoContent = '';
			vi.mocked(execSync).mockReturnValue('parent-hash');
			vi.mocked(fs.writeFileSync).mockImplementation((filepath, content) => {
				// Capture the rebase todo script (contains filter-branch command)
				if (typeof filepath === 'string' && filepath.includes('git-rebase-')) {
					rebaseTodoContent = content as string;
				}
			});
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.unlinkSync).mockImplementation(() => {});

			await applyAllChanges(mockFormattingResults, rewriteAuthorConfig, false, mockLogger);

			expect(rebaseTodoContent).toContain('git filter-branch');
			expect(rebaseTodoContent).toContain('GIT_AUTHOR_NAME="Test Author"');
			expect(rebaseTodoContent).toContain('GIT_AUTHOR_EMAIL="test@example.com"');
		});

		it('handles root commit (no parent)', async () => {
			vi.mocked(execSync).mockImplementationOnce(() => {
				throw new Error('no parent');
			}); // getParentCommit fails for root
			vi.mocked(fs.writeFileSync).mockImplementation(() => {});
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.unlinkSync).mockImplementation(() => {});
			vi.mocked(execSync).mockReturnValue(''); // git rebase succeeds

			await applyAllChanges(mockFormattingResults, preserveAuthorConfig, false, mockLogger);

			const calls = vi.mocked(execSync).mock.calls.map(call => call[0]);
			expect(calls.some(cmd => (cmd as string).includes('--root'))).toBe(true);
		});
	});
});
