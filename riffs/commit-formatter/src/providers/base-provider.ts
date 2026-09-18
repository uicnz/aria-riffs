/**
 * Base provider interface for LLM providers
 * All providers must implement this interface
 */

import type { CommitInfo } from '../lib/types.js';

export interface ProviderConfig {
	provider: 'anthropic' | 'gemini' | 'openai';
	model: string;
	temperature: number;
	maxTokens: number;
	apiKey: string;
	baseUrl?: string;
}

export interface LLMProvider {
	/**
	 * Generate a conventional commit message from commit information
	 */
	generateCommitMessage(commit: CommitInfo): Promise<string>;

	/**
	 * Test connection to the provider API
	 */
	testConnection(): Promise<boolean>;

	/**
	 * Get the provider name
	 */
	getProviderName(): string;

	/**
	 * Get the model name
	 */
	getModelName(): string;
}

export abstract class BaseLLMProvider implements LLMProvider {
	protected config: ProviderConfig;

	constructor(config: ProviderConfig) {
		this.config = config;
	}

	abstract generateCommitMessage(commit: CommitInfo): Promise<string>;
	abstract testConnection(): Promise<boolean>;

	getProviderName(): string {
		return this.config.provider;
	}

	getModelName(): string {
		return this.config.model;
	}

	/**
	 * Clean LLM response formatting
	 */
	protected cleanCommitMessage(message: string): string {
		return message
			.trim()
			.replace(/^["']|["']$/g, '') // Remove surrounding quotes
			.replace(/\.+$/, '') // Remove trailing periods
			.trim();
	}

	/**
	 * Build prompt from commit information
	 * Provides comprehensive context for accurate classification
	 */
	protected buildPrompt(commit: CommitInfo): string {
		// Show more files (30 instead of 10) for better scope understanding
		const filesSummary = commit.filesChanged.slice(0, 30).join('\n  - ');
		const moreFiles =
			commit.filesChanged.length > 30 ? `\n  - ... and ${commit.filesChanged.length - 30} more files` : '';

		// Extract stat summary for magnitude awareness
		const statMatch = commit.diffSummary.match(
			/(\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?/
		);
		const filesChanged = statMatch ? statMatch[1] : commit.filesChanged.length.toString();
		const insertions = statMatch?.[2] ? statMatch[2] : 'unknown';
		const deletions = statMatch?.[3] ? statMatch[3] : 'unknown';

		return `Current commit message: "${commit.message}"

SCALE ANALYSIS:
  Files changed: ${filesChanged}
  Lines added: +${insertions}
  Lines deleted: -${deletions}

FILES CHANGED (${commit.filesChanged.length} total):
  - ${filesSummary}${moreFiles}

DIFF SUMMARY (detailed context for accurate classification):
${commit.diffSummary.slice(0, 2000)}${commit.diffSummary.length > 2000 ? '\n\n[... diff truncated for length ...]' : ''}

TASK: Analyze the scale, scope, and nature of these changes. Determine if this is a feat (new functionality), fix (bug repair), chore (maintenance), docs (documentation), or other type. Consider the magnitude: large additions of new riffs/features = feat, not chore.

Convert this to conventional commit format:`;
	}
}
