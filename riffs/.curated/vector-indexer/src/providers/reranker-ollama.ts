/**
 * Ollama re-ranker provider implementation
 * Uses prompt-based scoring (limited - no logprobs access)
 */

import { totalmem } from 'node:os';
import { generateText } from 'ai';
import { createOllama } from 'ai-sdk-ollama';
import type { Logger } from 'pino';
import type { IRerankerProvider, RerankerConfig, RerankOptions, RerankResult } from '../lib/types.js';

export class OllamaReranker implements IRerankerProvider {
	private ollama: ReturnType<typeof createOllama>;
	private logger: Logger;
	private config: RerankerConfig;

	constructor(config: RerankerConfig, ollamaHost: string, logger: Logger) {
		this.config = config;
		this.logger = logger;
		this.ollama = createOllama({
			baseURL: ollamaHost,
		});
	}

	/**
	 * Re-rank documents based on query relevance
	 */
	async rerank(
		query: string,
		documents: Array<{ content: string; metadata: Record<string, unknown> }>,
		options?: RerankOptions
	): Promise<RerankResult[]> {
		const model = options?.model ?? this.config.model;
		const topK = options?.topK ?? this.config.finalK;

		this.logger.info({ model, documentCount: documents.length, topK }, 'Starting re-ranking');

		const scores: Array<{ index: number; score: number }> = [];

		// Score each document
		for (let i = 0; i < documents.length; i++) {
			const doc = documents[i];
			const prompt = this.buildRerankPrompt(query, doc.content);

			try {
				const { text } = await generateText({
					model: this.ollama.languageModel(model),
					prompt,
					maxOutputTokens: 100, // Enough for reasoning sentence + score
					temperature: 0,
				});

				const score = this.parseScore(text);
				scores.push({ index: i, score });

				this.logger.debug({ docIndex: i, score }, 'Document scored');
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
				model,
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
	 * Build prompt for re-ranking
	 * Uses a critical assessment frame to get meaningful score variance
	 */
	private buildRerankPrompt(query: string, document: string): string {
		// Truncate document to prevent context overflow
		const maxDocLength = 2000;
		const truncatedDoc = document.length > maxDocLength ? `${document.slice(0, maxDocLength)}...` : document;

		return `You are a strict relevance assessor. Evaluate if a document answers a query.

SCORING CRITERIA:
0-2: Completely irrelevant or off-topic
3-4: Related concepts but does NOT answer the query
5-6: Tangentially relevant, missing key information
7-8: Relevant, partially answers the query
9-10: DIRECTLY and COMPLETELY answers the query

Be STRICT. Most documents score 3-6. Score 9-10 ONLY if document is a near-perfect match.

Query: ${query}

Document:
${truncatedDoc}

In one sentence, explain relevance. Then output ONLY a number (0-10) on a new line.

Assessment:`;
	}

	/**
	 * Parse score from model output
	 * Handles format: reasoning sentence followed by score on new line
	 */
	private parseScore(text: string): number {
		const trimmed = text.trim();

		// Try to find a standalone number on its own line (last line typically)
		const lines = trimmed.split('\n');
		for (let i = lines.length - 1; i >= 0; i--) {
			const line = lines[i].trim();
			const match = line.match(/^(\d+(?:\.\d+)?)$/);
			if (match) {
				return Math.min(10, Math.max(0, Number.parseFloat(match[1])));
			}
		}

		// Fallback: find any number in the text
		const anyMatch = trimmed.match(/(\d+(?:\.\d+)?)/);
		if (anyMatch) {
			return Math.min(10, Math.max(0, Number.parseFloat(anyMatch[1])));
		}

		this.logger.warn({ text: trimmed.slice(0, 100) }, 'Could not parse score from model output');
		return 0;
	}

	/**
	 * Select best model based on available memory
	 */
	async selectBestModel(): Promise<string> {
		const totalMemoryGb = totalmem() / 1024 ** 3;

		this.logger.debug({ totalMemoryGb, threshold: this.config.memoryThresholdGb }, 'Checking available memory');

		if (totalMemoryGb >= this.config.memoryThresholdGb) {
			this.logger.info({ model: this.config.highMemoryModel }, 'Using high-memory model');
			return this.config.highMemoryModel;
		}

		this.logger.info({ model: this.config.model }, 'Using standard model');
		return this.config.model;
	}
}
