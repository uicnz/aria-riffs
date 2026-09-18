import fs from 'node:fs';
import path from 'node:path';

export function moveAndRenameMediaFiles(
	htmlOutputPath: string,
	targetMediaDir: string,
	docxBasename: string,
	extractedOriginalBasenames: string[],
	imageCounter: Generator<number, never, unknown>
): Record<string, string> {
	const renameMap: Record<string, string> = {};
	const tempMediaSubdir = path.join(path.dirname(htmlOutputPath), 'media');
	if (!fs.existsSync(tempMediaSubdir)) return renameMap;

	for (const original of extractedOriginalBasenames) {
		const source = path.join(tempMediaSubdir, original);
		if (!fs.existsSync(source) || !fs.statSync(source).isFile()) continue;
		const ext = path.extname(source).toLowerCase();
		const isImage = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.svg', '.emf'].includes(ext);

		if (!isImage) {
			const target = path.join(targetMediaDir, original);
			if (!fs.existsSync(target)) fs.renameSync(source, target);
			renameMap[original] = original;
			continue;
		}

		// Generate unique new name
		let newName = '';
		while (true) {
			const n = imageCounter.next().value as number;
			const candidate = `${docxBasename}-${n}${ext}`;
			const target = path.join(targetMediaDir, candidate);
			if (!fs.existsSync(target)) {
				fs.renameSync(source, target);
				newName = candidate;
				break;
			}
		}
		renameMap[original] = newName;
	}

	// Try remove temp media dir (ignore failures)
	try {
		fs.rmdirSync(tempMediaSubdir);
	} catch {}
	return renameMap;
}

export function updateHtmlImageReferences(htmlOutput: string, renameMap: Record<string, string>): void {
	if (!Object.keys(renameMap).length) return;
	let html = fs.readFileSync(htmlOutput, 'utf8');

	// Replace absolute and relative paths with just the renamed filename
	for (const [orig, renamed] of Object.entries(renameMap)) {
		// Match src="any-path/media/original-filename" or src="any-path/original-filename"
		// and replace with just src="renamed-filename" (relative path in same directory)
		const origRe = new RegExp(`src=["']([^"']*/)?(media/)?${escapeRegExp(orig)}["']`, 'g');
		html = html.replace(origRe, `src="${renamed}"`);
	}

	fs.writeFileSync(htmlOutput, html, 'utf8');
}

function escapeRegExp(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
