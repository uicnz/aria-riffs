import { describe, expect, it } from 'vitest';
import { CommitFormatterError } from '../../../src/lib/types.js';
import { AnthropicProvider } from '../../../src/providers/anthropic-provider.js';
import type { ProviderConfig } from '../../../src/providers/base-provider.js';
import { GeminiProvider } from '../../../src/providers/gemini-provider.js';
import { OpenAIProvider } from '../../../src/providers/openai-provider.js';
import { createProvider, getSupportedProviders } from '../../../src/providers/provider-factory.js';

describe('provider-factory', () => {
	const baseConfig = {
		model: 'test-model',
		temperature: 0.3,
		maxTokens: 1000,
		apiKey: 'test-key',
	};

	describe('createProvider', () => {
		it('creates Anthropic provider', () => {
			const config: ProviderConfig = {
				...baseConfig,
				provider: 'anthropic',
			};

			const provider = createProvider(config);
			expect(provider).toBeInstanceOf(AnthropicProvider);
			expect(provider.getProviderName()).toBe('anthropic');
			expect(provider.getModelName()).toBe('test-model');
		});

		it('creates Gemini provider', () => {
			const config: ProviderConfig = {
				...baseConfig,
				provider: 'gemini',
			};

			const provider = createProvider(config);
			expect(provider).toBeInstanceOf(GeminiProvider);
			expect(provider.getProviderName()).toBe('gemini');
			expect(provider.getModelName()).toBe('test-model');
		});

		it('creates OpenAI provider', () => {
			const config: ProviderConfig = {
				...baseConfig,
				provider: 'openai',
			};

			const provider = createProvider(config);
			expect(provider).toBeInstanceOf(OpenAIProvider);
			expect(provider.getProviderName()).toBe('openai');
			expect(provider.getModelName()).toBe('test-model');
		});

		it('throws for unknown provider', () => {
			const config = {
				...baseConfig,
				provider: 'invalid' as any,
			};

			expect(() => createProvider(config)).toThrow(CommitFormatterError);
			expect(() => createProvider(config)).toThrow('Unknown provider: invalid');
			expect(() => createProvider(config)).toThrow('Supported providers: anthropic, gemini, openai');
		});

		it('passes configuration correctly to provider', () => {
			const config: ProviderConfig = {
				provider: 'anthropic',
				model: 'custom-model',
				temperature: 0.7,
				maxTokens: 500,
				apiKey: 'custom-key',
				baseUrl: 'https://custom.url',
			};

			const provider = createProvider(config);
			expect(provider.getModelName()).toBe('custom-model');
		});
	});

	describe('getSupportedProviders', () => {
		it('returns array of supported providers', () => {
			const providers = getSupportedProviders();
			expect(Array.isArray(providers)).toBe(true);
			expect(providers.length).toBeGreaterThan(0);
		});

		it('includes anthropic provider', () => {
			const providers = getSupportedProviders();
			expect(providers).toContain('anthropic');
		});

		it('includes gemini provider', () => {
			const providers = getSupportedProviders();
			expect(providers).toContain('gemini');
		});

		it('includes openai provider', () => {
			const providers = getSupportedProviders();
			expect(providers).toContain('openai');
		});

		it('returns exactly three providers', () => {
			const providers = getSupportedProviders();
			expect(providers).toHaveLength(3);
		});
	});
});
