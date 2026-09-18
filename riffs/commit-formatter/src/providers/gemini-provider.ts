/**
 * Google Gemini provider for commit message generation
 */

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import { SYSTEM_PROMPT } from '../core/system-prompt.js';
import { CommitFormatterError, type CommitInfo } from '../lib/types.js';
import { BaseLLMProvider, type ProviderConfig } from './base-provider.js';

export class GeminiProvider extends BaseLLMProvider {
	private model;

	constructor(config: ProviderConfig) {
		super(config);

		const gemini = createGoogleGenerativeAI({
			apiKey: config.apiKey,
			baseURL: config.baseUrl,
		});

		this.model = gemini(config.model);
	}

	async generateCommitMessage(commit: CommitInfo): Promise<string> {
		try {
			const prompt = this.buildPrompt(commit);

			const result = await generateText({
				model: this.model,
				messages: [
					{
						role: 'user',
						content: prompt,
					},
				],
				system: SYSTEM_PROMPT,
				maxOutputTokens: this.config.maxTokens,
				temperature: this.config.temperature,
			});

			return this.cleanCommitMessage(result.text);
		} catch (error) {
			throw new CommitFormatterError(`Gemini API error: ${error}`);
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
				maxOutputTokens: 10,
			});
			return true;
		} catch {
			return false;
		}
	}
}
