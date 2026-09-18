import type { AriaRule } from '../lib/types.js';

export const AR004: AriaRule = {
	names: ['AR004', 'remove-trailing-punctuation-from-headings'],
	description: 'Remove trailing punctuation from headings (MD026)',
	tags: ['headings', 'formatting', 'converter'],
	category: 'headings',
	function: (content: string) => {
		return content.replace(/^(#{1,6})\s+(.+?)[\s:!?.;,-]*$/gm, (_m, hashes, text) => {
			const cleaned = String(text).replace(/[\s:!?.;,-]+$/g, '');
			return `${hashes} ${cleaned}`;
		});
	},
};
