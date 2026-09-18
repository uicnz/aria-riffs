import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock loadConfig with hoisted pattern for module-level initialization
const { mockLoadConfig } = vi.hoisted(() => {
	const defaultConfig = {
		'commit-formatter': {
			llm: {
				provider: 'anthropic' as const,
				anthropic: {
					apiKey: 'test-anthropic-key',
					model: 'claude-haiku-4-5',
					temperature: 0.3,
					maxTokens: 1000,
					baseUrl: 'https://api.anthropic.com/v1',
				},
				gemini: {
					apiKey: 'test-google-key',
					model: 'gemini-2.5-flash',
					temperature: 0.3,
					maxTokens: 1000,
					baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
				},
				openai: {
					apiKey: 'test-openai-key',
					model: 'gpt-5-mini',
					temperature: 0.3,
					maxTokens: 1000,
					baseUrl: 'https://api.openai.com/v1',
				},
			},
		},
		logging: {
			level: 'info',
			verbose: false,
			file: '.aria/logs/commit-formatter.log',
			maxFileSizeMb: 10,
			maxFiles: 7,
		},
	};
	return {
		mockLoadConfig: vi.fn().mockReturnValue(defaultConfig),
	};
});

vi.mock('../../src/lib/config.js', () => ({
	loadConfig: mockLoadConfig,
}));

import { CommitMessageGenerator } from '../../src/core/message-generator.js';
import { mockCommitFeature, mockCommitFix } from '../fixtures/mock-commits.js';

// Mock the provider factory
vi.mock('../../src/providers/provider-factory.js', () => ({
	createProvider: vi.fn(() => ({
		generateCommitMessage: vi.fn(async () => 'feat: mocked commit message'),
		testConnection: vi.fn(async () => true),
		getProviderName: vi.fn(() => 'anthropic'),
		getModelName: vi.fn(() => 'claude-haiku-4-5'),
	})),
}));

describe('message-generator', () => {
	let generator: CommitMessageGenerator;

	beforeEach(() => {
		vi.clearAllMocks();
		generator = new CommitMessageGenerator();
	});

	describe('CommitMessageGenerator', () => {
		describe('constructor', () => {
			it('creates instance successfully', () => {
				expect(generator).toBeDefined();
				expect(generator).toBeInstanceOf(CommitMessageGenerator);
			});
		});

		describe('generateCommitMessage', () => {
			it('generates message for feature commit', async () => {
				const message = await generator.generateCommitMessage(mockCommitFeature);
				expect(message).toBeDefined();
				expect(typeof message).toBe('string');
				expect(message.length).toBeGreaterThan(0);
			});

			it('generates message for fix commit', async () => {
				const message = await generator.generateCommitMessage(mockCommitFix);
				expect(message).toBeDefined();
				expect(typeof message).toBe('string');
			});

			it('returns mocked message from provider', async () => {
				const message = await generator.generateCommitMessage(mockCommitFeature);
				expect(message).toBe('feat: mocked commit message');
			});
		});

		describe('testConnection', () => {
			it('returns true for successful connection', async () => {
				const result = await generator.testConnection();
				expect(result).toBe(true);
			});
		});

		describe('getProviderName', () => {
			it('returns provider name', () => {
				const name = generator.getProviderName();
				expect(name).toBe('anthropic');
			});
		});

		describe('getModelName', () => {
			it('returns model name', () => {
				const model = generator.getModelName();
				expect(model).toBe('claude-haiku-4-5');
			});
		});
	});
});
