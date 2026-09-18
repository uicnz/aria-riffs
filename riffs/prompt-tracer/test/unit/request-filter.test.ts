import { describe, expect, it } from 'vitest';
import {
	filterAndSortRiffs,
	filterNonHaikuRequests,
	filterRequestsWithRiffs,
	filterRequestsWithSystemPrompt,
	hasRiffs,
	hasSystemPrompt,
	selectBestRequest,
} from '../../src/core/request-filter.js';
import type { RequestBody, RequestResponsePair, Riff } from '../../src/lib/types.js';

describe('request-filter', () => {
	describe('filterNonHaikuRequests', () => {
		it('filters out haiku models', () => {
			const pairs: RequestResponsePair[] = [
				{
					request: {
						timestamp: 1,
						method: 'POST',
						url: '/',
						headers: {},
						body: { model: 'claude-3-haiku-20240307', messages: [] },
					},
					response: {},
				},
				{
					request: {
						timestamp: 2,
						method: 'POST',
						url: '/',
						headers: {},
						body: { model: 'claude-3-5-sonnet-20241022', messages: [] },
					},
					response: {},
				},
			];

			const result = filterNonHaikuRequests(pairs);
			expect(result).toHaveLength(1);
			expect(result[0].request.body.model).toBe('claude-3-5-sonnet-20241022');
		});

		it('handles case-insensitive haiku detection', () => {
			const pairs: RequestResponsePair[] = [
				{
					request: {
						timestamp: 1,
						method: 'POST',
						url: '/',
						headers: {},
						body: { model: 'claude-HAIKU-test', messages: [] },
					},
					response: {},
				},
				{
					request: {
						timestamp: 2,
						method: 'POST',
						url: '/',
						headers: {},
						body: { model: 'claude-sonnet', messages: [] },
					},
					response: {},
				},
			];

			const result = filterNonHaikuRequests(pairs);
			expect(result).toHaveLength(1);
			expect(result[0].request.body.model).toBe('claude-sonnet');
		});

		it('returns all non-haiku models', () => {
			const pairs: RequestResponsePair[] = [
				{
					request: {
						timestamp: 1,
						method: 'POST',
						url: '/',
						headers: {},
						body: { model: 'claude-sonnet-1', messages: [] },
					},
					response: {},
				},
				{
					request: {
						timestamp: 2,
						method: 'POST',
						url: '/',
						headers: {},
						body: { model: 'claude-sonnet-2', messages: [] },
					},
					response: {},
				},
			];

			const result = filterNonHaikuRequests(pairs);
			expect(result).toHaveLength(2);
		});
	});

	describe('filterRequestsWithRiffs', () => {
		it('filters requests with riffs', () => {
			const pairs: RequestResponsePair[] = [
				{
					request: {
						timestamp: 1,
						method: 'POST',
						url: '/',
						headers: {},
						body: { model: 'claude', messages: [], riffs: [] },
					},
					response: {},
				},
				{
					request: {
						timestamp: 2,
						method: 'POST',
						url: '/',
						headers: {},
						body: {
							model: 'claude',
							messages: [],
							riffs: [
								{
									name: 'riff1',
									description: 'desc',
									input_schema: { type: 'object' },
								},
							],
						},
					},
					response: {},
				},
			];

			const result = filterRequestsWithRiffs(pairs);
			expect(result).toHaveLength(1);
			expect(result[0].request.body.riffs).toHaveLength(1);
		});

		it('excludes requests with empty riffs array', () => {
			const pairs: RequestResponsePair[] = [
				{
					request: {
						timestamp: 1,
						method: 'POST',
						url: '/',
						headers: {},
						body: { model: 'claude', messages: [], riffs: [] },
					},
					response: {},
				},
			];

			const result = filterRequestsWithRiffs(pairs);
			expect(result).toHaveLength(0);
		});

		it('excludes requests without riffs property', () => {
			const pairs: RequestResponsePair[] = [
				{
					request: {
						timestamp: 1,
						method: 'POST',
						url: '/',
						headers: {},
						body: { model: 'claude', messages: [] },
					},
					response: {},
				},
			];

			const result = filterRequestsWithRiffs(pairs);
			expect(result).toHaveLength(0);
		});
	});

	describe('filterRequestsWithSystemPrompt', () => {
		it('filters requests with system prompt', () => {
			const pairs: RequestResponsePair[] = [
				{
					request: {
						timestamp: 1,
						method: 'POST',
						url: '/',
						headers: {},
						body: { model: 'claude', messages: [] },
					},
					response: {},
				},
				{
					request: {
						timestamp: 2,
						method: 'POST',
						url: '/',
						headers: {},
						body: {
							model: 'claude',
							messages: [],
							system: [{ type: 'text', text: 'You are Claude' }],
						},
					},
					response: {},
				},
			];

			const result = filterRequestsWithSystemPrompt(pairs);
			expect(result).toHaveLength(1);
			expect(result[0].request.body.system).toBeDefined();
		});

		it('excludes requests with empty system array', () => {
			const pairs: RequestResponsePair[] = [
				{
					request: {
						timestamp: 1,
						method: 'POST',
						url: '/',
						headers: {},
						body: { model: 'claude', messages: [], system: [] },
					},
					response: {},
				},
			];

			const result = filterRequestsWithSystemPrompt(pairs);
			expect(result).toHaveLength(0);
		});

		it('excludes requests without system property', () => {
			const pairs: RequestResponsePair[] = [
				{
					request: {
						timestamp: 1,
						method: 'POST',
						url: '/',
						headers: {},
						body: { model: 'claude', messages: [] },
					},
					response: {},
				},
			];

			const result = filterRequestsWithSystemPrompt(pairs);
			expect(result).toHaveLength(0);
		});
	});

	describe('selectBestRequest', () => {
		it('selects request with most riffs', () => {
			const pairs: RequestResponsePair[] = [
				{
					request: {
						timestamp: 1,
						method: 'POST',
						url: '/',
						headers: {},
						body: {
							model: 'claude-sonnet',
							messages: [],
							riffs: [
								{
									name: 'riff1',
									description: 'desc',
									input_schema: { type: 'object' },
								},
							],
						},
					},
					response: {},
				},
				{
					request: {
						timestamp: 2,
						method: 'POST',
						url: '/',
						headers: {},
						body: {
							model: 'claude-sonnet',
							messages: [],
							riffs: [
								{
									name: 'riff1',
									description: 'desc',
									input_schema: { type: 'object' },
								},
								{
									name: 'riff2',
									description: 'desc',
									input_schema: { type: 'object' },
								},
							],
						},
					},
					response: {},
				},
			];

			const result = selectBestRequest(pairs);
			expect(result.request.body.riffs).toHaveLength(2);
		});

		it('falls back to non-haiku request when no riffs found', () => {
			const pairs: RequestResponsePair[] = [
				{
					request: {
						timestamp: 1,
						method: 'POST',
						url: '/',
						headers: {},
						body: { model: 'claude-haiku', messages: [] },
					},
					response: {},
				},
				{
					request: {
						timestamp: 2,
						method: 'POST',
						url: '/',
						headers: {},
						body: { model: 'claude-sonnet', messages: [] },
					},
					response: {},
				},
			];

			const result = selectBestRequest(pairs);
			expect(result.request.body.model).toBe('claude-sonnet');
		});

		it('throws error when no non-haiku request found', () => {
			const pairs: RequestResponsePair[] = [
				{
					request: {
						timestamp: 1,
						method: 'POST',
						url: '/',
						headers: {},
						body: { model: 'claude-haiku', messages: [] },
					},
					response: {},
				},
			];

			expect(() => selectBestRequest(pairs)).toThrow('No non-Haiku request found in the log');
		});

		it('filters out haiku before selecting best', () => {
			const pairs: RequestResponsePair[] = [
				{
					request: {
						timestamp: 1,
						method: 'POST',
						url: '/',
						headers: {},
						body: {
							model: 'claude-haiku',
							messages: [],
							riffs: [
								{
									name: 'riff1',
									description: 'desc',
									input_schema: { type: 'object' },
								},
								{
									name: 'riff2',
									description: 'desc',
									input_schema: { type: 'object' },
								},
								{
									name: 'riff3',
									description: 'desc',
									input_schema: { type: 'object' },
								},
							],
						},
					},
					response: {},
				},
				{
					request: {
						timestamp: 2,
						method: 'POST',
						url: '/',
						headers: {},
						body: {
							model: 'claude-sonnet',
							messages: [],
							riffs: [
								{
									name: 'riff1',
									description: 'desc',
									input_schema: { type: 'object' },
								},
							],
						},
					},
					response: {},
				},
			];

			const result = selectBestRequest(pairs);
			// Should select sonnet even though haiku has more riffs
			expect(result.request.body.model).toBe('claude-sonnet');
		});

		it('handles requests with undefined riffs in sorting', () => {
			const pairs: RequestResponsePair[] = [
				{
					request: {
						timestamp: 1,
						method: 'POST',
						url: '/',
						headers: {},
						body: {
							model: 'claude-sonnet',
							messages: [],
							riffs: [
								{
									name: 'riff1',
									description: 'desc',
									input_schema: { type: 'object' },
								},
							],
						},
					},
					response: {},
				},
				{
					request: {
						timestamp: 2,
						method: 'POST',
						url: '/',
						headers: {},
						body: {
							model: 'claude-sonnet',
							messages: [],
							// riffs property exists but is undefined (edge case)
							riffs: undefined,
						} as RequestBody,
					},
					response: {},
				},
			];

			// Should handle undefined riffs gracefully during sort
			const result = selectBestRequest(pairs);
			expect(result.request.body.riffs).toHaveLength(1);
		});
	});

	describe('selectBestRequest - system prompt prioritization', () => {
		it('selects request with riffs AND system prompt over riffs-only', () => {
			const pairs: RequestResponsePair[] = [
				{
					request: {
						timestamp: 1,
						method: 'POST',
						url: '/',
						headers: {},
						body: {
							model: 'claude-sonnet',
							messages: [],
							riffs: [
								{ name: 'riff1', description: 'desc', input_schema: { type: 'object' } },
								{ name: 'riff2', description: 'desc', input_schema: { type: 'object' } },
							],
						},
					},
					response: {},
				},
				{
					request: {
						timestamp: 2,
						method: 'POST',
						url: '/',
						headers: {},
						body: {
							model: 'claude-sonnet',
							messages: [],
							riffs: [{ name: 'riff1', description: 'desc', input_schema: { type: 'object' } }],
							system: [{ type: 'text', text: 'You are Claude' }],
						},
					},
					response: {},
				},
			];

			const result = selectBestRequest(pairs);
			// Should select request with system prompt even though it has fewer riffs
			expect(result.request.body.system).toBeDefined();
			expect(result.request.body.riffs).toHaveLength(1);
		});

		it('falls back to riffs-only when no system prompt exists', () => {
			const pairs: RequestResponsePair[] = [
				{
					request: {
						timestamp: 1,
						method: 'POST',
						url: '/',
						headers: {},
						body: { model: 'claude-haiku', messages: [] },
					},
					response: {},
				},
				{
					request: {
						timestamp: 2,
						method: 'POST',
						url: '/',
						headers: {},
						body: {
							model: 'claude-sonnet',
							messages: [],
							riffs: [{ name: 'riff1', description: 'desc', input_schema: { type: 'object' } }],
						},
					},
					response: {},
				},
			];

			const result = selectBestRequest(pairs);
			expect(result.request.body.riffs).toHaveLength(1);
			expect(result.request.body.system).toBeUndefined();
		});

		it('selects highest riff count among requests with system prompts', () => {
			const pairs: RequestResponsePair[] = [
				{
					request: {
						timestamp: 1,
						method: 'POST',
						url: '/',
						headers: {},
						body: {
							model: 'claude-sonnet',
							messages: [],
							riffs: [{ name: 'riff1', description: 'desc', input_schema: { type: 'object' } }],
							system: [{ type: 'text', text: 'You are Claude' }],
						},
					},
					response: {},
				},
				{
					request: {
						timestamp: 2,
						method: 'POST',
						url: '/',
						headers: {},
						body: {
							model: 'claude-sonnet',
							messages: [],
							riffs: [
								{ name: 'riff1', description: 'desc', input_schema: { type: 'object' } },
								{ name: 'riff2', description: 'desc', input_schema: { type: 'object' } },
								{ name: 'riff3', description: 'desc', input_schema: { type: 'object' } },
							],
							system: [{ type: 'text', text: 'You are Claude' }],
						},
					},
					response: {},
				},
			];

			const result = selectBestRequest(pairs);
			expect(result.request.body.riffs).toHaveLength(3);
			expect(result.request.body.system).toBeDefined();
		});

		it('handles edge case where system is empty array', () => {
			const pairs: RequestResponsePair[] = [
				{
					request: {
						timestamp: 1,
						method: 'POST',
						url: '/',
						headers: {},
						body: {
							model: 'claude-sonnet',
							messages: [],
							riffs: [{ name: 'riff1', description: 'desc', input_schema: { type: 'object' } }],
							system: [],
						},
					},
					response: {},
				},
			];

			const result = selectBestRequest(pairs);
			// Should still select it (falls back to riffs-only tier)
			expect(result.request.body.riffs).toHaveLength(1);
		});
	});

	describe('filterAndSortRiffs', () => {
		it('filters out mcp__ riffs', () => {
			const riffs: Riff[] = [
				{
					name: 'mcp__riff1',
					description: 'desc',
					input_schema: { type: 'object' },
				},
				{
					name: 'regular_riff',
					description: 'desc',
					input_schema: { type: 'object' },
				},
				{
					name: 'mcp__riff2',
					description: 'desc',
					input_schema: { type: 'object' },
				},
			];

			const result = filterAndSortRiffs(riffs);
			expect(result).toHaveLength(1);
			expect(result[0].name).toBe('regular_riff');
		});

		it('sorts riffs alphabetically by name', () => {
			const riffs: Riff[] = [
				{
					name: 'zebra',
					description: 'desc',
					input_schema: { type: 'object' },
				},
				{
					name: 'alpha',
					description: 'desc',
					input_schema: { type: 'object' },
				},
				{
					name: 'beta',
					description: 'desc',
					input_schema: { type: 'object' },
				},
			];

			const result = filterAndSortRiffs(riffs);
			expect(result.map(t => t.name)).toEqual(['alpha', 'beta', 'zebra']);
		});

		it('returns empty array for undefined riffs', () => {
			const result = filterAndSortRiffs(undefined);
			expect(result).toEqual([]);
		});

		it('returns empty array for empty riffs array', () => {
			const result = filterAndSortRiffs([]);
			expect(result).toEqual([]);
		});
	});

	describe('hasRiffs', () => {
		it('returns true when request has riffs', () => {
			const pair: RequestResponsePair = {
				request: {
					timestamp: 1,
					method: 'POST',
					url: '/',
					headers: {},
					body: {
						model: 'claude',
						messages: [],
						riffs: [
							{
								name: 'riff1',
								description: 'desc',
								input_schema: { type: 'object' },
							},
						],
					},
				},
				response: {},
			};

			expect(hasRiffs(pair)).toBe(true);
		});

		it('returns false when riffs array is empty', () => {
			const pair: RequestResponsePair = {
				request: {
					timestamp: 1,
					method: 'POST',
					url: '/',
					headers: {},
					body: { model: 'claude', messages: [], riffs: [] },
				},
				response: {},
			};

			expect(hasRiffs(pair)).toBe(false);
		});

		it('returns false when riffs is undefined', () => {
			const pair: RequestResponsePair = {
				request: {
					timestamp: 1,
					method: 'POST',
					url: '/',
					headers: {},
					body: { model: 'claude', messages: [] },
				},
				response: {},
			};

			expect(hasRiffs(pair)).toBe(false);
		});
	});

	describe('hasSystemPrompt', () => {
		it('returns true when request has system prompt', () => {
			const pair: RequestResponsePair = {
				request: {
					timestamp: 1,
					method: 'POST',
					url: '/',
					headers: {},
					body: {
						model: 'claude',
						messages: [],
						system: [{ type: 'text', text: 'You are Claude' }],
					},
				},
				response: {},
			};

			expect(hasSystemPrompt(pair)).toBe(true);
		});

		it('returns false when system array is empty', () => {
			const pair: RequestResponsePair = {
				request: {
					timestamp: 1,
					method: 'POST',
					url: '/',
					headers: {},
					body: { model: 'claude', messages: [], system: [] },
				},
				response: {},
			};

			expect(hasSystemPrompt(pair)).toBe(false);
		});

		it('returns false when system is undefined', () => {
			const pair: RequestResponsePair = {
				request: {
					timestamp: 1,
					method: 'POST',
					url: '/',
					headers: {},
					body: { model: 'claude', messages: [] },
				},
				response: {},
			};

			expect(hasSystemPrompt(pair)).toBe(false);
		});
	});
});
