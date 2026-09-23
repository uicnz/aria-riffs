import type { AriaRule } from '../lib/types.js';

export const AR003: AriaRule = {
	names: ['AR003', 'ensure-blank-lines-around-headings'],
	description: 'Ensure exactly one blank line before and after each heading',
	tags: ['headings', 'formatting', 'converter'],
	category: 'headings',
	function: (content: string) => {
		// Add a blank line before and after each heading line, then collapse extras
		const withBounds = content.replace(/^(#{1,6}\s+.+?)\s*$/gm, (_m, h) => `\n${h}\n`);
		let out = withBounds.replace(/\n{3,}/g, '\n\n');
		out = out.replace(/^\n+/, '');
		out = out.replace(/\n+$/, '\n');
		return out;
	},
};
