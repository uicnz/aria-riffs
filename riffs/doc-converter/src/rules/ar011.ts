import type { AriaRule } from '../lib/types.js';

export const AR011: AriaRule = {
	names: ['AR011', 'ensure-images-after-h1'],
	description: 'Move any image references before the first H1 to immediately after it',
	tags: ['images', 'structure', 'converter'],
	category: 'images',
	function: (content: string) => {
		const h1 = content.match(/^#\s+.*$/m);
		if (!h1) return content;
		const h1Start = h1.index ?? 0;
		const h1End = h1Start + h1[0].length;
		const before = content.slice(0, h1End);
		let after = content.slice(h1End);
		// Collect images before H1 start (strictly before heading line)
		const pre = content.slice(0, h1Start);
		const images: string[] = [];
		let cleanedPre = '';
		{
			const re = /(!\[[^\]]*\]\([^)]+\))\s*\n*/g;
			let lastEnd = 0;
			let m: RegExpExecArray | null;
			// biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex exec pattern
			while ((m = re.exec(pre))) {
				images.push(m[1]);
				cleanedPre += pre.slice(lastEnd, m.index);
				lastEnd = m.index + m[0].length;
			}
			cleanedPre += pre.slice(lastEnd);
		}
		if (images.length === 0) return content;
		// ensure single newline after H1 line
		const preH1 = cleanedPre + before;
		const preH1Fixed = preH1.endsWith('\n') ? preH1 : `${preH1}\n`;
		after = after.replace(/^\n+/, '');
		const insertion = `\n${images.join('\n\n')}\n`;
		return preH1Fixed + insertion + after;
	},
};
