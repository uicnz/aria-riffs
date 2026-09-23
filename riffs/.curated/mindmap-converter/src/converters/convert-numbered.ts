/**
 * Numbered format converter - proper nested ordered lists
 */

import type { MindmapNode } from '../lib/types.js';

/**
 * Convert mindmap to properly nested ordered lists
 * Every level uses ordered list syntax with sequential numbering
 */
export function convertToNumbered(node: MindmapNode): string {
	const lines: string[] = [];

	// Root node becomes h1 heading
	lines.push(`# ${node.text}`);
	lines.push('');

	// Process children as properly numbered lists
	for (let i = 0; i < node.children.length; i++) {
		const child = node.children[i];
		if (!child) continue;
		processNumberedNode(child, 0, lines, i + 1);

		// Add blank line after each top-level item (except last)
		if (i < node.children.length - 1) {
			lines.push('');
		}
	}

	return `${lines.join('\n')}\n`;
}

/**
 * Strip leading number from text (e.g., "1. Text" -> "Text")
 */
function stripLeadingNumber(text: string): string {
	return text.replace(/^\d+\.\s+/, '');
}

/**
 * Recursively process nodes as ordered list items with proper sequential numbering
 */
function processNumberedNode(node: MindmapNode, depth: number, lines: string[], itemNumber: number): void {
	const indent = '    '.repeat(depth);
	const cleanText = stripLeadingNumber(node.text);
	lines.push(`${indent}${itemNumber}. ${cleanText}`);

	if (node.children.length > 0) {
		for (let i = 0; i < node.children.length; i++) {
			const child = node.children[i];
			if (!child) continue;
			processNumberedNode(child, depth + 1, lines, i + 1);
		}
	}
}
