/**
 * Integration tests for the full extraction flow
 * Tests the complete path: JSONL parsing → request selection → content extraction
 */

import { describe, expect, it } from 'vitest';
import { extractSystemPrompt, findAndExtractUserMessage } from '../../src/core/content-extractor.js';
import { selectBestRequest } from '../../src/core/request-filter.js';
import type { RequestResponsePair } from '../../src/lib/types.js';

const foreignBrandWord = 'Claude';
const upstreamCodingCliName = `${foreignBrandWord} Code`;

describe('E2E Integration - Full Extraction Flow', () => {
	it('handles current string content format end-to-end', () => {
		// Simulate the actual JSONL log data from the current upstream coding CLI format
		const mockJsonlData: RequestResponsePair[] = [
			{
				request: {
					timestamp: 1,
					method: 'POST',
					url: '/v1/messages',
					headers: {},
					body: {
						model: 'claude-3-haiku-20240307',
						messages: [
							{
								role: 'user',
								content: 'Check quota', // String format (Haiku quota check)
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
					url: '/v1/messages',
					headers: {},
					body: {
						model: 'claude-3-5-sonnet-20241022',
						messages: [
							{
								role: 'user',
								content: 'Write a haiku about the date', // String format (actual user message)
							},
						],
						system: [
							{
								type: 'text',
								text: `You are ${upstreamCodingCliName}, an AI assistant.`,
							},
						],
						riffs: [
							{
								name: 'Read',
								description: 'Read a file',
								input_schema: { type: 'object' },
							},
							{
								name: 'Write',
								description: 'Write a file',
								input_schema: { type: 'object' },
							},
						],
					},
				},
				response: {},
			},
		];

		// Step 1: Select the best request (should skip Haiku, select Sonnet with riffs + system)
		const selectedRequest = selectBestRequest(mockJsonlData);

		// Verify we selected the Sonnet request
		expect(selectedRequest.request.body.model).toBe('claude-3-5-sonnet-20241022');

		// Step 2: Extract user message (this is where the bug would occur if not fixed)
		const userMessage = findAndExtractUserMessage(selectedRequest.request.body.messages);

		// Verify extraction worked with string content
		expect(userMessage).toBe('Write a haiku about the date');

		// Step 3: Extract system prompt
		const systemPrompt = extractSystemPrompt(selectedRequest.request.body);

		// Verify system prompt extraction
		expect(systemPrompt).toBe(`You are ${upstreamCodingCliName}, an AI assistant.`);

		// Verify we have riffs
		expect(selectedRequest.request.body.riffs).toHaveLength(2);
	});

	it('handles older array content format end-to-end', () => {
		// Simulate the actual JSONL log data from older upstream CLI versions
		const mockJsonlData: RequestResponsePair[] = [
			{
				request: {
					timestamp: 1,
					method: 'POST',
					url: '/v1/messages',
					headers: {},
					body: {
						model: 'claude-3-haiku-20240307',
						messages: [
							{
								role: 'user',
								content: [
									{
										type: 'text',
										text: 'Check quota',
									},
								],
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
					url: '/v1/messages',
					headers: {},
					body: {
						model: 'claude-3-5-sonnet-20241022',
						messages: [
							{
								role: 'user',
								content: [
									{
										type: 'text',
										text: 'Write a haiku about the date',
									},
								],
							},
						],
						system: [
							{
								type: 'text',
								text: `You are ${upstreamCodingCliName}, an AI assistant.`,
							},
						],
						riffs: [
							{
								name: 'Read',
								description: 'Read a file',
								input_schema: { type: 'object' },
							},
						],
					},
				},
				response: {},
			},
		];

		// Full extraction flow
		const selectedRequest = selectBestRequest(mockJsonlData);
		const userMessage = findAndExtractUserMessage(selectedRequest.request.body.messages);
		const systemPrompt = extractSystemPrompt(selectedRequest.request.body);

		// Verify everything works with array content
		expect(selectedRequest.request.body.model).toBe('claude-3-5-sonnet-20241022');
		expect(userMessage).toBe('Write a haiku about the date');
		expect(systemPrompt).toBe(`You are ${upstreamCodingCliName}, an AI assistant.`);
		expect(selectedRequest.request.body.riffs).toHaveLength(1);
	});

	it('handles mixed content with multiple text blocks', () => {
		const mockJsonlData: RequestResponsePair[] = [
			{
				request: {
					timestamp: 1,
					method: 'POST',
					url: '/v1/messages',
					headers: {},
					body: {
						model: 'claude-3-5-sonnet-20241022',
						messages: [
							{
								role: 'user',
								content: [
									{
										type: 'text',
										text: 'First part',
									},
									{
										type: 'text',
										text: 'Second part',
									},
								],
							},
						],
						system: [
							{
								type: 'text',
								text: 'System part 1',
							},
							{
								type: 'text',
								text: 'System part 2',
							},
						],
						riffs: [
							{
								name: 'Read',
								description: 'Read a file',
								input_schema: { type: 'object' },
							},
						],
					},
				},
				response: {},
			},
		];

		const selectedRequest = selectBestRequest(mockJsonlData);
		const userMessage = findAndExtractUserMessage(selectedRequest.request.body.messages);
		const systemPrompt = extractSystemPrompt(selectedRequest.request.body);

		// Verify multiple text blocks are joined with newlines
		expect(userMessage).toBe('First part\nSecond part');
		expect(systemPrompt).toBe('System part 1\nSystem part 2');
	});

	it('prioritizes requests with system prompts in E2E flow', () => {
		const mockJsonlData: RequestResponsePair[] = [
			{
				request: {
					timestamp: 1,
					method: 'POST',
					url: '/v1/messages',
					headers: {},
					body: {
						model: 'claude-3-5-sonnet-20241022',
						messages: [
							{
								role: 'user',
								content: 'Test message',
							},
						],
						riffs: [
							{ name: 'Riff1', description: 'desc', input_schema: { type: 'object' } },
							{ name: 'Riff2', description: 'desc', input_schema: { type: 'object' } },
							{ name: 'Riff3', description: 'desc', input_schema: { type: 'object' } },
						],
					},
				},
				response: {},
			},
			{
				request: {
					timestamp: 2,
					method: 'POST',
					url: '/v1/messages',
					headers: {},
					body: {
						model: 'claude-3-5-sonnet-20241022',
						messages: [
							{
								role: 'user',
								content: 'Test message with system',
							},
						],
						system: [
							{
								type: 'text',
								text: 'You are an AI assistant.',
							},
						],
						riffs: [{ name: 'Riff1', description: 'desc', input_schema: { type: 'object' } }],
					},
				},
				response: {},
			},
		];

		// Should select request with system prompt even though it has fewer riffs
		const selectedRequest = selectBestRequest(mockJsonlData);
		const userMessage = findAndExtractUserMessage(selectedRequest.request.body.messages);
		const systemPrompt = extractSystemPrompt(selectedRequest.request.body);

		expect(selectedRequest.request.body.riffs).toHaveLength(1);
		expect(systemPrompt).toBe('You are an AI assistant.');
		expect(userMessage).toBe('Test message with system');
	});

	it('handles edge case with no user message', () => {
		const mockJsonlData: RequestResponsePair[] = [
			{
				request: {
					timestamp: 1,
					method: 'POST',
					url: '/v1/messages',
					headers: {},
					body: {
						model: 'claude-3-5-sonnet-20241022',
						messages: [
							{
								role: 'assistant',
								content: 'Only assistant message',
							},
						],
						riffs: [{ name: 'Riff1', description: 'desc', input_schema: { type: 'object' } }],
					},
				},
				response: {},
			},
		];

		const selectedRequest = selectBestRequest(mockJsonlData);
		const userMessage = findAndExtractUserMessage(selectedRequest.request.body.messages);

		// Should return empty string when no user message found
		expect(userMessage).toBe('');
	});

	it('handles edge case with empty content array', () => {
		const mockJsonlData: RequestResponsePair[] = [
			{
				request: {
					timestamp: 1,
					method: 'POST',
					url: '/v1/messages',
					headers: {},
					body: {
						model: 'claude-3-5-sonnet-20241022',
						messages: [
							{
								role: 'user',
								content: [],
							},
						],
						riffs: [{ name: 'Riff1', description: 'desc', input_schema: { type: 'object' } }],
					},
				},
				response: {},
			},
		];

		const selectedRequest = selectBestRequest(mockJsonlData);
		const userMessage = findAndExtractUserMessage(selectedRequest.request.body.messages);

		// Should return empty string for empty content array
		expect(userMessage).toBe('');
	});
});
