import type { AriaRule } from '../lib/types.js';

export const AR014: AriaRule = {
	names: ['AR014', 'remove-html-tags'],
	description: 'Remove residual basic HTML tags (excluding <br>)',
	tags: ['html', 'cleanup', 'converter'],
	category: 'html',
	function: (content: string) => {
		const re = /<(?!br\s*\/?)\w+[^>]*>|<\/\w+>/gi;
		return content.replace(re, '');
	},
};
