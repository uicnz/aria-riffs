/**
 * Markdown conversion module
 */

import { DEFAULT_MARKDOWN_OPTIONS } from '../lib/config.js';
import type { MarkdownOptions, MindmapNode } from '../lib/types.js';

/**
 * Convert a mindmap node hierarchy to Markdown format
 */
export function convertToMarkdown(node: MindmapNode, options: Partial<MarkdownOptions> = {}): string {
	const mergedOptions: MarkdownOptions = {
		...DEFAULT_MARKDOWN_OPTIONS,
		...options,
	};

	const lines = processNode(node, 1, mergedOptions);

	// Ensure file ends with single newline
	return `${lines.join('\n')}\n`;
}

/**
 * Recursively process a node and its children
 */
function processNode(node: MindmapNode, level: number, options: MarkdownOptions): string[] {
	const lines: string[] = [];

	// Add blank line before heading (except for first heading)
	if (level > 1) {
		lines.push('');
	}

	// Root node (level 1) becomes h1, children become h2, etc.
	if (level <= options.maxHeadingLevel) {
		const heading = '#'.repeat(level);
		lines.push(`${heading} ${node.text}`);
	} else if (options.useBulletPoints) {
		// After max heading level, use bullet points with indentation
		const indent = '  '.repeat(level - options.maxHeadingLevel - 1);
		lines.push(`${indent}- ${node.text}`);
	} else {
		// If bullet points disabled, just use plain text with indentation
		const indent = '  '.repeat(level - options.maxHeadingLevel - 1);
		lines.push(`${indent}${node.text}`);
	}

	// Process children
	if (options.preserveHierarchy && node.children.length > 0) {
		for (const child of node.children) {
			const childLines = processNode(child, level + 1, options);
			lines.push(...childLines);
		}
	}

	return lines;
}

/**
 * Convert mindmap to flat list format (no hierarchy)
 */
export function convertToFlatList(node: MindmapNode): string {
	const items: string[] = [];

	function collectItems(n: MindmapNode): void {
		items.push(`- ${n.text}`);
		for (const child of n.children) {
			collectItems(child);
		}
	}

	collectItems(node);
	return `${items.join('\n')}\n`;
}

/**
 * Convert mindmap to numbered list format
 */
export function convertToNumberedList(node: MindmapNode, level = 1): string {
	const lines: string[] = [];

	function processNumbered(n: MindmapNode, currentLevel: number): void {
		if (currentLevel === 1) {
			lines.push(`# ${n.text}`);
		} else {
			if (currentLevel === 2 && lines.length > 0) {
				lines.push('');
			}
			const currentIndent = '  '.repeat(currentLevel - 2);
			lines.push(`${currentIndent}1. ${n.text}`);
		}

		for (const child of n.children) {
			processNumbered(child, currentLevel + 1);
		}
	}

	processNumbered(node, level);
	return `${lines.join('\n')}\n`;
}
