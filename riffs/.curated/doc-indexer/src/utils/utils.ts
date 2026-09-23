import fs from 'node:fs/promises';

export async function readFileSafe(path: string): Promise<string | null> {
	try {
		const c = await fs.readFile(path, 'utf-8');
		return c;
	} catch {
		return null;
	}
}

export function extractSection(md: string, heading: string): string | undefined {
	const lines = md.split('\n');
	const headingRe = new RegExp(`^(#{2,})\\s+${heading}\\s*$`, 'i');
	const idx = lines.findIndex(l => headingRe.test(l.trim()));
	if (idx === -1) return undefined;
	const m = lines[idx].trim().match(headingRe);
	const level = m?.[1] ? m[1].length : 2; // number of # characters
	const buf: string[] = [];
	for (let i = idx + 1; i < lines.length; i++) {
		const line = lines[i];
		const hm = line.match(/^(#{2,})\s+/);
		if (hm) {
			const l = hm[1].length;
			// Stop when encountering a heading at same or higher rank (fewer #'s indicates higher rank)
			if (l <= level) break;
		}
		buf.push(line);
	}
	return buf.join('\n').trim();
}

export function stripMarkdown(md: string): string {
	return (
		md
			// code fences
			.replace(/```[\s\S]*?```/g, ' ')
			// inline code
			.replace(/`([^`]*)`/g, '$1')
			// images ![alt](url)
			.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
			// links [text](url) -> text
			.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
			// strip admonition markers like [!IMPORTANT], [!NOTE], [!TIP]
			.replace(/\[![^\]]+\]/g, '')
			// drop blockquote markers
			.replace(/^>\s*/gm, '')
			// remove leading heading markers
			.replace(/^\s*#{1,6}\s*/gm, '')
			// remove list bullets
			.replace(/^\s*[-*+]\s+/gm, '')
			// normalize whitespace
			.replace(/[\t\r\f]+/g, ' ')
			.replace(/\s{2,}/g, ' ')
			.replace(/\s*\n\s*/g, ' ')
			.trim()
	);
}

// Flatten markdown for terminal display: preserve paragraph breaks, collapse single newlines,
// and strip most formatting/artifacts while keeping list bullets readable.
export function flattenMarkdownForTerminal(md: string): string {
	let text = md.replace(/\r\n?/g, '\n');
	// Normalize Unicode spaces to regular spaces to avoid odd wrapping
	text = text.replace(/[\u00A0\u2007\u202F]/g, ' ');
	// Remove code blocks, images, and convert links to plain text
	text = text.replace(/```[\s\S]*?```/g, '');
	text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, '');
	text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
	// Strip admonitions and blockquotes
	text = text.replace(/\[![^\]]+\]/g, '');
	text = text.replace(/^>\s*/gm, '');
	// Headings -> plain
	text = text.replace(/^\s*#{1,6}\s*/gm, '');
	// Inline code
	text = text.replace(/`([^`]*)`/g, '$1');

	const lines = text.split('\n');
	const out: string[] = [];
	let para: string[] = [];

	const pushPara = () => {
		if (!para.length) return;
		const joined = para
			.join(' ')
			.replace(/\s{2,}/g, ' ')
			.trim();
		if (joined) out.push(joined);
		para = [];
	};

	for (const raw of lines) {
		let line = raw.trim();
		// Normalize Unicode spaces inline as well
		line = line.replace(/[\u00A0\u2007\u202F]/g, ' ');
		if (!line) {
			pushPara();
			continue;
		}

		// Bullet lists: keep as separate lines with a dot
		if (/^[-*+]\s+/.test(line)) {
			pushPara();
			line = line.replace(/^[-*+]\s+/, '• ');
			out.push(line);
			continue;
		}
		para.push(line);
	}
	pushPara();
	return out.join('\n\n').trim();
}
