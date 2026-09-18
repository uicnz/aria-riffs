/**
 * Tree format converter - Unix tree-style visualization
 */

import type { FormatOptions, MindmapNode } from '../lib/types.js';

/**
 * Convert mindmap to Unix tree-style format
 */
export function convertToTree(node: MindmapNode, options?: Partial<FormatOptions>): string {
	const lines: string[] = [];

	// Root node as heading
	const rootLabel = options?.rootLabel || node.text;
	lines.push(`# ${rootLabel}`);
	lines.push('');

	// Tree visualization in code block
	lines.push('```tree');
	lines.push(node.text);

	if (node.children.length > 0) {
		processTreeNode(node.children, '', true, lines);
	}

	lines.push('```');

	return `${lines.join('\n')}\n`;
}

/**
 * Recursively process nodes with tree-style prefixes
 */
function processTreeNode(nodes: MindmapNode[], prefix: string, _isLast: boolean, lines: string[]): void {
	for (let i = 0; i < nodes.length; i++) {
		const node = nodes[i];
		if (!node) continue;
		const isLastNode = i === nodes.length - 1;

		// Build the tree prefix
		const connector = isLastNode ? '└── ' : '├── ';
		lines.push(`${prefix}${connector}${node.text}`);

		// Process children with updated prefix
		if (node.children.length > 0) {
			const childPrefix = prefix + (isLastNode ? '    ' : '│   ');
			processTreeNode(node.children, childPrefix, isLastNode, lines);
		}
	}
}
