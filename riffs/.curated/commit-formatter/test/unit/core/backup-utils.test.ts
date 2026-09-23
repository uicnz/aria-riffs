import { execSync } from 'node:child_process';
import fs from 'node:fs';
import pino from 'pino';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	createBackupBranch,
	createRewriteDocumentation,
	deleteBackupBranch,
	listBackupBranches,
	pushBackupToRemote,
	restoreFromBackup,
	verifyCleanState,
} from '../../../src/core/backup-utils.js';
import type { BackupInfo } from '../../../src/lib/types.js';

// Mock child_process
vi.mock('node:child_process');

// Mock fs
vi.mock('node:fs');

describe('backup-utils', () => {
	describe('verifyCleanState', () => {
		it('returns true when git status is clean', () => {
			vi.mocked(execSync).mockReturnValue('');

			const result = verifyCleanState();
			expect(result).toBe(true);
		});

		it('returns true for whitespace-only status', () => {
			vi.mocked(execSync).mockReturnValue('   \n  ');

			const result = verifyCleanState();
			expect(result).toBe(true);
		});

		it('returns false when there are uncommitted changes', () => {
			vi.mocked(execSync).mockReturnValue(' M file1.ts\n M file2.ts\n');

			const result = verifyCleanState();
			expect(result).toBe(false);
		});

		it('returns false when there are untracked files', () => {
			vi.mocked(execSync).mockReturnValue('?? newfile.ts\n');

			const result = verifyCleanState();
			expect(result).toBe(false);
		});

		it('returns false when there are staged changes', () => {
			vi.mocked(execSync).mockReturnValue('A  staged-file.ts\n');

			const result = verifyCleanState();
			expect(result).toBe(false);
		});

		it('throws CommitFormatterError when git command fails', () => {
			vi.mocked(execSync).mockImplementation(() => {
				throw new Error('git error');
			});

			expect(() => verifyCleanState()).toThrow('Failed to check git status');
		});
	});

	describe('listBackupBranches', () => {
		it('returns array of backup branches', () => {
			vi.mocked(execSync).mockReturnValue(
				'  backup-before-reformat-20251103\n  backup-before-reformat-20251102\n'
			);

			const branches = listBackupBranches();
			expect(branches).toHaveLength(2);
			expect(branches).toContain('backup-before-reformat-20251103');
			expect(branches).toContain('backup-before-reformat-20251102');
		});

		it('returns empty array when no backup branches exist', () => {
			vi.mocked(execSync).mockReturnValue('');

			const branches = listBackupBranches();
			expect(branches).toHaveLength(0);
			expect(Array.isArray(branches)).toBe(true);
		});

		it('trims whitespace from branch names', () => {
			vi.mocked(execSync).mockReturnValue('  backup-before-reformat-20251103  \n');

			const branches = listBackupBranches();
			expect(branches).toHaveLength(1);
			expect(branches[0]).toBe('backup-before-reformat-20251103');
		});

		it('removes asterisk from current branch', () => {
			vi.mocked(execSync).mockReturnValue(
				'* backup-before-reformat-20251103\n  backup-before-reformat-20251102\n'
			);

			const branches = listBackupBranches();
			expect(branches).toHaveLength(2);
			expect(branches).toContain('backup-before-reformat-20251103');
			expect(branches).toContain('backup-before-reformat-20251102');
		});

		it('filters out empty lines', () => {
			vi.mocked(execSync).mockReturnValue(
				'  backup-before-reformat-20251103\n\n  \n  backup-before-reformat-20251102\n'
			);

			const branches = listBackupBranches();
			expect(branches).toHaveLength(2);
		});

		it('throws CommitFormatterError when git command fails', () => {
			vi.mocked(execSync).mockImplementation(() => {
				throw new Error('git error');
			});

			expect(() => listBackupBranches()).toThrow('Failed to list backup branches');
		});
	});

	describe('createRewriteDocumentation', () => {
		const mockBackupInfo: BackupInfo = {
			branchName: 'backup-before-reformat-20251103',
			createdAt: '2025-11-03T10:00:00Z',
			originalBranch: 'main',
			commitCount: 150,
		};

		const mockReportPath = '/path/to/report.json';

		beforeEach(() => {
			vi.clearAllMocks();
		});

		it('creates documentation file with correct filename', () => {
			vi.mocked(fs.writeFileSync).mockImplementation(() => {});

			const docPath = createRewriteDocumentation(mockBackupInfo, mockReportPath);
			expect(docPath).toContain('commit-history-rewrite.md');
		});

		it('writes file to filesystem', () => {
			vi.mocked(fs.writeFileSync).mockImplementation(() => {});

			createRewriteDocumentation(mockBackupInfo, mockReportPath);
			expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
		});

		it('includes backup information in content', () => {
			let writtenContent = '';
			vi.mocked(fs.writeFileSync).mockImplementation((_path, content) => {
				writtenContent = content as string;
			});

			createRewriteDocumentation(mockBackupInfo, mockReportPath);

			expect(writtenContent).toContain('backup-before-reformat-20251103');
			expect(writtenContent).toContain('main');
			expect(writtenContent).toContain('2025-11-03T10:00:00Z');
			expect(writtenContent).toContain('150');
		});

		it('includes restoration instructions', () => {
			let writtenContent = '';
			vi.mocked(fs.writeFileSync).mockImplementation((_path, content) => {
				writtenContent = content as string;
			});

			createRewriteDocumentation(mockBackupInfo, mockReportPath);

			expect(writtenContent).toContain('Restoration Instructions');
			expect(writtenContent).toContain('git checkout backup-before-reformat-20251103');
			expect(writtenContent).toContain('git reset --hard backup-before-reformat-20251103');
		});

		it('includes team member instructions', () => {
			let writtenContent = '';
			vi.mocked(fs.writeFileSync).mockImplementation((_path, content) => {
				writtenContent = content as string;
			});

			createRewriteDocumentation(mockBackupInfo, mockReportPath);

			expect(writtenContent).toContain('For Team Members');
			expect(writtenContent).toContain('git fetch origin');
			expect(writtenContent).toContain('git reset --hard origin/main');
		});

		it('includes report path in content', () => {
			let writtenContent = '';
			vi.mocked(fs.writeFileSync).mockImplementation((_path, content) => {
				writtenContent = content as string;
			});

			createRewriteDocumentation(mockBackupInfo, mockReportPath);

			expect(writtenContent).toContain('/path/to/report.json');
			expect(writtenContent).toContain('Detailed Report');
		});

		it('creates valid markdown content', () => {
			let writtenContent = '';
			vi.mocked(fs.writeFileSync).mockImplementation((_path, content) => {
				writtenContent = content as string;
			});

			createRewriteDocumentation(mockBackupInfo, mockReportPath);

			expect(writtenContent).toContain('# Commit History Rewrite Documentation');
			expect(writtenContent).toContain('## Overview');
			expect(writtenContent).toContain('## Backup Information');
		});

		it('uses UTF-8 encoding', () => {
			vi.mocked(fs.writeFileSync).mockImplementation(() => {});

			createRewriteDocumentation(mockBackupInfo, mockReportPath);

			expect(fs.writeFileSync).toHaveBeenCalledWith(expect.any(String), expect.any(String), 'utf-8');
		});
	});

	describe('createBackupBranch', () => {
		beforeEach(() => {
			vi.clearAllMocks();
		});

		it('creates backup branch with default name', () => {
			vi.mocked(execSync).mockReturnValueOnce('main'); // git branch --show-current
			vi.mocked(execSync).mockImplementationOnce(() => {
				throw new Error('branch does not exist');
			}); // git rev-parse --verify (should fail)
			vi.mocked(execSync).mockReturnValueOnce(''); // git branch
			vi.mocked(execSync).mockReturnValueOnce('150'); // git rev-list --count HEAD

			const backup = createBackupBranch();

			expect(backup.originalBranch).toBe('main');
			expect(backup.branchName).toMatch(/^backup-before-reformat-\d{8}$/);
			expect(backup.commitCount).toBe(150);
			expect(backup.createdAt).toBeDefined();
		});

		it('creates backup branch with custom name', () => {
			vi.mocked(execSync).mockReturnValueOnce('feature-branch'); // current branch
			vi.mocked(execSync).mockImplementationOnce(() => {
				throw new Error('branch does not exist');
			});
			vi.mocked(execSync).mockReturnValueOnce(''); // git branch
			vi.mocked(execSync).mockReturnValueOnce('75'); // commit count

			const backup = createBackupBranch('custom-backup');

			expect(backup.branchName).toBe('custom-backup');
			expect(backup.originalBranch).toBe('feature-branch');
			expect(backup.commitCount).toBe(75);
		});

		it('throws when backup branch already exists', () => {
			let callCount = 0;
			vi.mocked(execSync).mockImplementation((_command: string) => {
				callCount++;
				if (callCount === 1) return 'main'; // git branch --show-current
				if (callCount === 2) return 'backup-ref'; // git rev-parse (branch exists, returns successfully)
				if (callCount === 3) {
					// git branch fails because branch exists
					throw new Error('fatal: A branch named existing-backup already exists');
				}
				return '';
			});

			expect(() => createBackupBranch('existing-backup')).toThrow('Failed to create backup branch');
		});

		it('throws CommitFormatterError on git failure', () => {
			vi.mocked(execSync).mockImplementation(() => {
				throw new Error('git command failed');
			});

			expect(() => createBackupBranch()).toThrow('Failed to create backup branch');
		});
	});

	describe('deleteBackupBranch', () => {
		beforeEach(() => {
			vi.clearAllMocks();
		});

		it('deletes specified branch', () => {
			vi.mocked(execSync).mockReturnValue('');

			deleteBackupBranch('backup-test');

			expect(execSync).toHaveBeenCalledWith('git branch -D backup-test', expect.any(Object));
		});

		it('throws CommitFormatterError on failure', () => {
			vi.mocked(execSync).mockImplementation(() => {
				throw new Error('git error');
			});

			expect(() => deleteBackupBranch('backup-test')).toThrow('Failed to delete backup branch');
		});
	});

	describe('pushBackupToRemote', () => {
		beforeEach(() => {
			vi.clearAllMocks();
		});

		it('pushes specified branch to remote', () => {
			vi.mocked(execSync).mockReturnValue('');

			pushBackupToRemote('backup-test');

			expect(execSync).toHaveBeenCalledWith('git push origin backup-test', expect.any(Object));
		});

		it('throws CommitFormatterError on failure', () => {
			vi.mocked(execSync).mockImplementation(() => {
				throw new Error('push failed');
			});

			expect(() => pushBackupToRemote('backup-test')).toThrow('Failed to push backup branch');
		});
	});

	describe('restoreFromBackup', () => {
		const mockLogger = pino();

		beforeEach(() => {
			vi.clearAllMocks();
		});

		it('restores current branch from backup', () => {
			vi.mocked(execSync).mockReturnValueOnce('feature-branch'); // current branch
			vi.mocked(execSync).mockReturnValueOnce(''); // git reset

			restoreFromBackup('backup-test', mockLogger);

			expect(execSync).toHaveBeenCalledWith('git branch --show-current', expect.any(Object));
			expect(execSync).toHaveBeenCalledWith('git reset --hard backup-test', expect.any(Object));
		});

		it('throws CommitFormatterError on failure', () => {
			vi.mocked(execSync).mockImplementation(() => {
				throw new Error('restore failed');
			});

			expect(() => restoreFromBackup('backup-test', mockLogger)).toThrow('Failed to restore from backup');
		});
	});
});
