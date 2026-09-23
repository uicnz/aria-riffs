/**
 * Commit message generator service
 * Orchestrates LLM providers to generate conventional commit messages
 */

import { loadConfig } from '../lib/config.js';
import { CommitFormatterError, type CommitInfo } from '../lib/types.js';
import type { LLMProvider } from '../providers/base-provider.js';
import { createProvider } from '../providers/provider-factory.js';

export class CommitMessageGenerator {
	private provider: LLMProvider;

	constructor() {
		const appConfig = loadConfig();
		const riff = appConfig['commit-formatter'];
		const providerName = riff.llm.provider;
		const providerSettings = riff.llm[providerName];

		if (!providerSettings.apiKey) {
			const envVar = `${providerName.toUpperCase()}_API_KEY`;
			throw new CommitFormatterError(
				`${envVar} environment variable is required. Set it in your .env file or environment.`
			);
		}

		// Create provider config
		const providerConfig = {
			provider: providerName,
			model: providerSettings.model,
			temperature: 'temperature' in providerSettings ? providerSettings.temperature : undefined,
			maxTokens: providerSettings.maxTokens,
			apiKey: providerSettings.apiKey,
			baseUrl: providerSettings.baseUrl,
		};

		// Create provider instance using factory
		this.provider = createProvider(providerConfig);
	}

	async generateCommitMessage(commit: CommitInfo): Promise<string> {
		return this.provider.generateCommitMessage(commit);
	}

	async testConnection(): Promise<boolean> {
		return this.provider.testConnection();
	}

	getProviderName(): string {
		return this.provider.getProviderName();
	}

	getModelName(): string {
		return this.provider.getModelName();
	}
}
