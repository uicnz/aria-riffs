import type { AriaRule } from '../lib/types.js';

export const AR017: AriaRule = {
	names: ['AR017', 'remove-trailing-whitespace'],
	description: 'Remove trailing whitespace at end of lines',
	tags: ['whitespace', 'cleanup', 'converter'],
	category: 'whitespace',
	function: (content: string) => content.replace(/ +$/gm, ''),
};
