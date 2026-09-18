import type { AriaRule } from '../lib/types.js';

export const AR007: AriaRule = {
	names: ['AR007', 'indent-nested-lists'],
	description: 'Indent nested bullet lists under ordered lists by 4 spaces (MD029)',
	tags: ['lists', 'formatting', 'converter'],
	category: 'lists',
	function: (content: string) => {
		const lines = content.split('\n');
		const out: string[] = [];
		let i = 0;
		let inOrdered = false;
		while (i < lines.length) {
			const line = lines[i];
			const olMatch = /^(\s*)(\d+)\.(\s+)(.+)$/.exec(line);
			if (olMatch) {
				inOrdered = true;
				out.push(line);
				i++;
				// preserve blank lines after ol item
				while (i < lines.length && lines[i].trim() === '') {
					out.push(lines[i]);
					i++;
				}
				if (i < lines.length) {
					const bullet = /^(\s*)([*-])(\s+)(.+)$/.exec(lines[i]);
					if (bullet && inOrdered) {
						const baseIndent = bullet[1];
						if (baseIndent.length < 4) {
							// indent to 4 spaces for the entire contiguous bullet block at same level
							const indent = '    ';
							out.push(`${indent}${bullet[2]}${bullet[3]}${bullet[4]}`);
							i++;
							while (i < lines.length) {
								if (lines[i].trim() === '') {
									out.push(lines[i]);
									i++;
									continue;
								}
								const nextBullet = /^(\s*)([*-])(\s+)(.+)$/.exec(lines[i]);
								if (nextBullet && nextBullet[1].length === baseIndent.length) {
									out.push(`${indent}${nextBullet[2]}${nextBullet[3]}${nextBullet[4]}`);
									i++;
								} else {
									break;
								}
							}
						}
					}
				}
			} else {
				// leaving an ordered list if line is non-blank and not ol item
				if (inOrdered && line.trim() !== '' && !/^\s*\d+\./.test(line)) inOrdered = false;
				out.push(line);
				i++;
			}
		}
		return out.join('\n');
	},
};
