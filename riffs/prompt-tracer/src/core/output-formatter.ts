/**
 * Pure functions for formatting output markdown
 */

import type { Riff } from '../lib/types.js';

const outputBrandLabel = 'Anthropic Coding CLI';

export interface OutputData {
	versionLabel: string;
	releaseDate: string;
	userMessage: string;
	systemPrompt: string;
	riffs: Riff[];
}

/**
 * Add an extra # to all markdown headers in text
 * This indents headers by one level (e.g., # becomes ##)
 * @param text - Text containing markdown headers
 * @returns Text with indented headers
 */
export function indentHeaders(text: string): string {
	return text
		.split('\n')
		.map(line => {
			const match = line.match(/^(#+)(\s+)/);
			if (match) {
				return `#${line}`;
			}
			return line;
		})
		.join('\n');
}

/**
 * Format riffs as markdown sections
 * @param riffs - Array of riffs to format
 * @returns Formatted markdown string
 */
export function formatRiffs(riffs: Riff[]): string {
	return riffs
		.map(riff => {
			const schemaStr = JSON.stringify(riff.input_schema, null, 2);
			// Apply indentation twice to make headers in riff descriptions smaller
			const indentedDescription = indentHeaders(indentHeaders(riff.description));
			return `## ${riff.name}\n\n${indentedDescription}\n${schemaStr}`;
		})
		.join('\n\n---\n\n');
}

/**
 * Format complete output document
 * @param data - Output data structure
 * @returns Complete formatted markdown document
 */
export function formatOutput(data: OutputData): string {
	const riffsSection = formatRiffs(data.riffs);

	return `# ${outputBrandLabel} Version ${data.versionLabel}

Release Date: ${data.releaseDate}

# User Message

${indentHeaders(data.userMessage)}

# System Prompt

${indentHeaders(data.systemPrompt)}

# Riffs

${riffsSection}
`;
}
