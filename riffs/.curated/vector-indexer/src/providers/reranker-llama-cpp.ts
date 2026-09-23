/**
 * llama.cpp re-ranker provider implementation
 * Uses llama-server's /completion endpoint with n_probs for proper logprobs access
 * Implements Qwen3-Reranker's yes/no scoring with token probabilities
 */

import type { Logger } from 'pino';
import type { IRerankerProvider, LlamaCppConfig, RerankerConfig, RerankOptions, RerankResult } from '../lib/types.js';

interface TokenLogprob {
	token: string;
	logprob: number;
}

interface CompletionResponse {
	content: string;
	completion_probabilities?: Array<{
		top_logprobs: TokenLogprob[];
	}>;
}

export class LlamaCppReranker implements IRerankerProvider {
	private host: string;
	private timeout: number;
	private logger: Logger;
	private config: RerankerConfig;
	private initialized: boolean = false;

	constructor(config: RerankerConfig, llamaCppConfig: LlamaCppConfig, logger: Logger) {
		this.config = config;
		this.host = llamaCppConfig.host;
		this.timeout = llamaCppConfig.timeout;
		this.logger = logger;
	}

	/**
	 * Check connection to llama-server on first use
	 */
	private async ensureConnection(): Promise<void> {
		if (this.initialized) return;

		try {
			const response = await fetch(`${this.host}/health`, {
				method: 'GET',
				signal: AbortSignal.timeout(5000),
			});

			if (!response.ok) {
				throw new Error(`llama-server health check failed: ${response.status}`);
			}

			this.logger.info({ host: this.host }, 'llama-server connection verified');
			this.initialized = true;
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.logger.error({ host: this.host, error: message }, 'Failed to connect to llama-server');
			throw new Error(
				`llama-server not available at ${this.host}. ` +
					'Ensure llama-server is running with the Qwen3-Reranker model. ' +
					`Error: ${message}`
			);
		}
	}

	/**
	 * Re-rank documents based on query relevance using logprobs
	 */
	async rerank(
		query: string,
		documents: Array<{ content: string; metadata: Record<string, unknown> }>,
		options?: RerankOptions
	): Promise<RerankResult[]> {
		await this.ensureConnection();

		const topK = options?.topK ?? this.config.finalK;

		this.logger.info({ documentCount: documents.length, topK }, 'Starting re-ranking with llama.cpp');

		const scores: Array<{ index: number; score: number }> = [];

		// Score each document
		for (let i = 0; i < documents.length; i++) {
			const doc = documents[i];

			try {
				const score = await this.scoreDocument(query, doc.content);
				scores.push({ index: i, score });

				this.logger.debug({ docIndex: i, score: score.toFixed(4) }, 'Document scored');
			} catch (error) {
				this.logger.warn({ docIndex: i, error }, 'Failed to score document');
				scores.push({ index: i, score: 0 });
			}
		}

		// Sort by score descending and take topK
		scores.sort((a, b) => b.score - a.score);
		const topResults = scores.slice(0, topK);

		this.logger.info(
			{
				inputCount: documents.length,
				outputCount: topResults.length,
			},
			'Re-ranking complete'
		);

		return topResults.map(({ index, score }) => ({
			index,
			score,
			content: documents[index].content,
			metadata: documents[index].metadata,
		}));
	}

	/**
	 * Score a single document against query using Qwen3-Reranker format
	 */
	private async scoreDocument(query: string, document: string): Promise<number> {
		const prompt = this.buildQwen3Prompt(query, document);

		const response = await fetch(`${this.host}/completion`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				prompt,
				n_predict: 1, // Only need first token (yes/no)
				n_probs: 10, // Get top 10 token probabilities to find yes/no
				temperature: 0,
				cache_prompt: true, // Cache system prompt for efficiency
			}),
			signal: AbortSignal.timeout(this.timeout),
		});

		if (!response.ok) {
			throw new Error(`llama-server request failed: ${response.status}`);
		}

		const data = (await response.json()) as CompletionResponse;

		return this.extractScore(data);
	}

	/**
	 * Build Qwen3-Reranker prompt using proper chat template
	 */
	private buildQwen3Prompt(query: string, document: string): string {
		// Truncate document to prevent context overflow
		const maxDocLength = 2000;
		const truncatedDoc = document.length > maxDocLength ? `${document.slice(0, maxDocLength)}...` : document;

		// Default instruction for relevance assessment
		const instruction = 'Given a web search query, retrieve relevant passages that answer the query';

		// Qwen3-Reranker chat template format
		return (
			'<|im_start|>system\n' +
			'Judge whether the Document meets the requirements based on the Query and the Instruct provided. ' +
			'Note that the answer can only be "yes" or "no".<|im_end|>\n' +
			'<|im_start|>user\n' +
			`<Instruct>: ${instruction}\n` +
			`<Query>: ${query}\n` +
			`<Document>: ${truncatedDoc}<|im_end|>\n` +
			'<|im_start|>assistant\n' +
			'<think>\n\n</think>\n\n'
		);
	}

	/**
	 * Extract relevance score from completion probabilities
	 * Score = yes_prob / (yes_prob + no_prob)
	 */
	private extractScore(response: CompletionResponse): number {
		const topLogprobs = response.completion_probabilities?.[0]?.top_logprobs;

		if (!topLogprobs || topLogprobs.length === 0) {
			// Fallback: parse text output if no probabilities
			this.logger.warn('No completion_probabilities in response, falling back to text parsing');
			return this.parseTextResponse(response.content);
		}

		// Find yes and no token probabilities
		let yesProb = 0;
		let noProb = 0;

		for (const entry of topLogprobs) {
			const token = entry.token.toLowerCase().trim();
			// Convert logprob to probability: prob = exp(logprob)
			const prob = Math.exp(entry.logprob);

			if (token === 'yes') {
				yesProb = prob;
			} else if (token === 'no') {
				noProb = prob;
			}
		}

		// If neither found, try to infer from the generated token
		if (yesProb === 0 && noProb === 0) {
			const generatedToken = response.content.toLowerCase().trim();
			if (generatedToken.startsWith('yes')) {
				return 1.0;
			} else if (generatedToken.startsWith('no')) {
				return 0.0;
			}
			// Unknown output
			this.logger.warn({ content: response.content, topLogprobs }, 'Could not find yes/no probabilities');
			return 0.5;
		}

		// Calculate normalized score
		const total = yesProb + noProb;
		if (total === 0) return 0.5;

		const score = yesProb / total;

		this.logger.debug(
			{
				yesProb: yesProb.toFixed(4),
				noProb: noProb.toFixed(4),
				score: score.toFixed(4),
			},
			'Extracted score from logprobs'
		);

		return score;
	}

	/**
	 * Fallback: parse text response if probabilities not available
	 */
	private parseTextResponse(text: string): number {
		const lower = text.toLowerCase().trim();
		if (lower.startsWith('yes')) return 1.0;
		if (lower.startsWith('no')) return 0.0;
		return 0.5;
	}

	/**
	 * Select best model (not applicable for llama.cpp - model is loaded at server start)
	 */
	async selectBestModel(): Promise<string> {
		return this.config.model;
	}
}
