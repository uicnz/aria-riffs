/**
 * Metadata extraction from content using regex patterns
 * Uses the repository's canonical YAML parser for frontmatter parsing.
 */

import type { Logger } from 'pino';
import { parse } from 'yaml';
import type { MetadataExtractionConfig } from '../lib/types.js';

export class MetadataExtractor {
	private logger: Logger;
	private config: MetadataExtractionConfig;

	constructor(config: MetadataExtractionConfig, logger: Logger) {
		this.config = config;
		this.logger = logger;
	}

	/**
	 * Extract metadata from content
	 */
	extract(content: string): Record<string, string> {
		if (!this.config.enabled) {
			return {};
		}

		const metadata: Record<string, string> = {};

		for (const pattern of this.config.patterns) {
			try {
				const regex = new RegExp(pattern.regex, 'gm');
				const matches = content.match(regex);

				if (matches && matches.length > 0) {
					// Use first match
					const match = matches[0];
					const groups = new RegExp(pattern.regex).exec(match);

					if (groups?.[pattern.captureGroup]) {
						metadata[pattern.name] = groups[pattern.captureGroup].trim();
						this.logger.debug(
							{
								pattern: pattern.name,
								value: metadata[pattern.name],
							},
							'Metadata extracted'
						);
					}
				}
			} catch (error) {
				this.logger.warn({ pattern: pattern.name, error }, 'Failed to extract metadata');
			}
		}

		return metadata;
	}

	/**
	 * Extract frontmatter metadata
	 * Handles complex YAML including arrays, multi-line values, nested objects
	 */
	extractFrontmatter(content: string): Record<string, unknown> {
		try {
			const frontmatter = content.match(/^\uFEFF?---[\t ]*\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)[\t ]*(?:\r?\n|$)/);
			if (!frontmatter) {
				return {};
			}

			const data = parse(frontmatter[1]);

			if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).length === 0) {
				return {};
			}

			this.logger.debug({ keys: Object.keys(data) }, 'Frontmatter extracted');

			return data as Record<string, unknown>;
		} catch (error) {
			this.logger.warn({ error }, 'Failed to parse frontmatter');
			return {};
		}
	}
}
