import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { Logger } from 'pino';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

export function convertDocxToHtml(inputPath: string, htmlOutput: string): [boolean, string[]] {
	const extractBase = path.dirname(htmlOutput);
	const args = [
		inputPath,
		'-f',
		'docx',
		'-t',
		'html5',
		'-o',
		htmlOutput,
		'--extract-media',
		extractBase,
		'--standalone',
		'--wrap=none',
	];
	const r = spawnSync('pandoc', args, { encoding: 'utf8' });
	if (r.status !== 0) return [false, []];
	const mediaDir = path.join(extractBase, 'media');
	if (!fs.existsSync(mediaDir) || !fs.statSync(mediaDir).isDirectory()) return [true, []];
	const names = fs.readdirSync(mediaDir).filter(f => fs.statSync(path.join(mediaDir, f)).isFile());
	return [true, names];
}

export function convertHtmlToMarkdown(
	processedHtmlPath: string,
	mdOutput: string,
	_resourcePathDir: string,
	logger?: Logger
): boolean {
	try {
		const htmlFull = fs.readFileSync(processedHtmlPath, 'utf8');

		// Extract only body content - ignore head/style/script
		const bodyMatch = htmlFull.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
		const html = bodyMatch ? bodyMatch[1] : htmlFull;

		const turndownService = new TurndownService({
			headingStyle: 'atx',
			codeBlockStyle: 'fenced',
			bulletListMarker: '-',
			emDelimiter: '*',
		});

		// Use GFM plugin for table support
		turndownService.use(gfm);

		let markdown = turndownService.turndown(html);

		// Post-process TurnDown artifacts
		markdown = markdown.replace(/\*\*\\#/g, '**#'); // Fix escaped hashes in bold
		markdown = markdown.replace(/\*\*:\s*\n/g, '**\n'); // Remove trailing colons after bold (before newline)
		markdown = markdown.replace(/\*\*:\s*$/gm, '**'); // Remove trailing colons after bold (at end of line)

		fs.writeFileSync(mdOutput, markdown, 'utf8');
		return true;
	} catch (err) {
		logger?.error({ error: err, processedHtmlPath, mdOutput }, 'TurnDown conversion failed');
		return false;
	}
}
