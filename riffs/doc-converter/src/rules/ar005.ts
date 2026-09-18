import type { AriaRule } from '../lib/types.js';

export const AR005: AriaRule = {
	names: ['AR005', 'fix-emphasis-as-heading'],
	description: 'Add a colon after emphasized-only lines used as headings (MD036)',
	tags: ['headings', 'formatting', 'converter'],
	category: 'headings',
	function: (content: string) => {
		const lines = content.split('\n');
		const out: string[] = [];
		for (let i = 0; i < lines.length; i++) {
			let line = lines[i];
			const emphasisOnly = /^\s*(\*\*[^*\n]+\*\*|\*[^*\n]+\*)\s*$/.test(line);
			if (emphasisOnly) {
				const blankBefore = i === 0 || lines[i - 1].trim() === '';
				const blankAfter = i === lines.length - 1 || lines[i + 1].trim() === '';
				if (blankBefore && blankAfter && !line.trimEnd().endsWith(':')) {
					line = `${line.trimEnd()}:`;
				}
			}
			out.push(line);
		}
		return out.join('\n');
	},
};
