import { extractSection } from '../utils/utils.js';

export function parseReqResp(md: string): { request?: string; response?: string } {
	const request = extractSection(md, 'Request');
	const response = extractSection(md, 'Response');
	return { request, response };
}

export function parseAdmonition(section: string): { type?: string; bullets: string[]; rest: string } {
	const lines = section.split('\n');
	let type: string | undefined;
	const bullets: string[] = [];

	// Regex that allows optional leading whitespace before >
	const admonitionHeaderRegex = /^\s*>\s*\[!([A-Za-z]+)\]/;
	const quotedLineRegex = /^\s*>/;
	const blankOrQuoteRegex = /^\s*(>\s*)?$/;

	// Find the admonition anywhere in the content
	let admonitionStart = -1;
	let admonitionEnd = -1;

	for (let j = 0; j < lines.length; j++) {
		const m = lines[j].match(admonitionHeaderRegex);
		if (m) {
			admonitionStart = j;
			type = m[1].toUpperCase();
			let k = j + 1;

			// Skip blank quote lines after header
			while (k < lines.length && blankOrQuoteRegex.test(lines[k]) && lines[k].match(quotedLineRegex)) k++;

			// Collect quoted content (bullets and non-bullets)
			while (k < lines.length && quotedLineRegex.test(lines[k])) {
				const b = lines[k].replace(/^\s*>\s*/, '');
				// Match bullet items
				const bm = b.match(/^[-*+]\s*(.*)$/);
				if (bm) {
					bullets.push(bm[1].trim());
				} else if (b.trim()) {
					// Non-bullet content in the admonition
					bullets.push(b.trim());
				}
				k++;
			}

			admonitionEnd = k;
			break; // Found the first admonition
		}
	}

	// Build rest: content before admonition + content after admonition
	if (admonitionStart !== -1) {
		const before = lines.slice(0, admonitionStart).join('\n').trim();
		const after = lines.slice(admonitionEnd).join('\n').trim();
		const rest = [before, after].filter(Boolean).join('\n\n');
		return { type, bullets, rest };
	}

	// No admonition found
	return { type: undefined, bullets: [], rest: section };
}
