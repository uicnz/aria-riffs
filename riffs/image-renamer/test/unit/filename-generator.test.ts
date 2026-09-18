import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImageRenamerConfig } from '../../src/lib/schema.js';

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

vi.mock('../../src/utils/utils', () => ({
	encodeImageToBase64: vi.fn(),
	retryWithBackoff: vi.fn(<T>(fn: () => T) => fn()),
}));

import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import { createOllama } from 'ai-sdk-ollama';
import { FilenameGenerator } from '../../src/core/filename-generator.js';
import { encodeImageToBase64, retryWithBackoff } from '../../src/utils/utils.js';

const mockedGenerateText = vi.mocked(generateText);
const mockedCreateAnthropic = vi.mocked(createAnthropic);
const mockedCreateGoogleGenerativeAI = vi.mocked(createGoogleGenerativeAI);
const mockedCreateOllama = vi.mocked(createOllama);
const mockedFetch = vi.fn<typeof fetch>();
const mockedEncodeImageToBase64 = vi.mocked(encodeImageToBase64);
const mockedRetryWithBackoff = vi.mocked(retryWithBackoff);

function jsonResponse(data: unknown): Response {
	return new Response(JSON.stringify(data), {
		status: 200,
		headers: { 'content-type': 'application/json' },
	});
}

// Create a test config factory
function createTestConfig(
	overrides: {
		provider?: 'ollama' | 'anthropic' | 'gemini';
		ollama?: Partial<ImageRenamerConfig['image-renamer']['llm']['ollama']>;
		anthropic?: Partial<ImageRenamerConfig['image-renamer']['llm']['anthropic']>;
		gemini?: Partial<ImageRenamerConfig['image-renamer']['llm']['gemini']>;
	} = {}
): ImageRenamerConfig {
	return {
		'image-renamer': {
			paths: {
				input: { dir: null },
				database: { file: '.aria/db/image-renamer/image-renamer.sqlite' },
			},
			llm: {
				provider: overrides.provider ?? 'ollama',
				ollama: {
					endpoint: 'http://localhost:11434/api',
					model: 'llava',
					timeout: 30,
					retryAttempts: 3,
					retryDelay: 1.0,
					prompt: 'Test Ollama prompt for AI SDK',
					...overrides.ollama,
				},
				anthropic: {
					apiKey: 'test-api-key',
					model: 'claude-3-5-sonnet-20241022',
					timeout: 30,
					maxTokens: 1024,
					baseUrl: 'https://api.anthropic.com/v1',
					prompt: 'Test Anthropic prompt for AI SDK',
					...overrides.anthropic,
				},
				gemini: {
					apiKey: 'test-google-key',
					model: 'gemini-2.5-flash',
					timeout: 30,
					maxTokens: 1024,
					baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
					prompt: 'Test Gemini prompt for AI SDK',
					...overrides.gemini,
				},
			},
			images: {
				supportedExtensions: ['.png', '.jpg', '.jpeg', '.gif', '.bmp'],
				maxFileSizeMb: 50,
				verifyBeforeProcessing: true,
			},
			filename: {
				prompt: 'Describe this image',
				patternCleanup: true,
				maxLength: 100,
				removePunctuation: true,
				replaceSpacesWith: '_',
				caseConversion: 'lower',
			},
			fileOperations: {
				safeMoveRetries: 3,
				moveDelaySeconds: 0.5,
				backupOriginals: false,
				confirmOverwrites: true,
			},
			watcher: {
				recursive: false,
				debounceSeconds: 1.0,
				fileSettleTime: 1.0,
			},
			processing: {
				progressBar: true,
				batchSize: 10,
				concurrentOperations: false,
				dryRun: false,
				recursive: false,
			},
			database: {
				tableName: 'images',
				journalMode: 'DELETE',
			},
		},
		logging: {
			level: 'info',
			verbose: false,
			file: '.aria/logs/test/image-renamer-filename.log',
			maxFileSizeMb: 10,
			maxFiles: 7,
		},
	};
}

