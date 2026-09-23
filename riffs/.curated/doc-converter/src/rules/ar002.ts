import type { AriaRule } from '../lib/types.js';

export const AR002: AriaRule = {
	names: ['AR002', 'demote-subsequent-h1'],
	description: 'Demote subsequent H1 headings and their subheadings',
	tags: ['headings', 'structure', 'converter'],
	category: 'headings',
	function: (content: string) => {
		const lines = content.split('\n');
		let firstH1Found = false;
		// demotion map active after a subsequent H1 appears
		let demotionMap: Record<number, number> = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6 };
		const out: string[] = [];

		const headingRe = /^(#{1,6})\s+(.*)/;
		for (const line of lines) {
			const m = line.match(headingRe);
			if (!m) {
				out.push(line);
				continue;
			}
			const level = m[1].length;
			const text = m[2];
			if (level === 1) {
				if (!firstH1Found) {
					firstH1Found = true;
					demotionMap = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6 };
					out.push(line);
				} else {
					demotionMap = { 1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 6 };
					const newLevel = demotionMap[level] ?? 6;
					out.push(`${'#'.repeat(newLevel)} ${text}`);
				}
			} else {
				const newLevel = demotionMap[level] ?? 6;
				out.push(`${'#'.repeat(newLevel)} ${text}`);
			}
		}
		return out.join('\n');
	},
};
