import type { AriaRule } from '../lib/types.js';

export const AR016: AriaRule = {
	names: ['AR016', 'remove-stray-hashes'],
	description: 'Remove lines with only hashes and inline stray hashes',
	tags: ['html', 'cleanup', 'converter'],
	category: 'html',
	function: (content: string) => {
		let out = content;
		// Remove isolated lines of only hashes surrounded by blank lines (preserve blanks)
		out = out.replace(/(?<=\n\n)\s*#+\s*(?=\n\n)/g, '');

		// Remove stray hashes at line end or standalone after whitespace
		const lines = out.split('\n');
		for (let i = 0; i < lines.length; i++) {
			lines[i] = lines[i].replace(/(^|\s)#+\s*$/g, '$1');
		}
		return lines.join('\n');
	},
};
