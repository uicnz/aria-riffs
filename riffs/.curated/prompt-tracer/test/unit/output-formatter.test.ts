import { describe, expect, it } from 'vitest';
import { formatOutput, formatRiffs, indentHeaders } from '../../src/core/output-formatter.js';
import type { Riff } from '../../src/lib/types.js';

describe('output-formatter', () => {
	describe('indentHeaders', () => {
		it('adds # to single-level header', () => {
			expect(indentHeaders('# Header')).toBe('## Header');
		});

		it('adds # to multi-level headers', () => {
			const input = '# H1\n## H2\n### H3';
			const expected = '## H1\n### H2\n#### H3';
			expect(indentHeaders(input)).toBe(expected);
		});

		it('preserves non-header lines', () => {
			const input = '# Header\nRegular text\n## Subheader';
			const expected = '## Header\nRegular text\n### Subheader';
			expect(indentHeaders(input)).toBe(expected);
		});

		it('requires space after #', () => {
			expect(indentHeaders('#NoSpace')).toBe('#NoSpace');
			expect(indentHeaders('# Space')).toBe('## Space');
		});

		it('handles empty string', () => {
			expect(indentHeaders('')).toBe('');
		});

		it('handles headers with extra spaces', () => {
			expect(indentHeaders('##  Header')).toBe('###  Header');
		});
	});

	describe('formatRiffs', () => {
		it('formats single riff', () => {
			const riffs: Riff[] = [
				{
					name: 'test_riff',
					description: 'A test riff',
					input_schema: { type: 'object', properties: {} },
				},
			];

			const result = formatRiffs(riffs);
			expect(result).toContain('## test_riff');
			expect(result).toContain('A test riff');
			expect(result).toContain('"type": "object"');
		});

		it('formats multiple riffs with separator', () => {
			const riffs: Riff[] = [
				{
					name: 'riff1',
					description: 'First',
					input_schema: { type: 'object' },
				},
				{
					name: 'riff2',
					description: 'Second',
					input_schema: { type: 'object' },
				},
			];

			const result = formatRiffs(riffs);
			expect(result).toContain('## riff1');
			expect(result).toContain('## riff2');
			expect(result).toContain('\n\n---\n\n');
		});

		it('indents headers in riff descriptions twice', () => {
			const riffs: Riff[] = [
				{
					name: 'test_riff',
					description: '# Description\n## Details',
					input_schema: { type: 'object' },
				},
			];

			const result = formatRiffs(riffs);
			// Headers should be indented twice: # -> ## -> ###, ## -> ### -> ####
			expect(result).toContain('### Description');
			expect(result).toContain('#### Details');
		});

		it('formats empty riffs array', () => {
			const result = formatRiffs([]);
			expect(result).toBe('');
		});

		it('formats schema with proper indentation', () => {
			const riffs: Riff[] = [
				{
					name: 'test_riff',
					description: 'Test',
					input_schema: {
						type: 'object',
						properties: {
							field: { type: 'string' },
						},
					},
				},
			];

			const result = formatRiffs(riffs);
			expect(result).toContain('  "type": "object"');
			expect(result).toContain('  "properties"');
		});
	});

	describe('formatOutput', () => {
		it('formats complete output document', () => {
			const data = {
				versionLabel: '1.0.0',
				releaseDate: '2024-01-01',
				userMessage: 'Test message',
				systemPrompt: 'You are Claude',
				riffs: [
					{
						name: 'riff1',
						description: 'A riff',
						input_schema: { type: 'object' },
					},
				],
			};

			const result = formatOutput(data);

			expect(result).toContain('# Anthropic Coding CLI Version 1.0.0');
			expect(result).toContain('Release Date: 2024-01-01');
			expect(result).toContain('# User Message');
			expect(result).toContain('Test message');
			expect(result).toContain('# System Prompt');
			expect(result).toContain('You are Claude');
			expect(result).toContain('# Riffs');
			expect(result).toContain('## riff1');
		});

		it('indents user message headers', () => {
			const data = {
				versionLabel: '1.0.0',
				releaseDate: '2024-01-01',
				userMessage: '# User Header\nContent',
				systemPrompt: 'System',
				riffs: [],
			};

			const result = formatOutput(data);
			expect(result).toContain('## User Header');
		});

		it('indents system prompt headers', () => {
			const data = {
				versionLabel: '1.0.0',
				releaseDate: '2024-01-01',
				userMessage: 'User',
				systemPrompt: '# System Header\nContent',
				riffs: [],
			};

			const result = formatOutput(data);
			expect(result).toContain('## System Header');
		});

		it('handles empty riffs array', () => {
			const data = {
				versionLabel: '1.0.0',
				releaseDate: '2024-01-01',
				userMessage: 'Test',
				systemPrompt: 'System',
				riffs: [],
			};

			const result = formatOutput(data);
			expect(result).toContain('# Riffs');
			// Should have riffs section but empty content
			expect(result.split('# Riffs')[1].trim()).toBe('');
		});

		it('formats custom binary label', () => {
			const data = {
				versionLabel: 'Custom Binary (prompts-custom-2024.md)',
				releaseDate: 'Custom Binary',
				userMessage: 'Test',
				systemPrompt: 'System',
				riffs: [],
			};

			const result = formatOutput(data);
			expect(result).toContain('# Anthropic Coding CLI Version Custom Binary (prompts-custom-2024.md)');
			expect(result).toContain('Release Date: Custom Binary');
		});

		it('includes proper spacing between sections', () => {
			const data = {
				versionLabel: '1.0.0',
				releaseDate: '2024-01-01',
				userMessage: 'User',
				systemPrompt: 'System',
				riffs: [],
			};

			const result = formatOutput(data);

			// Check for blank lines between sections
			expect(result).toContain('Release Date: 2024-01-01\n\n# User Message');
			expect(result).toContain('User\n\n# System Prompt');
			expect(result).toContain('System\n\n# Riffs');
		});
	});
});
