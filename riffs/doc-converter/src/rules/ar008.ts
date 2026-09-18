import type { AriaRule } from '../lib/types.js';

export const AR008: AriaRule = {
	names: ['AR008', 'unindent-tables'],
	description: 'Remove leading spaces from Markdown table lines',
	tags: ['tables', 'formatting', 'converter'],
	category: 'tables',
	function: (content: string) => content.replace(/^( +)(\|.*\|?)/gm, '$2'),
};
