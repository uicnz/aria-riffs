/**
 * Extraction orchestrator - Coordinates multiple extraction strategies with fallback
 */

import type { Logger } from 'pino';
import type { BaseExtractor, ExtractionResult } from './define-extractor.js';

export type ExtractionMethod = 'auto' | 'applescript' | 'database' | 'graph-api';

/**
 * Orchestrates multiple extraction strategies with automatic fallback
 */
export class ExtractionOrchestrator {
	private extractors: BaseExtractor[];
	private preferredMethod: ExtractionMethod;
	private fallbackEnabled: boolean;
	private logger: Logger;

	constructor(
		preferredMethod: ExtractionMethod,
		extractors: BaseExtractor[],
		fallbackEnabled: boolean = true,
		logger: Logger
	) {
		this.preferredMethod = preferredMethod;
		this.extractors = extractors;
		this.fallbackEnabled = fallbackEnabled;
		this.logger = logger;
	}

	/**
	 * Extract SharePoint link using configured strategy
	 */
	async extract(filePath: string): Promise<ExtractionResult> {
		// Specific method mode - use only the requested extractor
		if (this.preferredMethod !== 'auto') {
			const extractor = this.extractors.find(e => e.getName() === this.preferredMethod);

			if (!extractor) {
				throw new Error(`Unknown extraction method: ${this.preferredMethod}`);
			}

			if (!(await extractor.validate())) {
				throw new Error(`Extractor '${this.preferredMethod}' not available`);
			}

			return extractor.extract(filePath);
		}

		// Auto mode - try extractors in priority order with optional fallback
		let lastError: string | undefined;

		for (const extractor of this.extractors) {
			// Skip if not available
			if (!(await extractor.validate())) {
				continue;
			}

			try {
				const result = await extractor.extract(filePath);

				if (result.url) {
					return result;
				}

				// Track error for final result
				lastError = result.error;

				// If fallback disabled, stop after first attempt
				if (!this.fallbackEnabled) {
					break;
				}
			} catch (error) {
				const errorMsg = error instanceof Error ? error.message : String(error);
				lastError = `${extractor.getName()} failed: ${errorMsg}`;

				// If fallback disabled, propagate error
				if (!this.fallbackEnabled) {
					throw error;
				}

				// Otherwise continue to next extractor
				this.logger.warn({ error: lastError }, 'Extractor failed, trying next');
			}
		}

		// All extractors failed
		return {
			url: null,
			error: lastError || 'All extraction methods failed',
			method: 'applescript',
		};
	}

	/**
	 * Get list of available extractors
	 */
	async getAvailableExtractors(): Promise<string[]> {
		const available: string[] = [];

		for (const extractor of this.extractors) {
			if (await extractor.validate()) {
				available.push(extractor.getName());
			}
		}

		return available;
	}

	/**
	 * Cleanup resources for all extractors
	 */
	cleanup(): void {
		for (const extractor of this.extractors) {
			// Call cleanup if extractor has the method
			if ('cleanup' in extractor && typeof extractor.cleanup === 'function') {
				extractor.cleanup();
			}
		}
	}
}