describe('LLM Client Module', () => {
	describe('FilenameGenerator', () => {
		let client: FilenameGenerator;
		let testConfig: ImageRenamerConfig;

		beforeEach(() => {
			vi.clearAllMocks();
			vi.stubGlobal('fetch', mockedFetch);
			testConfig = createTestConfig();

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
			mockedRetryWithBackoff.mockImplementation(<T>(fn: () => T) => fn());

			client = new FilenameGenerator(testConfig);
		});

		afterEach(() => {
			vi.restoreAllMocks();
			vi.unstubAllGlobals();
		});

		describe('constructor', () => {
			it('should initialize with correct configuration for ollama provider', () => {
				expect(mockedCreateOllama).toHaveBeenCalledWith(
					expect.objectContaining({
						baseURL: 'http://localhost:11434/api',
					})
				);
				expect(mockedCreateAnthropic).not.toHaveBeenCalled();
			});

			it('should initialize with correct configuration for anthropic provider', () => {
				const anthropicConfig = createTestConfig({ provider: 'anthropic' });
				const anthropicClient = new FilenameGenerator(anthropicConfig);

				expect(anthropicClient).toBeInstanceOf(FilenameGenerator);
				expect(mockedCreateAnthropic).toHaveBeenCalledWith(
					expect.objectContaining({
						apiKey: 'test-api-key',
						baseURL: 'https://api.anthropic.com/v1',
					})
				);
			});

			it('should initialize with correct configuration for gemini provider', () => {
				const geminiConfig = createTestConfig({ provider: 'gemini' });
				const geminiClient = new FilenameGenerator(geminiConfig);

				expect(geminiClient).toBeInstanceOf(FilenameGenerator);
				expect(mockedCreateGoogleGenerativeAI).toHaveBeenCalledWith(
					expect.objectContaining({
						apiKey: 'test-google-key',
					})
				);
			});
		});

		describe('generateFilename', () => {
			it('should generate filename using Anthropic when provider is anthropic', async () => {
				const anthropicConfig = createTestConfig({ provider: 'anthropic' });
				const newClient = new FilenameGenerator(anthropicConfig);

				const mockResult = {
					text: 'Generated filename from Anthropic via AI SDK',
				} as unknown as Awaited<ReturnType<typeof generateText>>;
				mockedGenerateText.mockResolvedValue(mockResult);

				const result = await newClient.generateFilename('/path/to/image.jpg');

				expect(result).toBe('Generated filename from Anthropic via AI SDK');
				expect(mockedEncodeImageToBase64).toHaveBeenCalledWith('/path/to/image.jpg');
			});

			it('should generate filename using Gemini when provider is gemini', async () => {
				const geminiConfig = createTestConfig({ provider: 'gemini' });
				const newClient = new FilenameGenerator(geminiConfig);

				const mockResult = {
					text: 'Generated filename from Gemini via AI SDK',
				} as unknown as Awaited<ReturnType<typeof generateText>>;
				mockedGenerateText.mockResolvedValue(mockResult);

				const result = await newClient.generateFilename('/path/to/image.jpg');

				expect(result).toBe('Generated filename from Gemini via AI SDK');
				expect(mockedEncodeImageToBase64).toHaveBeenCalledWith('/path/to/image.jpg');
			});

			it('should generate filename using Ollama when provider is ollama', async () => {
				const mockResult = {
					text: 'Generated filename from Ollama via AI SDK',
				} as unknown as Awaited<ReturnType<typeof generateText>>;
				mockedGenerateText.mockResolvedValue(mockResult);

				const result = await client.generateFilename('/path/to/image.jpg');

				expect(result).toBe('Generated filename from Ollama via AI SDK');
				expect(mockedEncodeImageToBase64).toHaveBeenCalledWith('/path/to/image.jpg');
			});

			it('should handle generation errors', async () => {
				mockedGenerateText.mockRejectedValue(new Error('AI SDK generation failed'));

				await expect(client.generateFilename('/path/to/image.jpg')).rejects.toThrow(
					'Failed to generate filename after'
				);
			});
		});

		describe('testConnection', () => {
			it('should return true for successful connection', async () => {
				const mockResult = {
					text: 'Hi',
				} as unknown as Awaited<ReturnType<typeof generateText>>;
				mockedGenerateText.mockResolvedValue(mockResult);

				const result = await client.testConnection();

				expect(result).toBe(true);
			});

			it('should return false for connection failures', async () => {
				mockedGenerateText.mockRejectedValue(new Error('Connection failed'));

				const result = await client.testConnection();

				expect(result).toBe(false);
			});

			it('should return false when anthropic client has empty API key', async () => {
				const noKeyConfig = createTestConfig({
					provider: 'anthropic',
					anthropic: { apiKey: '' },
				});

				mockedGenerateText.mockRejectedValue(new Error('Invalid API key'));

				const newClient = new FilenameGenerator(noKeyConfig);
				const result = await newClient.testConnection();

				expect(result).toBe(false);
			});
		});

		describe('getter methods', () => {
			it('should return correct model name for ollama', () => {
				expect(client.modelName).toBe('llava');
			});

			it('should return correct endpoint URL for ollama', () => {
				expect(client.endpointUrl).toBe('http://localhost:11434/api');
			});

			it('should return correct model name for anthropic', () => {
				const anthropicConfig = createTestConfig({ provider: 'anthropic' });
				const newClient = new FilenameGenerator(anthropicConfig);

				expect(newClient.modelName).toBe('claude-3-5-sonnet-20241022');
				expect(newClient.endpointUrl).toBe('https://api.anthropic.com/v1');
			});

			it('should return correct model name for gemini', () => {
				const geminiConfig = createTestConfig({ provider: 'gemini' });
				const newClient = new FilenameGenerator(geminiConfig);

				expect(newClient.modelName).toBe('gemini-2.5-flash');
				expect(newClient.endpointUrl).toBe('https://generativelanguage.googleapis.com/v1beta');
			});
		});

		describe('listModels', () => {
			it('should list models from Ollama provider', async () => {
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

			it('should handle modified_at as Date object from Ollama', async () => {
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

			it('should list models from Anthropic provider', async () => {
				const anthropicConfig = createTestConfig({ provider: 'anthropic' });

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

				const anthropicClient = new FilenameGenerator(anthropicConfig);
				const models = await anthropicClient.listModels();

				expect(models).toHaveLength(3);
				expect(models[0]).toEqual({
					name: 'claude-3-5-sonnet-20241022',
					created_at: '2024-10-22',
					display_name: 'Claude 3.5 Sonnet',
				});
				expect(models[1]).toEqual({
					name: 'claude-3-opus-20240229',
					created_at: '2024-02-29',
					display_name: 'Claude 3 Opus',
				});
				expect(models[2]).toEqual({
					name: 'claude-3-sonnet-20240229',
					created_at: '2024-02-29',
					display_name: 'Claude 3 Sonnet',
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

			it('should handle errors when listing models from Ollama', async () => {
				const mockOllamaList = vi.fn();
				mockOllamaList.mockRejectedValue(new Error('Connection failed'));

				setOllamaListMock(mockOllamaList);

				await expect(client.listModels()).rejects.toThrow('Failed to list models from ollama');
			});

			it('should handle errors when listing models from Anthropic', async () => {
				const anthropicConfig = createTestConfig({ provider: 'anthropic' });

				mockedFetch.mockRejectedValue(new Error('API error'));

				const anthropicClient = new FilenameGenerator(anthropicConfig);
				await expect(anthropicClient.listModels()).rejects.toThrow('Failed to list models from anthropic');
			});

			it('should handle empty model list from Ollama', async () => {
				const mockOllamaList = vi.fn();
				mockOllamaList.mockResolvedValue({
					models: [],
				});

				setOllamaListMock(mockOllamaList);

				const models = await client.listModels();

				expect(models).toHaveLength(0);
				expect(models).toEqual([]);
			});

			it('should list models from Gemini provider', async () => {
				const geminiConfig = createTestConfig({ provider: 'gemini' });

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

				const geminiClient = new FilenameGenerator(geminiConfig);
				const models = await geminiClient.listModels();

				expect(models).toHaveLength(2);
				expect(models[0]).toEqual({
					name: 'gemini-2.5-flash',
					display_name: 'Gemini 2.5 Flash',
					version: '001',
					input_token_limit: 1048576,
					output_token_limit: 8192,
				});
				expect(models[1]).toEqual({
					name: 'gemini-1.5-pro',
					display_name: 'Gemini 1.5 Pro',
					version: '002',
					input_token_limit: 2097152,
					output_token_limit: 8192,
				});
				expect(mockedFetch).toHaveBeenCalledWith(
					'https://generativelanguage.googleapis.com/v1beta/models?key=test-google-key'
				);
			});

			it('should handle errors when listing models from Gemini', async () => {
				const geminiConfig = createTestConfig({ provider: 'gemini' });

				mockedFetch.mockRejectedValue(new Error('API error'));

				const geminiClient = new FilenameGenerator(geminiConfig);
				await expect(geminiClient.listModels()).rejects.toThrow('Failed to list models from gemini');
			});
		});
	});
});
