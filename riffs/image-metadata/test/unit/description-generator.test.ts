import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock ai-sdk
vi.mock('ai', () => ({
	generateText: vi.fn(),
}));

// Mock @ai-sdk/anthropic
vi.mock('@ai-sdk/anthropic', () => ({
	createAnthropic: vi.fn(),
}));

// Mock @ai-sdk/google
vi.mock('@ai-sdk/google', () => ({
	createGoogleGenerativeAI: vi.fn(),
}));

// Mock ai-sdk-ollama
vi.mock('ai-sdk-ollama', () => ({
	createOllama: vi.fn(),
}));

// Mock Ollama SDK with hoisted pattern to work with constructor
const { MockedOllama, setOllamaListMock } = vi.hoisted(() => {
	let listFn: ReturnType<typeof vi.fn> = vi.fn();
	const MockedConstructor = vi.fn(function (this: unknown) {
		return { list: listFn };
	});
	return {
		MockedOllama: MockedConstructor,
		setOllamaListMock: (fn: ReturnType<typeof vi.fn>) => {
			listFn = fn;
		},
	};
});

vi.mock('ollama', () => ({
	Ollama: MockedOllama,
}));

// Mock config with loadConfig
vi.mock('../../src/lib/config', () => ({
	loadConfig: vi.fn(),
}));

vi.mock('../../src/utils/utils', () => ({
	encodeImageToBase64: vi.fn(),
}));

import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
// Import mocked modules
import { generateText } from 'ai';
import { createOllama } from 'ai-sdk-ollama';
import { cleanImageDescription, DescriptionGenerator, normalizePrompt } from '../../src/core/description-generator.js';
import { loadConfig } from '../../src/lib/config.js';
import { encodeImageToBase64 } from '../../src/utils/utils.js';

const mockedGenerateText = vi.mocked(generateText);
const mockedCreateAnthropic = vi.mocked(createAnthropic);
const mockedCreateGoogleGenerativeAI = vi.mocked(createGoogleGenerativeAI);
const mockedCreateOllama = vi.mocked(createOllama);
const mockedFetch = vi.fn<typeof fetch>();
const mockedLoadConfig = vi.mocked(loadConfig);
const mockedEncodeImageToBase64 = vi.mocked(encodeImageToBase64);

function jsonResponse(data: unknown): Response {
	return new Response(JSON.stringify(data), {
		status: 200,
		headers: { 'content-type': 'application/json' },
	});
}

// Helper to create config for different providers
function createMockConfig(provider: 'ollama' | 'anthropic' | 'gemini') {
	return {
		'image-metadata': {
			paths: { input: { dir: './images' }, database: { file: '.aria/db/test.db' } },
			llm: {
				provider,
			},
			database: { backupCount: 3, journalMode: 'DELETE' },
			images: { supportedExtensions: ['.png', '.jpg'], maxFileSizeMb: 50 },
			metadata: { retryAttempts: 3, retryDelay: 1.0 },
			processing: { batchSize: 10, progressBar: true },
		},
		logging: {
			level: 'info' as const,
			verbose: false,
			file: '.aria/logs/test/image-metadata-llm.log',
			maxFileSizeMb: 10,
			maxFiles: 7,
		},
		llmProviders: {
			ollama: {
				endpoint: 'http://localhost:11434/api',
				model: 'llava',
				timeout: 30,
				keepAlive: 5,
				prompt: 'Test Ollama prompt for AI SDK',
			},
			anthropic: {
				apiKey: 'test-api-key',
				model: 'claude-3-5-sonnet-20241022',
				timeout: 30,
				maxTokens: 1024,
				baseUrl: 'https://api.anthropic.com/v1',
				prompt: 'Test Anthropic prompt for AI SDK',
			},
			gemini: {
				apiKey: 'test-google-key',
				model: 'gemini-2.5-flash',
				timeout: 30,
				maxTokens: 1024,
				baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
				prompt: 'Test Gemini prompt for AI SDK',
			},
		},
	};
}

