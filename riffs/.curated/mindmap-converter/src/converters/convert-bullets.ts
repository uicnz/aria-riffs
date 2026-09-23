/**
 * Bullets format converter - mixed format with numbers at top level, bullets for sub-items
 */

import type { MindmapNode } from '../lib/types.js';

/**
 * Convert mindmap to mixed format (numbers + bullets)
 * Top-level items are numbered, sub-items are bullets with 4-space indentation
 */
export function convertToBullets(node: MindmapNode): string {
	const lines: string[] = [];

	// Root node becomes h1 heading
	lines.push(`# ${node.text}`);
	lines.push('');

	// Process children - first level as numbers, deeper as bullets
	for (let i = 0; i < node.children.length; i++) {
		const child = node.children[i];
		if (!child) continue;

		// Top-level item (no dash, text already contains number)
		lines.push(child.text);

		// Process sub-items as bullets
		if (child.children.length > 0) {
			processBulletNode(child.children, 1, lines);
		}

		// Add blank line after each top-level item (except last)
		if (i < node.children.length - 1) {
			lines.push('');
		}
	}

	return `${lines.join('\n')}\n`;
}

/**
 * Recursively process nodes as bullets with 4-space indentation
 */
function processBulletNode(nodes: MindmapNode[], depth: number, lines: string[]): void {
	for (const node of nodes) {
		const indent = '    '.repeat(depth);
		lines.push(`${indent}- ${node.text}`);

		if (node.children.length > 0) {
			processBulletNode(node.children, depth + 1, lines);
		}
	}
}
