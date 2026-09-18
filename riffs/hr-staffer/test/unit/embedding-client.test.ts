/**
 * Unit tests for EmbeddingService.
 * Tests configuration handling and interface compliance.
 *
 * Note: These are unit tests that don't make real API calls.
 * Integration tests with real providers would go in test/integration/.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HrStafferEmbeddings } from '../../src/lib/schema.js';
import { createEmbeddingService, EmbeddingError } from '../../src/providers/embedding-client.js';

// Mock the ai module
vi.mock('ai', () => ({
	embed: vi.fn(),
}));

// Import the mocked function for control in tests
import { embed } from 'ai';

describe('createEmbeddingService', () => {
	it('given openai config with api key, when created, then returns service with correct model name', () => {
		const config: HrStafferEmbeddings = {
			provider: 'openai',
			maxChars: 20000,
			batchSize: 64,
			openai: {
				apiKey: 'test-api-key',
				model: 'text-embedding-3-large',
				dimensions: 3072,
				timeout: 30,
			},
			gemini: {
				apiKey: '',
				model: 'gemini-embedding-2',
				dimensions: 768,
				timeout: 30,
				baseUrl: 'https://generativelanguage.googleapis.com/v1',
			},
			ollama: {
				endpoint: 'http://localhost:11434/',
				model: 'embeddinggemma:latest',
				dimensions: 768,
				timeout: 60,
				keepAlive: 300,
			},
		};

		const service = createEmbeddingService(config);

		expect(service.getModelName()).toBe('text-embedding-3-large');
	});

	it('given gemini config selected, when created, then returns service with gemini model name', () => {
		const config: HrStafferEmbeddings = {
			provider: 'gemini',
			maxChars: 20000,
			batchSize: 64,
			openai: {
				apiKey: '',
				model: 'text-embedding-3-large',
				dimensions: 3072,
				timeout: 30,
			},
			gemini: {
				apiKey: 'test-google-key',
				model: 'gemini-embedding-2',
				dimensions: 768,
				timeout: 30,
				baseUrl: 'https://generativelanguage.googleapis.com/v1',
			},
			ollama: {
				endpoint: 'http://localhost:11434/',
				model: 'embeddinggemma:latest',
				dimensions: 768,
				timeout: 60,
				keepAlive: 300,
			},
		};

		const service = createEmbeddingService(config);

		expect(service.getModelName()).toBe('gemini-embedding-2');
	});

	it('given ollama config selected, when created, then returns service with ollama model name', () => {
		const config: HrStafferEmbeddings = {
			provider: 'ollama',
			maxChars: 20000,
			batchSize: 64,
			openai: {
				apiKey: '',
				model: 'text-embedding-3-large',
				dimensions: 3072,
				timeout: 30,
			},
			gemini: {
				apiKey: '',
				model: 'gemini-embedding-2',
				dimensions: 768,
				timeout: 30,
				baseUrl: 'https://generativelanguage.googleapis.com/v1',
			},
			ollama: {
				endpoint: 'http://localhost:11434/',
				model: 'embeddinggemma:latest',
				dimensions: 768,
				timeout: 60,
				keepAlive: 300,
			},
		};

		const service = createEmbeddingService(config);

		expect(service.getModelName()).toBe('embeddinggemma:latest');
	});

	it('given config, when getDimensions called, then returns correct dimensions for provider', () => {
		const config: HrStafferEmbeddings = {
			provider: 'openai',
			maxChars: 20000,
			batchSize: 64,
			openai: {
				apiKey: 'test-api-key',
				model: 'text-embedding-3-large',
				dimensions: 3072,
				timeout: 30,
			},
			gemini: {
				apiKey: '',
				model: 'gemini-embedding-2',
				dimensions: 768,
				timeout: 30,
				baseUrl: 'https://generativelanguage.googleapis.com/v1',
			},
			ollama: {
				endpoint: 'http://localhost:11434/',
				model: 'embeddinggemma:latest',
				dimensions: 768,
				timeout: 60,
				keepAlive: 300,
			},
		};

		const service = createEmbeddingService(config);

		expect(service.getDimensions()).toBe(3072);
	});

	it('given openai config without api key and no env var, when created, then throws error', () => {
		// Save original env
		const originalEnv = process.env['OPENAI_API_KEY'];
		process.env['OPENAI_API_KEY'] = '';

		try {
			const config: HrStafferEmbeddings = {
				provider: 'openai',
				maxChars: 20000,
				batchSize: 64,
				openai: {
					apiKey: '',
					model: 'text-embedding-3-large',
					dimensions: 3072,
					timeout: 30,
				},
				gemini: {
					apiKey: '',
					model: 'gemini-embedding-2',
					dimensions: 768,
					timeout: 30,
					baseUrl: 'https://generativelanguage.googleapis.com/v1',
				},
				ollama: {
					endpoint: 'http://localhost:11434/',
					model: 'embeddinggemma:latest',
					dimensions: 768,
					timeout: 60,
					keepAlive: 300,
				},
			};

			expect(() => createEmbeddingService(config)).toThrow('OpenAI API key not configured');
		} finally {
			// Restore original env
			if (originalEnv !== undefined) {
				process.env['OPENAI_API_KEY'] = originalEnv;
			}
		}
	});

	it('given openai config without api key but env var set, when created, then succeeds', () => {
		// Save original env
		const originalEnv = process.env['OPENAI_API_KEY'];
		process.env['OPENAI_API_KEY'] = 'env-api-key';

		try {
			const config: HrStafferEmbeddings = {
				provider: 'openai',
				maxChars: 20000,
				batchSize: 64,
				openai: {
					apiKey: '',
					model: 'text-embedding-3-large',
					dimensions: 3072,
					timeout: 30,
				},
				gemini: {
					apiKey: '',
					model: 'gemini-embedding-2',
					dimensions: 768,
					timeout: 30,
					baseUrl: 'https://generativelanguage.googleapis.com/v1',
				},
				ollama: {
					endpoint: 'http://localhost:11434/',
					model: 'embeddinggemma:latest',
					dimensions: 768,
					timeout: 60,
					keepAlive: 300,
				},
			};

			const service = createEmbeddingService(config);
			expect(service.getModelName()).toBe('text-embedding-3-large');
		} finally {
			// Restore original env
			if (originalEnv !== undefined) {
				process.env['OPENAI_API_KEY'] = originalEnv;
			} else {
				process.env['OPENAI_API_KEY'] = '';
			}
		}
	});
});

describe('EmbeddingService.embedSingle', () => {
	const mockEmbed = vi.mocked(embed);

	// Helper to create a valid config for tests
	function createTestConfig(overrides: Partial<HrStafferEmbeddings> = {}): HrStafferEmbeddings {
		return {
			provider: 'openai',
			maxChars: 100,
			batchSize: 64,
			openai: {
				apiKey: 'test-api-key',
				model: 'text-embedding-3-large',
				dimensions: 3072,
				timeout: 30,
			},
			gemini: {
				apiKey: '',
				model: 'gemini-embedding-2',
				dimensions: 768,
				timeout: 30,
				baseUrl: 'https://generativelanguage.googleapis.com/v1',
			},
			ollama: {
				endpoint: 'http://localhost:11434/',
				model: 'embeddinggemma:latest',
				dimensions: 768,
				timeout: 60,
				keepAlive: 300,
			},
			...overrides,
		};
	}

	beforeEach(() => {
		mockEmbed.mockReset();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it('given short text, when embedSingle called, then passes text unchanged to embed', async () => {
		const mockEmbedding = [0.1, 0.2, 0.3];
		mockEmbed.mockResolvedValue({ embedding: mockEmbedding } as never);

		const service = createEmbeddingService(createTestConfig({ maxChars: 100 }));
		await service.embedSingle('short text');

		expect(mockEmbed).toHaveBeenCalledWith(
			expect.objectContaining({
				value: 'short text',
			})
		);
	});

	it('given text longer than maxChars, when embedSingle called, then truncates text', async () => {
		const mockEmbedding = [0.1, 0.2, 0.3];
		mockEmbed.mockResolvedValue({ embedding: mockEmbedding } as never);

		const service = createEmbeddingService(createTestConfig({ maxChars: 10 }));
		await service.embedSingle('this text is definitely longer than ten characters');

		expect(mockEmbed).toHaveBeenCalledWith(
			expect.objectContaining({
				value: 'this text ',
			})
		);
	});

	it('given successful embed call, when embedSingle called, then returns Float32Array', async () => {
		const mockEmbedding = [0.1, 0.2, 0.3];
		mockEmbed.mockResolvedValue({ embedding: mockEmbedding } as never);

		const service = createEmbeddingService(createTestConfig());
		const result = await service.embedSingle('test text');

		expect(result).toBeInstanceOf(Float32Array);
		expect(result.length).toBe(3);
		// Float32 has limited precision, so check values are close
		expect(result[0]).toBeCloseTo(0.1, 5);
		expect(result[1]).toBeCloseTo(0.2, 5);
		expect(result[2]).toBeCloseTo(0.3, 5);
	});

	it('given embed call throws error, when embedSingle called, then throws EmbeddingError', async () => {
		mockEmbed.mockRejectedValue(new Error('API rate limit exceeded'));

		const service = createEmbeddingService(createTestConfig());

		await expect(service.embedSingle('test text')).rejects.toThrow(EmbeddingError);
		await expect(service.embedSingle('test text')).rejects.toThrow(
			'Failed to generate embedding: API rate limit exceeded'
		);
	});

	it('given embed call throws non-Error, when embedSingle called, then wraps in EmbeddingError', async () => {
		mockEmbed.mockRejectedValue('string error');

		const service = createEmbeddingService(createTestConfig());

		await expect(service.embedSingle('test text')).rejects.toThrow(EmbeddingError);
		await expect(service.embedSingle('test text')).rejects.toThrow('Failed to generate embedding: string error');
	});
});
