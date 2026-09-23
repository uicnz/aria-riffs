import type { AriaRule } from '../lib/types.js';

export const AR001: AriaRule = {
	names: ['AR001', 'ensure-h1-header'],
	description: 'Ensure document starts with a single H1; add from filename if missing',
	tags: ['headings', 'structure', 'converter'],
	category: 'headings',
	function: (content: string, _options, ctx) => {
		const firstLine = content.split('\n', 1)[0] ?? '';
		const startsWithH1 = /^#\s+.*$/.test(firstLine);
		if (startsWithH1) return content;
		const stem = ctx?.docxFilenameStem ?? 'Document';
		const title = stem.replace(/-/g, ' ').replace(/\b\w/g, m => m.toUpperCase());
		return `# ${title}\n\n${content}`;
	},
};
