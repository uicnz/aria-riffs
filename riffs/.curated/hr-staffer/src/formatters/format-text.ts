import type { FormatOptions, OrgNode } from '../lib/types.js';

/**
 * Format org tree as indented text hierarchy
 */
export function formatAsText(node: OrgNode, options: FormatOptions = {}): string {
	const { includeTitle = true, includeDepartment = false, includeEmail = false, maxDepth = Infinity } = options;

	const lines: string[] = [];

	function formatNode(node: OrgNode, depth: number, indent: string): void {
		if (depth > maxDepth) {
			return;
		}

		const emp = node.employee;
		const parts: string[] = [emp.displayName];

		if (includeTitle) {
			parts.push(`(${emp.title})`);
		}

		if (includeDepartment) {
			parts.push(`[${emp.department}]`);
		}

		if (includeEmail) {
			parts.push(`<${emp.email}>`);
		}

		lines.push(`${indent}${parts.join(' ')}`);

		// Process direct reports
		const newIndent = `${indent}  `;
		for (const report of node.directReports) {
			formatNode(report, depth + 1, newIndent);
		}
	}

	formatNode(node, 0, '');

	return lines.join('\n');
}
