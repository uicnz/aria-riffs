/**
 * OpenAI provider for commit message generation
 */

import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { SYSTEM_PROMPT } from '../core/system-prompt.js';
import { CommitFormatterError, type CommitInfo } from '../lib/types.js';
import { BaseLLMProvider, type ProviderConfig } from './base-provider.js';

export class OpenAIProvider extends BaseLLMProvider {
	private model;

	constructor(config: ProviderConfig) {
		super(config);

		const openai = createOpenAI({
			apiKey: config.apiKey,
			baseURL: config.baseUrl,
		});

		this.model = openai(config.model);
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
			throw new CommitFormatterError(`OpenAI API error: ${error}`);
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
