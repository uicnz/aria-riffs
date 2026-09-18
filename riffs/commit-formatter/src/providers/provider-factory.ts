/**
 * Provider factory for creating LLM provider instances
 */

import { CommitFormatterError } from '../lib/types.js';
import { AnthropicProvider } from './anthropic-provider.js';
import type { LLMProvider, ProviderConfig } from './base-provider.js';
import { GeminiProvider } from './gemini-provider.js';
import { OpenAIProvider } from './openai-provider.js';

/**
 * Create a provider instance based on configuration
 */
export function createProvider(config: ProviderConfig): LLMProvider {
	switch (config.provider) {
		case 'anthropic':
			return new AnthropicProvider(config);
		case 'gemini':
			return new GeminiProvider(config);
		case 'openai':
			return new OpenAIProvider(config);
		default:
			throw new CommitFormatterError(
				`Unknown provider: ${config.provider}. Supported providers: anthropic, gemini, openai`
			);
	}
}

/**
 * Get list of supported providers
 */
export function getSupportedProviders(): string[] {
	return ['anthropic', 'gemini', 'openai'];
}
