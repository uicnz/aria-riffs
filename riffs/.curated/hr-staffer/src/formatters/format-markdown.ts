import type { FormatOptions, OrgNode } from '../lib/types.js';
import { formatAsMermaid } from './format-mermaid.js';

/**
 * Format org tree as Markdown with hierarchical headings
 */
export function formatAsMarkdown(node: OrgNode, options: FormatOptions = {}, breakDownTeams: string[] = []): string {
	const { includeTitle = true, includeDepartment = true, maxDepth = Infinity } = options;

	const lines: string[] = [];

	// Add document title
	lines.push('# Organization Chart');
	lines.push('');
	lines.push(
		'This document represents the organizational hierarchy. Reporting relationships are shown through header nesting - subordinates appear as nested headings under their manager. These relationships are further visualized in the Mermaid diagrams at the end of this document.'
	);
	lines.push('');

	function formatNode(node: OrgNode, depth: number): void {
		if (depth > maxDepth) {
			return;
		}

		const emp = node.employee;
		// Start at H2 since H1 is the document title
		const headingLevel = Math.min(depth + 2, 6);
		const heading = '#'.repeat(headingLevel);

		lines.push(`${heading} ${emp.displayName}`);
		lines.push('');

		const details: string[] = [];

		if (includeTitle) {
			details.push(`- Title: ${emp.title}`);
		}

		if (includeDepartment) {
			details.push(`- Department: ${emp.department}`);
		}

		// Always include manager (explicit reporting line)
		details.push(`- Manager: ${emp.manager}`);

		// Always include full contact schema
		details.push(`- Email: <${emp.email}>`);
		details.push(`- Phone: ${emp.mobile}`);
		details.push(`- Street Address: ${emp.streetAddress}`);
		details.push(`- City: ${emp.city}`);
		details.push(`- Country: ${emp.country}`);

		if (node.directReports.length > 0) {
			details.push(`- Direct Reports: ${node.directReports.length}`);
		}

		if (details.length > 0) {
			lines.push(details.join('\n'));
			lines.push('');
		}

		// Process direct reports
		for (const report of node.directReports) {
			formatNode(report, depth + 1);
		}
	}

	formatNode(node, 0);

	// Append Mermaid diagrams section
	lines.push('---');
	lines.push('');
	lines.push('## Organization Charts');
	lines.push('');
	lines.push(formatAsMermaid(node, options, breakDownTeams));

	return lines.join('\n');
}
