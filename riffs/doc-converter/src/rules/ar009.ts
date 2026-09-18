import type { AriaRule } from '../lib/types.js';

export const AR009: AriaRule = {
	names: ['AR009', 'insert-table-separators'],
	description: 'Insert a horizontal rule between consecutive tables',
	tags: ['tables', 'formatting', 'converter'],
	category: 'tables',
	function: (content: string) => {
		const re = /(\n\|.*\|\s*\n)(?:\s*\n)+?(\s*\|.*\|)/gm;
		return content.replace(re, (_m, g1, g2) => `${g1}\n---\n\n${g2}`);
	},
};
