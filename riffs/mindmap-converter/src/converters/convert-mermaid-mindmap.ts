/**
 * Mermaid Mindmap format converter
 */

import type { FormatOptions, MindmapNode } from '../lib/types.js';

/**
 * Convert mindmap to Mermaid mindmap diagram format
 */
export function convertToMermaidMindmap(node: MindmapNode, options?: Partial<FormatOptions>): string {
	const lines: string[] = [];

	// Root node as heading
	const rootLabel = options?.rootLabel || node.text;
	lines.push(`# ${rootLabel}`);
	lines.push('');

	// Mermaid mindmap diagram
	lines.push('```mermaid');
	lines.push('mindmap');

	// Root node with circular shape - exact syntax from docs
	lines.push(`  root((${cleanText(node.text)}))`);

	// Process children with simple indentation
	if (node.children.length > 0) {
		processMermaidNode(node.children, 1, lines);
	}

	lines.push('```');

	return `${lines.join('\n')}\n`;
}

/**
 * Recursively process nodes with indentation only
 */
function processMermaidNode(nodes: MindmapNode[], depth: number, lines: string[]): void {
	for (const node of nodes) {
		const indent = '  '.repeat(depth + 1); // Add 1 for base indentation after root
		const text = cleanText(node.text);
		lines.push(`${indent}${text}`);

		if (node.children.length > 0) {
			processMermaidNode(node.children, depth + 1, lines);
		}
	}
}

/**
 * Clean text for Mermaid - remove all special characters that break parsing
 */
function cleanText(text: string): string {
	return (
		text
			// Remove all parentheses
			.replace(/[()]/g, '')
			// Remove all square brackets
			.replace(/[[\]]/g, '')
			// Remove all curly braces
			.replace(/[{}]/g, '')
			// Keep colons, commas, slashes as they seem to work
			// Clean up multiple spaces
			.replace(/\s+/g, ' ')
			.trim()
	);
}
