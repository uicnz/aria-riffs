/**
 * Legal format converter - hierarchical numbering for formal documents
 */

import type { MindmapNode } from '../lib/types.js';

/**
 * Convert mindmap to legal/formal hierarchical numbering format
 * Uses dot-separated numbering: 1, 1.1, 1.1.1, etc.
 */
export function convertToLegal(node: MindmapNode): string {
	const lines: string[] = [];

	// Root node becomes h1 heading
	lines.push(`# ${node.text}`);
	lines.push('');

	// Process children with hierarchical numbering
	for (let i = 0; i < node.children.length; i++) {
		const child = node.children[i];
		if (!child) continue;
		processLegalNode(child, [(i + 1).toString()], lines);

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
 * Recursively process nodes with hierarchical numbering
 */
function processLegalNode(node: MindmapNode, numberPath: string[], lines: string[]): void {
	const depth = numberPath.length - 1;
	const indent = '    '.repeat(depth);
	const numberLabel = numberPath.join('.');
	const cleanText = stripLeadingNumber(node.text);

	lines.push(`${indent}${numberLabel}. ${cleanText}`);

	if (node.children.length > 0) {
		for (let i = 0; i < node.children.length; i++) {
			const child = node.children[i];
			if (!child) continue;
			const childNumberPath = [...numberPath, (i + 1).toString()];
			processLegalNode(child, childNumberPath, lines);
		}
	}
}
