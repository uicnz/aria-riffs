/**
 * Headers format converter - nested Markdown headers (h1-h6)
 */

import type { MarkdownOptions, MindmapNode } from '../lib/types.js';

/**
 * Convert mindmap to nested Markdown headers
 */
export function convertToHeaders(node: MindmapNode, options: Partial<MarkdownOptions> = {}): string {
	const maxHeadingLevel = options.maxHeadingLevel ?? 6;
	const useBulletPoints = options.useBulletPoints ?? true;
	const preserveHierarchy = options.preserveHierarchy ?? true;

	const lines = processNode(node, 1, {
		maxHeadingLevel,
		useBulletPoints,
		preserveHierarchy,
	});

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
