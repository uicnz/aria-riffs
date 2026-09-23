import type { AriaRule } from '../lib/types.js';

function unescapeMarkdownLinks(s: string): string {
	return s.replace(/\\\[(.*?)\\\]\((.*?)\)/g, '[$1]($2)');
}

function autoLinkUrls(s: string): string {
	const urlRe = /(https?:\/\/[^\s<>"'`)]+)/g;
	return s.replace(urlRe, (match, _p1, offset) => {
		// Skip if preceded by '[' or '(' or '=' or quote (already linked or attr)
		const prev = offset > 0 ? s[offset - 1] : '';
		if (prev === '[' || prev === '(' || prev === '=' || prev === '"' || prev === "'") return match;
		// Skip if followed by ')' to avoid [text](url) replacement
		const next = s[offset + match.length] ?? '';
		if (next === ')') return match;
		return `[${match}](${match})`;
	});
}

export const AR013: AriaRule = {
	names: ['AR013', 'format-links'],
	description: 'Unescape Markdown links and auto-link bare URLs',
	tags: ['links', 'formatting', 'converter'],
	category: 'links',
	function: (content: string) => {
		let out = unescapeMarkdownLinks(content);
		out = autoLinkUrls(out);
		return out;
	},
};
