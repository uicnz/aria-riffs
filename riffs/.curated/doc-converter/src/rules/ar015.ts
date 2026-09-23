import type { AriaRule } from '../lib/types.js';

export const AR015: AriaRule = {
	names: ['AR015', 'remove-html-comments'],
	description: 'Remove HTML comments',
	tags: ['html', 'cleanup', 'converter'],
	category: 'html',
	function: (content: string) => content.replace(/<!--[\s\S]*?-->/g, ''),
};
