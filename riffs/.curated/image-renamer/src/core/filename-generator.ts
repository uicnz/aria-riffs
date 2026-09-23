/**
 * Filename generator service
 * Generates descriptive filenames for images using vision-capable LLM providers
 */

import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText, type LanguageModel } from 'ai';
import { createOllama } from 'ai-sdk-ollama';
import { Ollama } from 'ollama';
import { createLogger } from '../lib/logger.js';
import type { ImageRenamerConfig } from '../lib/schema.js';
import { type LLMClient, type LLMProviderConfig, LlmConnectionError, type ModelInfo } from '../lib/types.js';
import { encodeImageToBase64, retryWithBackoff } from '../utils/utils.js';

const DEFAULT_PROMPT = 'Generate a concise, descriptive filename for this image in 4-5 words';

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
	const response = init ? await fetch(url, init) : await fetch(url);
	if (!response.ok) {
		throw new Error(`Request failed with HTTP ${response.status} ${response.statusText}`);
	}
	return (await response.json()) as T;
}

/**
 * Filename generator using AI SDK for vision model access
 */
export class FilenameGenerator implements LLMClient {
	private providerConfig: LLMProviderConfig;
	private model: LanguageModel;
	private logger;

	constructor(config: ImageRenamerConfig) {
		this.providerConfig = this.getProviderConfig(config);
		this.model = this.initializeClient();
		this.logger = createLogger({
			level: config.logging.level,
			verbose: config.logging.verbose,
			file: config.logging.file,
			maxFileSizeMb: config.logging.maxFileSizeMb,
			maxFiles: config.logging.maxFiles,
		});
	}

	private getProviderConfig(config: ImageRenamerConfig): LLMProviderConfig {
		const riffConfig = config['image-renamer'];
		const provider = riffConfig.llm.provider;

		if (provider === 'anthropic') {
			return {
				provider: 'anthropic',
				apiKey: riffConfig.llm.anthropic.apiKey,
				model: riffConfig.llm.anthropic.model,
				timeout: riffConfig.llm.anthropic.timeout,
				maxTokens: riffConfig.llm.anthropic.maxTokens,
				baseUrl: riffConfig.llm.anthropic.baseUrl,
				prompt: riffConfig.llm.anthropic.prompt || DEFAULT_PROMPT,
			};
		} else if (provider === 'gemini') {
			return {
				provider: 'gemini',
				apiKey: riffConfig.llm.gemini.apiKey,
				model: riffConfig.llm.gemini.model,
				timeout: riffConfig.llm.gemini.timeout,
				maxTokens: riffConfig.llm.gemini.maxTokens,
				baseUrl: riffConfig.llm.gemini.baseUrl,
				prompt: riffConfig.llm.gemini.prompt || DEFAULT_PROMPT,
			};
		} else if (provider === 'ollama') {
			return {
				provider: 'ollama',
				endpoint: riffConfig.llm.ollama.endpoint,
				model: riffConfig.llm.ollama.model,
				timeout: riffConfig.llm.ollama.timeout,
				retryAttempts: riffConfig.llm.ollama.retryAttempts,
				retryDelay: riffConfig.llm.ollama.retryDelay,
				prompt: riffConfig.llm.ollama.prompt || DEFAULT_PROMPT,
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

	async generateFilename(imagePath: string, customPrompt?: string): Promise<string> {
		const prompt = customPrompt || this.providerConfig.prompt;

		try {
			if (this.providerConfig.provider === 'ollama') {
				return await retryWithBackoff(
					async () => {
						return await this.generateWithAiSdk(imagePath, prompt);
					},
					this.providerConfig.retryAttempts,
					this.providerConfig.retryDelay
				);
			} else {
				return await this.generateWithAiSdk(imagePath, prompt);
			}
		} catch (error) {
			if (this.providerConfig.provider === 'ollama') {
				throw new LlmConnectionError(
					`Failed to generate filename after ${this.providerConfig.retryAttempts} attempts: ${error}`
				);
			} else {
				throw new LlmConnectionError(`Failed to generate filename: ${error}`);
			}
		}
	}

	private async generateWithAiSdk(imagePath: string, prompt: string): Promise<string> {
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
								text: prompt,
							},
						],
					},
				],
				...((this.providerConfig.provider === 'anthropic' || this.providerConfig.provider === 'gemini') && {
					maxOutputTokens: this.providerConfig.maxTokens,
				}),
			});

			const description = result.text?.trim();

			if (!description) {
				throw new LlmConnectionError('Empty response from LLM API');
			}

			return description;
		} catch (error) {
			throw new LlmConnectionError(`LLM API error: ${error}`);
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
