/**
 * Image description generator service
 * Generates detailed image descriptions using vision-capable LLM providers
 */

import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText, type LanguageModel } from 'ai';
import { createOllama } from 'ai-sdk-ollama';
import { Ollama } from 'ollama';
import { loadConfig } from '../lib/config.js';
import { createLogger } from '../lib/logger.js';
import { type LLMClient, type LLMProviderConfig, LlmConnectionError, type ModelInfo } from '../lib/types.js';
import { encodeImageToBase64 } from '../utils/utils.js';

const DEFAULT_PROMPT = `Please provide a detailed description of this image. Include information about the main subjects, setting, colors, composition, mood, and any notable details. Write in a descriptive, professional style suitable for image metadata. Do not use markdown or any other kind of markup in the output. If you cannot see the image, respond with "Image not visible."
`;

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
	const response = init ? await fetch(url, init) : await fetch(url);
	if (!response.ok) {
		throw new Error(`Request failed with HTTP ${response.status} ${response.statusText}`);
	}
	return (await response.json()) as T;
}

export function normalizePrompt(prompt: string): string {
	return prompt
		.replace(/[\n\r\t\v\f]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * Clean up LLM response formatting and extract just the description content
 */
export function cleanImageDescription(rawDescription: string): string {
	let cleaned = rawDescription.trim();

	// Remove common LLM prefixes and formatting
	const prefixesToRemove = [
		/^Here's a detailed description of the image[^:]*:\s*/i,
		/^\*\*Image Description:\*\*\s*/i,
		/^\*\*Title:\*\*\s*/i,
		/^\*\*Description:\*\*\s*/i,
		/^\*\*Overall Description:\*\*\s*/i,
		/^Image Description:\s*/i,
		/^Description:\s*/i,
		/^The image shows:\s*/i,
		/^This image depicts:\s*/i,
		/^In this image:\s*/i,
		/^Looking at this image,?\s*:\s*/i,
	];

	for (const prefix of prefixesToRemove) {
		cleaned = cleaned.replace(prefix, '');
	}

	// Remove excessive whitespace and normalize line breaks
	cleaned = cleaned.replace(/\n\s*\n/g, '\n').trim();

	return cleaned;
}

/**
 * Image description generator using AI SDK for vision model access
 */
export class DescriptionGenerator implements LLMClient {
	providerConfig: LLMProviderConfig;
	model: LanguageModel;
	private logger = (() => {
		const appConfig = loadConfig();
		return createLogger({
			level: appConfig.logging.level,
			verbose: appConfig.logging.verbose,
			file: appConfig.logging.file,
			maxFileSizeMb: appConfig.logging.maxFileSizeMb,
			maxFiles: appConfig.logging.maxFiles,
		});
	})();

	constructor() {
		this.providerConfig = this.getProviderConfig();
		this.model = this.initializeClient();
	}

	private getProviderConfig(): LLMProviderConfig {
		const appConfig = loadConfig();
		const riff = appConfig['image-metadata'];
		const providers = appConfig.llmProviders;
		const provider = riff.llm.provider;

		if (provider === 'anthropic') {
			return {
				provider: 'anthropic',
				apiKey: providers.anthropic.apiKey,
				model: providers.anthropic.model,
				timeout: providers.anthropic.timeout,
				maxTokens: providers.anthropic.maxTokens,
				baseUrl: providers.anthropic.baseUrl,
				prompt: normalizePrompt(providers.anthropic.prompt || DEFAULT_PROMPT),
			};
		} else if (provider === 'gemini') {
			return {
				provider: 'gemini',
				apiKey: providers.gemini.apiKey,
				model: providers.gemini.model,
				timeout: providers.gemini.timeout,
				maxTokens: providers.gemini.maxTokens,
				baseUrl: providers.gemini.baseUrl,
				prompt: normalizePrompt(providers.gemini.prompt || DEFAULT_PROMPT),
			};
		} else if (provider === 'ollama') {
			return {
				provider: 'ollama',
				endpoint: providers.ollama.endpoint,
				model: providers.ollama.model,
				timeout: providers.ollama.timeout,
				keepAlive: providers.ollama.keepAlive,
				prompt: normalizePrompt(providers.ollama.prompt || DEFAULT_PROMPT),
			};
		} else {
			throw new Error(`Unknown LLM provider: ${provider}. Supported providers: ollama, anthropic, gemini`);
		}
	}

	private initializeClient(): LanguageModel {
		if (this.providerConfig.provider === 'anthropic') {
			const anthropicProvider = createAnthropic({
				apiKey: this.providerConfig.apiKey,
				baseURL: this.providerConfig.baseUrl,
			});
			return anthropicProvider(this.providerConfig.model);
		} else if (this.providerConfig.provider === 'gemini') {
			const geminiProvider = createGoogleGenerativeAI({
				apiKey: this.providerConfig.apiKey,
			});
			return geminiProvider(this.providerConfig.model);
		} else {
			const ollamaProvider = createOllama({
				baseURL: this.providerConfig.endpoint,
			});
			return ollamaProvider.languageModel(this.providerConfig.model);
		}
	}

	async generateDescription(imagePath: string): Promise<string> {
		try {
			const imageBase64 = await encodeImageToBase64(imagePath);
			const imageUrl = `data:image/jpeg;base64,${imageBase64}`;

			const result = await generateText({
				model: this.model,
				messages: [
					{
						role: 'user',
						content: [
							{
								type: 'image',
								image: imageUrl,
							},
							{
								type: 'text',
								text: this.providerConfig.prompt,
							},
						],
					},
				],
				...((this.providerConfig.provider === 'anthropic' || this.providerConfig.provider === 'gemini') && {
					maxOutputTokens: this.providerConfig.maxTokens,
				}),
			});

			return cleanImageDescription(result.text);
		} catch (error) {
			throw new LlmConnectionError(`Failed to generate description: ${error}`);
		}
	}

	async testConnection(): Promise<boolean> {
		try {
			await generateText({
				model: this.model,
				messages: [
					{
						role: 'user',
						content: 'Hi',
					},
				],
				...((this.providerConfig.provider === 'anthropic' || this.providerConfig.provider === 'gemini') && {
					maxOutputTokens: 10,
				}),
			});

			return true;
		} catch (error) {
			this.logger.warn(
				{
					provider: this.providerConfig.provider,
					error: error instanceof Error ? error.message : String(error),
				},
				'Connection test failed'
			);
			return false;
		}
	}

	async listModels(): Promise<ModelInfo[]> {
		try {
			if (this.providerConfig.provider === 'ollama') {
				const ollama = new Ollama({ host: this.providerConfig.endpoint.replace('/api', '') });
				const response = await ollama.list();
				return response.models.map(model => ({
					name: model.name,
					size: model.size,
					modified_at:
						typeof model.modified_at === 'string' ? model.modified_at : model.modified_at?.toISOString(),
					digest: model.digest,
				}));
			} else if (this.providerConfig.provider === 'anthropic') {
				// Anthropic - use direct HTTP call since SDK may not support models.list yet
				const response = await fetchJson<{
					data: Array<{ id: string; created_at: string; display_name: string }>;
				}>(`${this.providerConfig.baseUrl}/models`, {
					headers: {
						'x-api-key': this.providerConfig.apiKey,
						'anthropic-version': '2023-06-01',
					},
				});
				return response.data.map(model => ({
					name: model.id,
					created_at: model.created_at,
					display_name: model.display_name,
				}));
			} else {
				// Gemini - list models using the Google AI API
				const url = new URL(`${this.providerConfig.baseUrl}/models`);
				url.searchParams.set('key', this.providerConfig.apiKey);
				const response = await fetchJson<{
					models: Array<{
						name: string;
						displayName: string;
						version: string;
						inputTokenLimit?: number;
						outputTokenLimit?: number;
					}>;
				}>(url.toString());
				return response.models.map(model => ({
					name: model.name.replace('models/', ''),
					display_name: model.displayName,
					version: model.version,
					input_token_limit: model.inputTokenLimit,
					output_token_limit: model.outputTokenLimit,
				}));
			}
		} catch (error) {
			throw new LlmConnectionError(`Failed to list models from ${this.providerConfig.provider}: ${error}`);
		}
	}

	get modelName(): string {
		return this.providerConfig.model;
	}

	get endpointUrl(): string {
		if (this.providerConfig.provider === 'anthropic') {
			return this.providerConfig.baseUrl;
		} else if (this.providerConfig.provider === 'gemini') {
			return this.providerConfig.baseUrl;
		} else {
			return this.providerConfig.endpoint;
		}
	}
}
