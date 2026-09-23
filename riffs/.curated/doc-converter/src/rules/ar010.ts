import fs from 'node:fs';
import * as cheerio from 'cheerio';
import type { AriaRule } from '../lib/types.js';

export const AR010: AriaRule = {
	names: ['AR010', 'extract-missing-images'],
	description: 'Insert missing Markdown image references found in HTML at their original positions',
	tags: ['images', 'structure', 'converter'],
	category: 'images',
	function: (content: string, _options, ctx) => {
		const htmlPath = ctx?.htmlFilePath;
		if (!htmlPath || !fs.existsSync(htmlPath)) return content;
		const html = fs.readFileSync(htmlPath, 'utf8');
		const $ = cheerio.load(html);

		// Find existing images in markdown
		const existing = new Set<string>();
		for (const m of content.matchAll(/!\[[^\]]*\]\((.*?)\)/g)) {
			existing.add(m[1]);
		}

		// Build list of missing images with context
		interface MissingImage {
			src: string;
			alt: string;
			beforeText: string;
			afterText: string;
		}
		const missing: MissingImage[] = [];

		$('img').each((_, img) => {
			const src = $(img).attr('src');
			const alt = $(img).attr('alt') ?? '';
			if (!src || existing.has(src)) return;

			// Get text before and after the image for context matching
			const parent = $(img).parent();
			const beforeText = parent.prevAll().first().text().trim().slice(-100);
			const afterText = parent.nextAll().first().text().trim().slice(0, 100);

			missing.push({ src, alt, beforeText, afterText });
		});

		if (missing.length === 0) return content;

		// Insert each missing image at the best matching position
		const result = content;
		const lines = result.split('\n');

		for (const img of missing) {
			const imageMarkdown = `![${img.alt}](${img.src})`;
			let bestIndex = -1;
			let bestScore = 0;

			// Find best insertion point by matching surrounding text
			for (let i = 0; i < lines.length; i++) {
				const line = lines[i];
				const score = calculateMatchScore(line, img.beforeText, img.afterText);
				if (score > bestScore) {
					bestScore = score;
					bestIndex = i;
				}
			}

			// Insert after the best matching line
			if (bestIndex >= 0) {
				lines.splice(bestIndex + 1, 0, '', imageMarkdown, '');
			} else {
				// Fallback: insert after first heading
				const h1Index = lines.findIndex(l => l.startsWith('# '));
				if (h1Index >= 0) {
					lines.splice(h1Index + 1, 0, '', imageMarkdown, '');
				} else {
					lines.unshift(imageMarkdown, '');
				}
			}
		}

		return lines.join('\n');
	},
};

function calculateMatchScore(line: string, beforeText: string, afterText: string): number {
	let score = 0;
	const lineLower = line.toLowerCase();
	const beforeLower = beforeText.toLowerCase();
	const afterLower = afterText.toLowerCase();

	// Check for word matches
	const beforeWords = beforeLower.split(/\s+/).filter(w => w.length > 3);
	const afterWords = afterLower.split(/\s+/).filter(w => w.length > 3);

	for (const word of beforeWords) {
		if (lineLower.includes(word)) score += 2;
	}
	for (const word of afterWords) {
		if (lineLower.includes(word)) score += 1;
	}

	return score;
}
