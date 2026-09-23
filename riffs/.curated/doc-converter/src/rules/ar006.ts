import type { AriaRule } from '../lib/types.js';

export const AR006: AriaRule = {
	names: ['AR006', 'fix-list-marker-spacing'],
	description: 'Ensure single space after list markers and avoid touching --- or bold markers',
	tags: ['lists', 'formatting', 'converter'],
	category: 'lists',
	function: (content: string) => {
		// Add a space if missing after -, *, or number. Avoid horizontal rules and bold markers
		const addSpace = /^(?!-{3}$)( *)([-*]|\d+\.)(?![\s*])/gm;
		const withSpace = content.replace(addSpace, '$1$2 ');
		// Collapse multiple spaces after marker to one
		const collapse = /^( *)([-*]|\d+\.)\s{2,}/gm;
		return withSpace.replace(collapse, '$1$2 ');
	},
};
