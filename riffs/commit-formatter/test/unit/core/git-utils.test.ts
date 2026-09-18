import { execSync } from 'node:child_process';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	getCommitInfo,
	getCommits,
	getCurrentBranch,
	isConventionalCommit,
	isGitRepo,
} from '../../../src/core/git-utils.js';
import {
	mockCommitConventional,
	mockCommitDocs,
	mockCommitFeature,
	mockCommitFix,
} from '../../fixtures/mock-commits.js';

// Mock child_process
vi.mock('node:child_process');

describe('git-utils', () => {
	describe('isConventionalCommit', () => {
		describe('valid conventional commits', () => {
			it('matches feat type', () => {
				expect(isConventionalCommit('feat: add new feature')).toBe(true);
			});

			it('matches fix type', () => {
				expect(isConventionalCommit('fix: resolve bug')).toBe(true);
			});

			it('matches build type', () => {
				expect(isConventionalCommit('build: update webpack config')).toBe(true);
			});

			it('matches chore type', () => {
				expect(isConventionalCommit('chore: update dependencies')).toBe(true);
			});

			it('matches ci type', () => {
				expect(isConventionalCommit('ci: add github actions')).toBe(true);
			});

			it('matches docs type', () => {
				expect(isConventionalCommit('docs: update README')).toBe(true);
			});

			it('matches style type', () => {
				expect(isConventionalCommit('style: format code')).toBe(true);
			});

			it('matches refactor type', () => {
				expect(isConventionalCommit('refactor: restructure module')).toBe(true);
			});

			it('matches perf type', () => {
				expect(isConventionalCommit('perf: optimize database queries')).toBe(true);
			});

			it('matches test type', () => {
				expect(isConventionalCommit('test: add unit tests')).toBe(true);
			});
		});

		describe('valid commits with scope', () => {
			it('matches with simple scope', () => {
				expect(isConventionalCommit('feat(api): add endpoint')).toBe(true);
			});

			it('matches with hyphenated scope', () => {
				expect(isConventionalCommit('fix(user-auth): resolve login issue')).toBe(true);
			});

			it('matches with numeric scope', () => {
				expect(isConventionalCommit('chore(v2): update config')).toBe(true);
			});

			it('matches with alphanumeric scope', () => {
				expect(isConventionalCommit('feat(api2): add new endpoint')).toBe(true);
			});
		});

		describe('breaking change indicator', () => {
			it('matches with ! before colon (no scope)', () => {
				expect(isConventionalCommit('feat!: breaking change')).toBe(true);
			});

			it('matches with ! after scope', () => {
				expect(isConventionalCommit('feat(api)!: breaking change')).toBe(true);
			});

			it('matches fix with breaking change', () => {
				expect(isConventionalCommit('fix!: breaking fix')).toBe(true);
			});

			it('matches refactor with breaking change', () => {
				expect(isConventionalCommit('refactor(core)!: major restructure')).toBe(true);
			});
		});

		describe('valid description formats', () => {
			it('matches with short description', () => {
				expect(isConventionalCommit('feat: add')).toBe(true);
			});

			it('matches with long description', () => {
				const longDesc = 'a'.repeat(100);
				expect(isConventionalCommit(`feat: ${longDesc}`)).toBe(true);
			});

			it('matches with special characters in description', () => {
				expect(isConventionalCommit('feat: add @user/package support')).toBe(true);
				expect(isConventionalCommit('fix: resolve issue #123')).toBe(true);
				expect(isConventionalCommit('docs: update (v2.0) documentation')).toBe(true);
			});

			it('matches with numbers in description', () => {
				expect(isConventionalCommit('feat: add v2.0 support')).toBe(true);
			});
		});

		describe('invalid conventional commits', () => {
			it('rejects invalid type', () => {
				expect(isConventionalCommit('invalid: not a valid type')).toBe(false);
			});

			it('rejects uppercase type', () => {
				expect(isConventionalCommit('FEAT: uppercase type')).toBe(false);
				expect(isConventionalCommit('Feat: capitalized type')).toBe(false);
			});

			it('rejects missing colon', () => {
				expect(isConventionalCommit('feat missing colon')).toBe(false);
			});

			it('rejects missing space after colon', () => {
				expect(isConventionalCommit('feat:no space')).toBe(false);
			});

			it('rejects empty description', () => {
				expect(isConventionalCommit('feat: ')).toBe(false);
				expect(isConventionalCommit('feat:')).toBe(false);
			});

			it('rejects scope with uppercase letters', () => {
				expect(isConventionalCommit('feat(API): add endpoint')).toBe(false);
			});

			it('rejects scope with spaces', () => {
				expect(isConventionalCommit('feat(my scope): add feature')).toBe(false);
			});

			it('rejects scope with underscores', () => {
				expect(isConventionalCommit('feat(my_scope): add feature')).toBe(false);
			});

			it('rejects non-conventional messages', () => {
				expect(isConventionalCommit('wip')).toBe(false);
				expect(isConventionalCommit('WIP: work in progress')).toBe(false);
				expect(isConventionalCommit('update stuff')).toBe(false);
				expect(isConventionalCommit('Fixed bug')).toBe(false);
				expect(isConventionalCommit('Added new feature')).toBe(false);
			});

			it('rejects messages starting with conventional type but wrong format', () => {
				expect(isConventionalCommit('feat - add feature')).toBe(false);
				expect(isConventionalCommit('feat add feature')).toBe(false);
				expect(isConventionalCommit('feat(scope) add feature')).toBe(false);
			});

			it('rejects empty strings', () => {
				expect(isConventionalCommit('')).toBe(false);
			});

			it('rejects whitespace only', () => {
				expect(isConventionalCommit('   ')).toBe(false);
			});
		});

		describe('edge cases', () => {
			it('handles multiline messages (only checks first line)', () => {
				expect(isConventionalCommit('feat: add feature\n\nDetailed body text')).toBe(true);
				expect(isConventionalCommit('not conventional\n\nfeat: this is in body')).toBe(false);
			});

			it('handles messages with periods in description', () => {
				expect(isConventionalCommit('feat: add v1.0.0 support')).toBe(true);
				expect(isConventionalCommit('fix: resolve issue in file.ts')).toBe(true);
			});

			it('handles messages with colons in description', () => {
				expect(isConventionalCommit('feat: add support for key:value pairs')).toBe(true);
			});

			it('handles very short valid commits', () => {
				expect(isConventionalCommit('fix: x')).toBe(true);
			});
		});

		describe('real-world examples', () => {
			it('matches actual commit from project', () => {
				expect(isConventionalCommit('feat: added Commit Formatter Riff and also updated some language')).toBe(
					true
				);
				expect(isConventionalCommit('chore: typecheck repairs')).toBe(true);
				expect(isConventionalCommit('chore(tests): remove unused imports and variables')).toBe(true);
				expect(isConventionalCommit('fix(tests): update test suite for Vitest v4 compatibility')).toBe(true);
			});

			it('rejects actual non-conventional commits from project', () => {
				expect(isConventionalCommit("wip: this for AI because it's acting like a toddler.")).toBe(false);
				expect(isConventionalCommit('wip')).toBe(false);
			});
		});

		describe('using fixtures', () => {
			it('recognizes conventional commit from fixture', () => {
				expect(isConventionalCommit(mockCommitConventional.message)).toBe(true);
			});

			it('rejects non-conventional feature commit from fixture', () => {
				expect(isConventionalCommit(mockCommitFeature.message)).toBe(false);
			});

			it('rejects non-conventional fix commit from fixture', () => {
				expect(isConventionalCommit(mockCommitFix.message)).toBe(false);
			});

			it('rejects non-conventional docs commit from fixture', () => {
				expect(isConventionalCommit(mockCommitDocs.message)).toBe(false);
			});
		});
	});

	describe('isGitRepo', () => {
		beforeEach(() => {
			vi.clearAllMocks();
		});

		it('returns true when in git repository', () => {
			vi.mocked(execSync).mockReturnValue('');

			const result = isGitRepo();
			expect(result).toBe(true);
		});

		it('returns false when not in git repository', () => {
			vi.mocked(execSync).mockImplementation(() => {
				throw new Error('not a git repository');
			});

			const result = isGitRepo();
			expect(result).toBe(false);
		});

		it('calls git rev-parse --git-dir', () => {
			vi.mocked(execSync).mockReturnValue('.git');

			isGitRepo();

			expect(execSync).toHaveBeenCalledWith('git rev-parse --git-dir', expect.any(Object));
		});
	});

	describe('getCurrentBranch', () => {
		beforeEach(() => {
			vi.clearAllMocks();
		});

		it('returns current branch name', () => {
			vi.mocked(execSync).mockReturnValue('main\n');

			const branch = getCurrentBranch();
			expect(branch).toBe('main');
		});

		it('trims whitespace from branch name', () => {
			vi.mocked(execSync).mockReturnValue('  feature-branch  \n');

			const branch = getCurrentBranch();
			expect(branch).toBe('feature-branch');
		});

		it('throws CommitFormatterError on git failure', () => {
			vi.mocked(execSync).mockImplementation(() => {
				throw new Error('git error');
			});

			expect(() => getCurrentBranch()).toThrow('Failed to get current branch');
		});
	});

	describe('getCommitInfo', () => {
		beforeEach(() => {
			vi.clearAllMocks();
		});

		it('returns commit information', () => {
			vi.mocked(execSync)
				.mockReturnValueOnce('feat: test commit\nTest Author\n2025-11-03T10:00:00+13:00\n') // git show --format
				.mockReturnValueOnce('src/file1.ts\nsrc/file2.ts\n') // git show --name-only
				.mockReturnValueOnce('2 files changed, 10 insertions(+), 5 deletions(-)'); // git show --stat

			const commit = getCommitInfo('abc123');

			expect(commit.hash).toBe('abc123');
			expect(commit.message).toBe('feat: test commit');
			expect(commit.author).toBe('Test Author');
			expect(commit.date).toBe('2025-11-03T10:00:00+13:00');
			expect(commit.filesChanged).toEqual(['src/file1.ts', 'src/file2.ts']);
			expect(commit.diffSummary).toContain('2 files changed');
		});

		it('handles commits with no files changed', () => {
			vi.mocked(execSync)
				.mockReturnValueOnce('docs: update\nAuthor\n2025-11-03\n')
				.mockReturnValueOnce('') // no files
				.mockReturnValueOnce('');

			const commit = getCommitInfo('def456');

			expect(commit.filesChanged).toEqual([]);
		});

		it('filters empty file names', () => {
			vi.mocked(execSync)
				.mockReturnValueOnce('test\nAuthor\n2025-11-03\n')
				.mockReturnValueOnce('\n\nfile.ts\n\n') // empty lines
				.mockReturnValueOnce('');

			const commit = getCommitInfo('ghi789');

			expect(commit.filesChanged).toEqual(['file.ts']);
		});

		it('throws CommitFormatterError on failure', () => {
			vi.mocked(execSync).mockImplementation(() => {
				throw new Error('git error');
			});

			expect(() => getCommitInfo('bad-hash')).toThrow('Failed to get commit info for bad-hash');
		});
	});

	describe('getCommits', () => {
		beforeEach(() => {
			vi.clearAllMocks();
		});

		it('returns array of commits', () => {
			vi.mocked(execSync)
				.mockReturnValueOnce('abc123\ndef456\n') // git log hashes
				.mockReturnValueOnce('wip\nAuthor\n2025-11-03\n') // commit abc123
				.mockReturnValueOnce('src/file1.ts\n')
				.mockReturnValueOnce('1 file changed')
				.mockReturnValueOnce('update\nAuthor\n2025-11-03\n') // commit def456
				.mockReturnValueOnce('README.md\n')
				.mockReturnValueOnce('1 file changed');

			const commits = getCommits(2, false);

			expect(commits).toHaveLength(2);
			expect(commits[0].hash).toBe('abc123');
			expect(commits[1].hash).toBe('def456');
		});

		it('skips conventional commits when skipConventional is true', () => {
			vi.mocked(execSync)
				.mockReturnValueOnce('abc123\ndef456\n') // hashes
				.mockReturnValueOnce('feat: already conventional\nAuthor\n2025-11-03\n') // abc123
				.mockReturnValueOnce('src/file1.ts\n')
				.mockReturnValueOnce('1 file changed')
				.mockReturnValueOnce('wip\nAuthor\n2025-11-03\n') // def456
				.mockReturnValueOnce('src/file2.ts\n')
				.mockReturnValueOnce('1 file changed');

			const commits = getCommits(2, true);

			expect(commits).toHaveLength(1);
			expect(commits[0].hash).toBe('def456');
			expect(commits[0].message).toBe('wip');
		});

		it('includes conventional commits when skipConventional is false', () => {
			vi.mocked(execSync)
				.mockReturnValueOnce('abc123\n')
				.mockReturnValueOnce('feat: conventional\nAuthor\n2025-11-03\n')
				.mockReturnValueOnce('src/file1.ts\n')
				.mockReturnValueOnce('1 file changed');

			const commits = getCommits(1, false);

			expect(commits).toHaveLength(1);
			expect(commits[0].message).toBe('feat: conventional');
		});

		it('returns empty array when no commits', () => {
			vi.mocked(execSync).mockReturnValue('');

			const commits = getCommits(10, true);

			expect(commits).toEqual([]);
		});

		it('throws CommitFormatterError on git failure', () => {
			vi.mocked(execSync).mockImplementation(() => {
				throw new Error('git error');
			});

			expect(() => getCommits(10, true)).toThrow('Failed to get commits');
		});
	});
});
