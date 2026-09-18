/**
 * Anthropic Claude provider for commit message generation
 */

import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { SYSTEM_PROMPT } from '../core/system-prompt.js';
import { CommitFormatterError, type CommitInfo } from '../lib/types.js';
import { BaseLLMProvider, type ProviderConfig } from './base-provider.js';

export class AnthropicProvider extends BaseLLMProvider {
	private model;

	constructor(config: ProviderConfig) {
		super(config);

		const anthropic = createAnthropic({
			apiKey: config.apiKey,
			baseURL: config.baseUrl || 'https://api.anthropic.com/v1',
		});

		this.model = anthropic(config.model);
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
				// Enable extended thinking for better analysis
				experimental_telemetry: {
					isEnabled: true,
					functionId: 'commit-formatter',
				},
			});

			return this.cleanCommitMessage(result.text);
		} catch (error) {
			throw new CommitFormatterError(`Anthropic API error: ${error}`);
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