describe('LLM Client Module', () => {
	describe('DescriptionGenerator', () => {
		let client: DescriptionGenerator;

		beforeEach(() => {
			vi.clearAllMocks();
			vi.stubGlobal('fetch', mockedFetch);

			// Default to ollama provider
			mockedLoadConfig.mockReturnValue(createMockConfig('ollama'));

			// Mock anthropic client creation
			const mockAnthropicModel = vi.fn();
			const mockAnthropicClient = vi.fn(() => mockAnthropicModel);
			mockedCreateAnthropic.mockReturnValue(mockAnthropicClient as unknown as ReturnType<typeof createAnthropic>);

			// Mock gemini client creation
			const mockGeminiModel = vi.fn();
			const mockGeminiClient = vi.fn(() => mockGeminiModel);
			mockedCreateGoogleGenerativeAI.mockReturnValue(
				mockGeminiClient as unknown as ReturnType<typeof createGoogleGenerativeAI>
			);

			// Mock ollama client creation
			const mockOllamaModel = vi.fn();
			const mockOllamaClient = vi.fn(() => mockOllamaModel);
			const mockOllamaProvider = {
				languageModel: mockOllamaClient,
			} as unknown as ReturnType<typeof createOllama>;
			mockedCreateOllama.mockReturnValue(mockOllamaProvider);

			// Mock utils
			mockedEncodeImageToBase64.mockResolvedValue('base64encoded image');

			client = new DescriptionGenerator();
		});

		afterEach(() => {
			vi.restoreAllMocks();
			vi.unstubAllGlobals();
		});

		describe('constructor', () => {
			it('given ollama provider config, when DescriptionGenerator constructed, then should initialize with correct configuration', () => {
				// Since provider is 'ollama', only Ollama client should be initialized
				expect(mockedCreateOllama).toHaveBeenCalledWith(
					expect.objectContaining({
						baseURL: 'http://localhost:11434/api',
					})
				);
				// Anthropic should NOT be initialized when provider is ollama
				expect(mockedCreateAnthropic).not.toHaveBeenCalled();
			});

			it('given anthropic provider config, when DescriptionGenerator constructed, then should initialize with correct configuration', () => {
				// Override provider to anthropic
				mockedLoadConfig.mockReturnValue(createMockConfig('anthropic'));

				const anthropicClient = new DescriptionGenerator();

				expect(anthropicClient).toBeInstanceOf(DescriptionGenerator);
				expect(mockedCreateAnthropic).toHaveBeenCalledWith(
					expect.objectContaining({
						apiKey: 'test-api-key',
						baseURL: 'https://api.anthropic.com/v1',
					})
				);
			});

			it('given gemini provider config, when DescriptionGenerator constructed, then should initialize with correct configuration', () => {
				// Override provider to gemini
				mockedLoadConfig.mockReturnValue(createMockConfig('gemini'));

				const geminiClient = new DescriptionGenerator();

				expect(geminiClient).toBeInstanceOf(DescriptionGenerator);
				expect(mockedCreateGoogleGenerativeAI).toHaveBeenCalledWith(
					expect.objectContaining({
						apiKey: 'test-google-key',
					})
				);
			});
		});

		describe('generateDescription', () => {
			it('given anthropic provider configured, when generateDescription called, then should generate description using Anthropic', async () => {
				mockedLoadConfig.mockReturnValue(createMockConfig('anthropic'));

				const newClient = new DescriptionGenerator();

				const mockResult = {
					text: 'Generated description from Anthropic via AI SDK',
				} as unknown as Awaited<ReturnType<typeof generateText>>;
				mockedGenerateText.mockResolvedValue(mockResult);

				const result = await newClient.generateDescription('/path/to/image.jpg');

				expect(result).toBe('Generated description from Anthropic via AI SDK');
				expect(mockedEncodeImageToBase64).toHaveBeenCalledWith('/path/to/image.jpg');
			});

			it('given gemini provider configured, when generateDescription called, then should generate description using Gemini', async () => {
				mockedLoadConfig.mockReturnValue(createMockConfig('gemini'));

				const newClient = new DescriptionGenerator();

				const mockResult = {
					text: 'Generated description from Gemini via AI SDK',
				} as unknown as Awaited<ReturnType<typeof generateText>>;
				mockedGenerateText.mockResolvedValue(mockResult);

				const result = await newClient.generateDescription('/path/to/image.jpg');

				expect(result).toBe('Generated description from Gemini via AI SDK');
				expect(mockedEncodeImageToBase64).toHaveBeenCalledWith('/path/to/image.jpg');
			});

			it('given ollama provider configured, when generateDescription called, then should generate description using Ollama', async () => {
				const mockResult = {
					text: 'Generated description from Ollama via AI SDK',
				} as unknown as Awaited<ReturnType<typeof generateText>>;
				mockedGenerateText.mockResolvedValue(mockResult);

				const result = await client.generateDescription('/path/to/image.jpg');

				expect(result).toBe('Generated description from Ollama via AI SDK');
				expect(mockedEncodeImageToBase64).toHaveBeenCalledWith('/path/to/image.jpg');
			});

			it('given LLM output with description prefix, when generateDescription called, then should clean output', async () => {
				const mockResult = {
					text: "Here's a detailed description of the image:\n\nA portrait showing a person.",
				} as unknown as Awaited<ReturnType<typeof generateText>>;
				mockedGenerateText.mockResolvedValue(mockResult);

				const result = await client.generateDescription('/path/to/image.jpg');

				expect(result).toBe('A portrait showing a person.');
				expect(result).not.toContain("Here's a detailed description");
			});

			it('given LLM client throws error, when generateDescription called, then should propagate error', async () => {
				mockedGenerateText.mockRejectedValue(new Error('AI SDK generation failed'));

				await expect(client.generateDescription('/path/to/image.jpg')).rejects.toThrow(
					'Failed to generate description:'
				);
			});
		});

		describe('testConnection', () => {
			it('given successful LLM response, when testConnection called, then should return true', async () => {
				const mockResult = {
					text: 'Hi',
				} as unknown as Awaited<ReturnType<typeof generateText>>;
				mockedGenerateText.mockResolvedValue(mockResult);

				const result = await client.testConnection();

				expect(result).toBe(true);
			});

			it('given LLM fails, when testConnection called, then should return false', async () => {
				mockedGenerateText.mockRejectedValue(new Error('Connection failed'));

				const result = await client.testConnection();

				expect(result).toBe(false);
			});

			it('given anthropic client not initialized, when testConnection called, then should return false', async () => {
				// Mock config with empty API key
				const configWithNoKey = createMockConfig('anthropic');
				configWithNoKey.llmProviders.anthropic.apiKey = '';
				mockedLoadConfig.mockReturnValue(configWithNoKey);

				// Mock generateText to fail when API key is empty
				mockedGenerateText.mockRejectedValue(new Error('Invalid API key'));

				const newClient = new DescriptionGenerator();

				const result = await newClient.testConnection();

				expect(result).toBe(false);
			});
		});

		describe('getter methods', () => {
			it('given ollama provider, when modelName getter called, then should return correct model name', () => {
				expect(client.modelName).toBe('llava');
			});

			it('given ollama provider, when endpointUrl getter called, then should return correct endpoint URL', () => {
				expect(client.endpointUrl).toBe('http://localhost:11434/api');
			});

			it('given anthropic provider, when modelName and endpointUrl getters called, then should return correct values', () => {
				mockedLoadConfig.mockReturnValue(createMockConfig('anthropic'));

				const newClient = new DescriptionGenerator();
				expect(newClient.modelName).toBe('claude-3-5-sonnet-20241022');
				expect(newClient.endpointUrl).toBe('https://api.anthropic.com/v1');
			});

			it('given gemini provider, when modelName and endpointUrl getters called, then should return correct values', () => {
				mockedLoadConfig.mockReturnValue(createMockConfig('gemini'));

				const newClient = new DescriptionGenerator();
				expect(newClient.modelName).toBe('gemini-2.5-flash');
				expect(newClient.endpointUrl).toBe('https://generativelanguage.googleapis.com/v1beta');
			});
		});

		describe('listModels', () => {
			it('given Ollama provider with models available, when listModels called, then should return model list', async () => {
				const mockOllamaList = vi.fn();
				mockOllamaList.mockResolvedValue({
					models: [
						{
							name: 'llava-llama3:latest',
							size: 4661224676,
							modified_at: '2024-01-15T10:30:00Z',
							digest: 'sha256:abc123',
						},
						{
							name: 'mistral:latest',
							size: 4109865159,
							modified_at: '2024-01-10T08:20:00Z',
							digest: 'sha256:def456',
						},
					],
				});

				setOllamaListMock(mockOllamaList);

				const models = await client.listModels();

				expect(models).toHaveLength(2);
				expect(models[0]).toEqual({
					name: 'llava-llama3:latest',
					size: 4661224676,
					modified_at: '2024-01-15T10:30:00Z',
					digest: 'sha256:abc123',
				});
				expect(models[1]).toEqual({
					name: 'mistral:latest',
					size: 4109865159,
					modified_at: '2024-01-10T08:20:00Z',
					digest: 'sha256:def456',
				});
				expect(mockOllamaList).toHaveBeenCalled();
			});

			it('given Ollama model with Date modified_at, when listModels called, then should convert to ISO string', async () => {
				const mockDate = new Date('2024-01-15T10:30:00Z');
				const mockOllamaList = vi.fn();
				mockOllamaList.mockResolvedValue({
					models: [
						{
							name: 'llava:latest',
							size: 4661224676,
							modified_at: mockDate,
							digest: 'sha256:abc123',
						},
					],
				});

				setOllamaListMock(mockOllamaList);

				const models = await client.listModels();

				expect(models).toHaveLength(1);
				expect(models[0]?.modified_at).toBe(mockDate.toISOString());
			});

			it('given Anthropic provider configured, when listModels called, then should return models list', async () => {
				mockedLoadConfig.mockReturnValue(createMockConfig('anthropic'));

				mockedFetch.mockResolvedValue(
					jsonResponse({
						data: [
							{
								id: 'claude-3-5-sonnet-20241022',
								created_at: '2024-10-22',
								display_name: 'Claude 3.5 Sonnet',
							},
							{ id: 'claude-3-opus-20240229', created_at: '2024-02-29', display_name: 'Claude 3 Opus' },
							{
								id: 'claude-3-sonnet-20240229',
								created_at: '2024-02-29',
								display_name: 'Claude 3 Sonnet',
							},
						],
					})
				);

				const anthropicClient = new DescriptionGenerator();
				const models = await anthropicClient.listModels();

				expect(models).toHaveLength(3);
				expect(models[0]).toEqual({
					name: 'claude-3-5-sonnet-20241022',
					created_at: '2024-10-22',
					display_name: 'Claude 3.5 Sonnet',
				});
				expect(mockedFetch).toHaveBeenCalledWith(
					'https://api.anthropic.com/v1/models',
					expect.objectContaining({
						headers: expect.objectContaining({
							'x-api-key': 'test-api-key',
							'anthropic-version': '2023-06-01',
						}),
					})
				);
			});

			it('given Ollama provider fails, when listModels called, then should throw error', async () => {
				const mockOllamaList = vi.fn();
				mockOllamaList.mockRejectedValue(new Error('Connection failed'));

				setOllamaListMock(mockOllamaList);

				await expect(client.listModels()).rejects.toThrow('Failed to list models from ollama');
			});

			it('given Anthropic API fails, when listModels called, then should throw error', async () => {
				mockedLoadConfig.mockReturnValue(createMockConfig('anthropic'));

				mockedFetch.mockRejectedValue(new Error('API error'));

				const anthropicClient = new DescriptionGenerator();
				await expect(anthropicClient.listModels()).rejects.toThrow('Failed to list models from anthropic');
			});

			it('given Ollama with no models, when listModels called, then should return empty array', async () => {
				const mockOllamaList = vi.fn();
				mockOllamaList.mockResolvedValue({
					models: [],
				});

				setOllamaListMock(mockOllamaList);

				const models = await client.listModels();

				expect(models).toHaveLength(0);
				expect(models).toEqual([]);
			});

			it('given Gemini provider configured, when listModels called, then should return models list', async () => {
				mockedLoadConfig.mockReturnValue(createMockConfig('gemini'));

				mockedFetch.mockResolvedValue(
					jsonResponse({
						models: [
							{
								name: 'models/gemini-2.5-flash',
								displayName: 'Gemini 2.5 Flash',
								version: '001',
								inputTokenLimit: 1048576,
								outputTokenLimit: 8192,
							},
							{
								name: 'models/gemini-1.5-pro',
								displayName: 'Gemini 1.5 Pro',
								version: '002',
								inputTokenLimit: 2097152,
								outputTokenLimit: 8192,
							},
						],
					})
				);

				const geminiClient = new DescriptionGenerator();
				const models = await geminiClient.listModels();

				expect(models).toHaveLength(2);
				expect(models[0]).toEqual({
					name: 'gemini-2.5-flash',
					display_name: 'Gemini 2.5 Flash',
					version: '001',
					input_token_limit: 1048576,
					output_token_limit: 8192,
				});
				expect(mockedFetch).toHaveBeenCalledWith(
					'https://generativelanguage.googleapis.com/v1beta/models?key=test-google-key'
				);
			});

			it('given Gemini API fails, when listModels called, then should throw error', async () => {
				mockedLoadConfig.mockReturnValue(createMockConfig('gemini'));

				mockedFetch.mockRejectedValue(new Error('API error'));

				const geminiClient = new DescriptionGenerator();
				await expect(geminiClient.listModels()).rejects.toThrow('Failed to list models from gemini');
			});
		});

		describe('prompt normalization', () => {
			it('given ollama provider with multiline prompt in config, when generateDescription called, then prompt is normalized to single line', async () => {
				const multilinePrompt = `Please provide a detailed description.
Include information about subjects and composition.
Write in professional style.`;

				const configWithMultilinePrompt = createMockConfig('ollama');
				configWithMultilinePrompt.llmProviders.ollama.prompt = multilinePrompt;
				mockedLoadConfig.mockReturnValue(configWithMultilinePrompt);

				const newClient = new DescriptionGenerator();

				const mockResult = {
					text: 'Generated description',
				} as unknown as Awaited<ReturnType<typeof generateText>>;
				mockedGenerateText.mockResolvedValue(mockResult);

				await newClient.generateDescription('/path/to/image.jpg');

				expect(mockedGenerateText).toHaveBeenCalled();
				const callArgs = mockedGenerateText.mock.calls[0]?.[0] as {
					messages?: Array<{ content?: unknown[] }>;
				};
				const messageContent = callArgs?.messages?.[0]?.content as unknown[];
				const textContent = messageContent?.find(
					(c: unknown): c is { type: string; text?: string } =>
						typeof c === 'object' && c !== null && 'type' in c && (c as { type: unknown }).type === 'text'
				);

				expect(textContent?.text).toBe(
					'Please provide a detailed description. Include information about subjects and composition. Write in professional style.'
				);
			});
		});

		describe('normalizePrompt unit tests', () => {
			it('given multiline prompt with newlines, when normalizePrompt called, then returns single line with spaces', () => {
				const prompt = `Please provide a detailed description of this image.
Include information about the main subjects, setting, colors, composition, mood, and any notable details.
Write in a descriptive, professional style suitable for image metadata.`;
				expect(normalizePrompt(prompt)).toBe(
					'Please provide a detailed description of this image. Include information about the main subjects, setting, colors, composition, mood, and any notable details. Write in a descriptive, professional style suitable for image metadata.'
				);
			});

			it('given prompt with multiple consecutive spaces, when normalizePrompt called, then collapses to single space', () => {
				const prompt = 'This  has   multiple    spaces';
				expect(normalizePrompt(prompt)).toBe('This has multiple spaces');
			});

			it('given prompt with tabs and other whitespace, when normalizePrompt called, then removes all control characters', () => {
				const prompt = 'This\thas\ttabs\vand\fvertical\rformats';
				expect(normalizePrompt(prompt)).toBe('This has tabs and vertical formats');
			});

			it('given prompt with leading and trailing whitespace, when normalizePrompt called, then trims edges', () => {
				const prompt = '   Prompt with spaces   ';
				expect(normalizePrompt(prompt)).toBe('Prompt with spaces');
			});

			it('given single line prompt already normalized, when normalizePrompt called, then returns unchanged', () => {
				const prompt = 'This is a single line prompt.';
				expect(normalizePrompt(prompt)).toBe('This is a single line prompt.');
			});

			it('given empty string, when normalizePrompt called, then returns empty string', () => {
				const prompt = '';
				expect(normalizePrompt(prompt)).toBe('');
			});

			it('given only whitespace, when normalizePrompt called, then returns empty string', () => {
				const prompt = '   \n\t\r  \v\f  ';
				expect(normalizePrompt(prompt)).toBe('');
			});
		});

		describe('cleanImageDescription', () => {
			it('given raw LLM output with "Here\'s a detailed description" prefix, when cleanImageDescription called, then removes prefix', () => {
				const rawDescription =
					"Here's a detailed description of the image:\n\nThis is a portrait photo showing a person.";
				const result = cleanImageDescription(rawDescription);
				expect(result).toBe('This is a portrait photo showing a person.');
			});

			it('given raw LLM output with "**Image Description:**" prefix, when cleanImageDescription called, then removes prefix', () => {
				const rawDescription = '**Image Description:** A portrait photo showing a person.';
				const result = cleanImageDescription(rawDescription);
				expect(result).toBe('A portrait photo showing a person.');
			});

			it('given raw LLM output with "**Title:**" prefix, when cleanImageDescription called, then removes prefix', () => {
				const rawDescription = '**Title:** A portrait photo showing a person.';
				const result = cleanImageDescription(rawDescription);
				expect(result).toBe('A portrait photo showing a person.');
			});

			it('given raw LLM output with "**Description:**" prefix, when cleanImageDescription called, then removes prefix', () => {
				const rawDescription = '**Description:** A portrait photo showing a person.';
				const result = cleanImageDescription(rawDescription);
				expect(result).toBe('A portrait photo showing a person.');
			});

			it('given raw LLM output with "**Overall Description:**" prefix, when cleanImageDescription called, then removes prefix', () => {
				const rawDescription = '**Overall Description:** A portrait photo showing a person.';
				const result = cleanImageDescription(rawDescription);
				expect(result).toBe('A portrait photo showing a person.');
			});

			it('given raw LLM output with "Image Description:" prefix (no bold), when cleanImageDescription called, then removes prefix', () => {
				const rawDescription = 'Image Description: A portrait photo showing a person.';
				const result = cleanImageDescription(rawDescription);
				expect(result).toBe('A portrait photo showing a person.');
			});

			it('given raw LLM output with "Description:" prefix (no bold), when cleanImageDescription called, then removes prefix', () => {
				const rawDescription = 'Description: A portrait photo showing a person.';
				const result = cleanImageDescription(rawDescription);
				expect(result).toBe('A portrait photo showing a person.');
			});

			it('given raw LLM output with "The image shows:" prefix, when cleanImageDescription called, then removes prefix', () => {
				const rawDescription = 'The image shows: A portrait photo showing a person.';
				const result = cleanImageDescription(rawDescription);
				expect(result).toBe('A portrait photo showing a person.');
			});

			it('given raw LLM output with "This image depicts:" prefix, when cleanImageDescription called, then removes prefix', () => {
				const rawDescription = 'This image depicts: A portrait photo showing a person.';
				const result = cleanImageDescription(rawDescription);
				expect(result).toBe('A portrait photo showing a person.');
			});

			it('given raw LLM output with "In this image:" prefix, when cleanImageDescription called, then removes prefix', () => {
				const rawDescription = 'In this image: A portrait photo showing a person.';
				const result = cleanImageDescription(rawDescription);
				expect(result).toBe('A portrait photo showing a person.');
			});

			it('given raw LLM output with "Looking at this image:" prefix, when cleanImageDescription called, then removes prefix', () => {
				const rawDescription = 'Looking at this image: A portrait photo showing a person.';
				const result = cleanImageDescription(rawDescription);
				expect(result).toBe('A portrait photo showing a person.');
			});
		});
	});
});
