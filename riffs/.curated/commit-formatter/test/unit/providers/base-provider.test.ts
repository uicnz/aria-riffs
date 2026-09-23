import { describe, expect, it } from 'vitest';
import type { CommitInfo } from '../../../src/lib/types.js';
import { BaseLLMProvider, type ProviderConfig } from '../../../src/providers/base-provider.js';

// Test implementation to access protected methods
class TestProvider extends BaseLLMProvider {
	async generateCommitMessage(_commit: CommitInfo): Promise<string> {
		return 'test message';
	}

	async testConnection(): Promise<boolean> {
		return true;
	}

	// Expose protected methods for testing
	public testCleanCommitMessage(message: string): string {
		return this.cleanCommitMessage(message);
	}

	public testBuildPrompt(commit: CommitInfo): string {
		return this.buildPrompt(commit);
	}
}

describe('base-provider', () => {
	const config: ProviderConfig = {
		provider: 'anthropic',
		model: 'test-model',
		temperature: 0.3,
		maxTokens: 1000,
		apiKey: 'test-key',
	};

	describe('Provider Configuration', () => {
		it('stores provider name correctly', () => {
			const provider = new TestProvider(config);
			expect(provider.getProviderName()).toBe('anthropic');
		});

		it('stores model name correctly', () => {
			const provider = new TestProvider(config);
			expect(provider.getModelName()).toBe('test-model');
		});
	});

	describe('cleanCommitMessage', () => {
		const provider = new TestProvider(config);

		it('removes surrounding double quotes', () => {
			expect(provider.testCleanCommitMessage('"test message"')).toBe('test message');
		});

		it('removes surrounding single quotes', () => {
			expect(provider.testCleanCommitMessage("'test message'")).toBe('test message');
		});

		it('removes trailing periods', () => {
			expect(provider.testCleanCommitMessage('test message.')).toBe('test message');
			expect(provider.testCleanCommitMessage('test message...')).toBe('test message');
		});

		it('trims whitespace', () => {
			expect(provider.testCleanCommitMessage('  test message  ')).toBe('test message');
			expect(provider.testCleanCommitMessage('\n  test message  \n')).toBe('test message');
		});

		it('handles combined transformations', () => {
			expect(provider.testCleanCommitMessage('  "test message."  ')).toBe('test message');
			expect(provider.testCleanCommitMessage("  'test message...'  ")).toBe('test message');
		});

		it('preserves internal quotes and periods', () => {
			expect(provider.testCleanCommitMessage('test "inner" message')).toBe('test "inner" message');
			expect(provider.testCleanCommitMessage('test v1.0.0 message')).toBe('test v1.0.0 message');
		});

		it('handles empty strings', () => {
			expect(provider.testCleanCommitMessage('')).toBe('');
			expect(provider.testCleanCommitMessage('   ')).toBe('');
		});
	});

	describe('buildPrompt', () => {
		const provider = new TestProvider(config);

		it('includes commit message', () => {
			const commit: CommitInfo = {
				hash: 'abc123',
				message: 'wip: test commit',
				author: 'Test Author',
				date: '2025-11-03',
				filesChanged: [],
				diffSummary: '',
			};

			const prompt = provider.testBuildPrompt(commit);
			expect(prompt).toContain('wip: test commit');
			expect(prompt).toContain('Current commit message:');
		});

		it('includes scale analysis section', () => {
			const commit: CommitInfo = {
				hash: 'abc123',
				message: 'test',
				author: 'Test',
				date: '2025-11-03',
				filesChanged: ['file1.ts', 'file2.ts'],
				diffSummary: '2 files changed, 10 insertions(+), 5 deletions(-)',
			};

			const prompt = provider.testBuildPrompt(commit);
			expect(prompt).toContain('SCALE ANALYSIS');
			expect(prompt).toContain('Files changed: 2');
			expect(prompt).toContain('Lines added: +10');
			expect(prompt).toContain('Lines deleted: -5');
		});

		it('handles unknown stat values', () => {
			const commit: CommitInfo = {
				hash: 'abc123',
				message: 'test',
				author: 'Test',
				date: '2025-11-03',
				filesChanged: ['file1.ts'],
				diffSummary: 'no standard format',
			};

			const prompt = provider.testBuildPrompt(commit);
			expect(prompt).toContain('Lines added: +unknown');
			expect(prompt).toContain('Lines deleted: -unknown');
		});

		it('lists files changed', () => {
			const commit: CommitInfo = {
				hash: 'abc123',
				message: 'test',
				author: 'Test',
				date: '2025-11-03',
				filesChanged: ['src/file1.ts', 'src/file2.ts', 'README.md'],
				diffSummary: '',
			};

			const prompt = provider.testBuildPrompt(commit);
			expect(prompt).toContain('FILES CHANGED');
			expect(prompt).toContain('src/file1.ts');
			expect(prompt).toContain('src/file2.ts');
			expect(prompt).toContain('README.md');
		});

		it('limits file list to 30 files', () => {
			const files = Array.from({ length: 50 }, (_, i) => `file${i}.ts`);
			const commit: CommitInfo = {
				hash: 'abc123',
				message: 'test',
				author: 'Test',
				date: '2025-11-03',
				filesChanged: files,
				diffSummary: '',
			};

			const prompt = provider.testBuildPrompt(commit);
			expect(prompt).toContain('file0.ts');
			expect(prompt).toContain('file29.ts');
			expect(prompt).toContain('and 20 more files');
		});

		it('includes diff summary', () => {
			const commit: CommitInfo = {
				hash: 'abc123',
				message: 'test',
				author: 'Test',
				date: '2025-11-03',
				filesChanged: [],
				diffSummary: 'Some diff content here\nWith multiple lines',
			};

			const prompt = provider.testBuildPrompt(commit);
			expect(prompt).toContain('DIFF SUMMARY');
			expect(prompt).toContain('Some diff content here');
			expect(prompt).toContain('With multiple lines');
		});

		it('truncates long diff summaries at 2000 chars', () => {
			const longDiff = 'x'.repeat(3000);
			const commit: CommitInfo = {
				hash: 'abc123',
				message: 'test',
				author: 'Test',
				date: '2025-11-03',
				filesChanged: [],
				diffSummary: longDiff,
			};

			const prompt = provider.testBuildPrompt(commit);
			expect(prompt).toContain('diff truncated for length');
		});

		it('includes task instructions', () => {
			const commit: CommitInfo = {
				hash: 'abc123',
				message: 'test',
				author: 'Test',
				date: '2025-11-03',
				filesChanged: [],
				diffSummary: '',
			};

			const prompt = provider.testBuildPrompt(commit);
			expect(prompt).toContain('TASK:');
			expect(prompt).toContain('Analyze the scale, scope, and nature');
			expect(prompt).toContain('feat (new functionality)');
		});
	});
});
