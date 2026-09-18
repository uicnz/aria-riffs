import type { CommitInfo, FormattingResult } from '../../src/lib/types.js';

/**
 * Mock commit data for testing
 */

export const mockCommitFeature: CommitInfo = {
	hash: 'abc123def456ghi789',
	message: 'wip: adding new feature',
	author: 'Test Author',
	date: '2025-11-03T10:00:00+13:00',
	filesChanged: ['src/features/new-feature.ts', 'src/features/new-feature.test.ts', 'src/index.ts', 'README.md'],
	diffSummary: `src/features/new-feature.ts       | 150 ++++++++++++++++++++++
src/features/new-feature.test.ts | 80 +++++++++++
src/index.ts                     | 5 +
README.md                        | 10 ++
4 files changed, 245 insertions(+)`,
};

export const mockCommitFix: CommitInfo = {
	hash: 'def456abc123ghi789',
	message: 'fixed the login bug',
	author: 'Test Author',
	date: '2025-11-03T11:00:00+13:00',
	filesChanged: ['src/auth/login.ts', 'src/auth/login.test.ts'],
	diffSummary: `src/auth/login.ts      | 10 +++++-----
src/auth/login.test.ts | 15 +++++++++++++++
2 files changed, 20 insertions(+), 5 deletions(-)`,
};

export const mockCommitDocs: CommitInfo = {
	hash: 'ghi789abc123def456',
	message: 'updated readme',
	author: 'Test Author',
	date: '2025-11-03T12:00:00+13:00',
	filesChanged: ['README.md'],
	diffSummary: `README.md | 5 +++--
1 file changed, 3 insertions(+), 2 deletions(-)`,
};

export const mockCommitChore: CommitInfo = {
	hash: 'jkl012mno345pqr678',
	message: 'update dependencies',
	author: 'Test Author',
	date: '2025-11-03T13:00:00+13:00',
	filesChanged: ['package.json', 'bun.lockb'],
	diffSummary: `package.json   | 15 ++++++++-------
bun.lockb | 250 +++++++++++++++++++++++++++++++++++++++++++++++++++++
2 files changed, 258 insertions(+), 7 deletions(-)`,
};

export const mockCommitLargeFeature: CommitInfo = {
	hash: 'stu901vwx234yz567',
	message: 'wip',
	author: 'Test Author',
	date: '2025-11-03T14:00:00+13:00',
	filesChanged: Array.from({ length: 26 }, (_, i) => `riffs/new-riff/src/file${i}.ts`),
	diffSummary: `riffs/new-riff/src/file0.ts  | 100 +++++++++++++++++
riffs/new-riff/src/file1.ts  | 120 ++++++++++++++++++
riffs/new-riff/src/file2.ts  | 90 +++++++++++++
...
26 files changed, 3276 insertions(+)`,
};

export const mockCommitConventional: CommitInfo = {
	hash: 'already123conventional456',
	message: 'feat(api): add new endpoint',
	author: 'Test Author',
	date: '2025-11-03T15:00:00+13:00',
	filesChanged: ['src/api/endpoint.ts'],
	diffSummary: `src/api/endpoint.ts | 50 +++++++++++++++++++++++++++++++++++++++++
1 file changed, 50 insertions(+)`,
};

export const mockFormattingResults: FormattingResult[] = [
	{
		hash: 'abc123def456ghi789jkl012',
		original: 'wip: test',
		suggested: 'feat: add test feature',
		approved: true,
		applied: true,
	},
	{
		hash: 'def456ghi789jkl012mno345',
		original: 'fixed bug',
		suggested: 'fix: resolve critical issue',
		approved: true,
		applied: false,
	},
	{
		hash: 'ghi789jkl012mno345pqr678',
		original: 'update docs',
		suggested: 'docs: update documentation',
		approved: false,
		applied: false,
	},
];
