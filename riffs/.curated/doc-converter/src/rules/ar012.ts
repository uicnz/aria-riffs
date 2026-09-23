import type { AriaRule } from '../lib/types.js';

export const AR012: AriaRule = {
	names: ['AR012', 'update-image-alt-text'],
	description: 'Set image alt text to nearest preceding heading text',
	tags: ['images', 'formatting', 'converter'],
	category: 'images',
	function: (content: string) => {
		const headerRe = /^(#{1,6})\s+(.*?)$/gm;
		const headers: { text: string; index: number }[] = [];
		let m: RegExpExecArray | null;
		// biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex exec pattern
		while ((m = headerRe.exec(content))) {
			headers.push({ text: m[2].trim(), index: m.index });
		}
		if (headers.length === 0) return content;

		const imgRe = /!\[(.*?)\]\((.*?)\)/g;
		const matches: { start: number; end: number; alt: string; src: string }[] = [];
		// biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex exec pattern
		while ((m = imgRe.exec(content))) {
			matches.push({ start: m.index, end: m.index + m[0].length, alt: m[1], src: m[2] });
		}
		if (matches.length === 0) return content;

		let out = content;
		// Process from end to start to avoid index shifting
		for (let i = matches.length - 1; i >= 0; i--) {
			const img = matches[i];
			// Find nearest header before this image
			let nearest: string | undefined;
			for (let j = headers.length - 1; j >= 0; j--) {
				if (headers[j].index < img.start) {
					nearest = headers[j].text;
					break;
				}
			}
			if (!nearest || nearest === img.alt) continue;
			const escaped = nearest.replace(/\[/g, '\\[').replace(/\]/g, '\\]');
			const replacement = `![${escaped}](${img.src})`;
			out = out.slice(0, img.start) + replacement + out.slice(img.end);
		}
		return out;
	},
};
