/**
 * Markdown parser for extracting hierarchical structure
 */

import type { Logger } from 'pino';
import type { MarkdownSection } from '../lib/types.js';

export class MarkdownParser {
	private logger: Logger;

	constructor(logger: Logger) {
		this.logger = logger;
	}

	/**
	 * Parse markdown content into hierarchical sections
	 */
	parse(content: string): MarkdownSection[] {
		this.logger.debug({ contentLength: content.length }, 'Parsing markdown');

		const lines = content.split('\n');
		const sections: MarkdownSection[] = [];
		const stack: MarkdownSection[] = [];

		let currentSection: MarkdownSection | null = null;
		let currentContent: string[] = [];

		for (const line of lines) {
			const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

			if (headingMatch) {
				// Save previous section
				if (currentSection) {
					currentSection.content = currentContent.join('\n').trim();
					currentSection.tokens = this.estimateTokens(currentSection.content);
				}

				// Create new section
				const level = headingMatch[1].length;
				const heading = headingMatch[2].trim();

				const section: MarkdownSection = {
					level,
					heading,
					content: '',
					tokens: 0,
					subsections: [],
				};

				// Handle hierarchy
				while (stack.length > 0 && stack[stack.length - 1].level >= level) {
					stack.pop();
				}

				if (stack.length > 0) {
					section.parent = stack[stack.length - 1];
					stack[stack.length - 1].subsections.push(section);
				} else {
					sections.push(section);
				}

				stack.push(section);
				currentSection = section;
				currentContent = [];
			} else {
				currentContent.push(line);
			}
		}

		// Save last section
		if (currentSection) {
			currentSection.content = currentContent.join('\n').trim();
			currentSection.tokens = this.estimateTokens(currentSection.content);
		}

		this.logger.debug({ sectionCount: sections.length }, 'Markdown parsed');

		return sections;
	}

	/**
	 * Estimate token count (rough approximation)
	 */
	private estimateTokens(text: string): number {
		// Rough estimate: ~4 characters per token
		return Math.ceil(text.length / 4);
	}

	/**
	 * Flatten hierarchical sections
	 */
	flattenSections(sections: MarkdownSection[]): MarkdownSection[] {
		const flattened: MarkdownSection[] = [];

		const traverse = (section: MarkdownSection) => {
			flattened.push(section);
			for (const subsection of section.subsections) {
				traverse(subsection);
			}
		};

		for (const section of sections) {
			traverse(section);
		}

		return flattened;
	}
}
