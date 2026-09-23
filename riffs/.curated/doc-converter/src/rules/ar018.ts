import type { AriaRule } from '../lib/types.js';

export const AR018: AriaRule = {
	names: ['AR018', 'normalize-blank-lines'],
	description: 'Collapse multiple blank lines to a single blank line',
	tags: ['whitespace', 'formatting', 'converter'],
	category: 'whitespace',
	function: (content: string) => content.replace(/\n{2,}/g, '\n\n'),
};
