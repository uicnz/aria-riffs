import path from 'node:path';
import { glob } from 'glob';
import type { RfpParserConfig } from '../lib/types.js';
import { readFileSafe } from '../utils/utils.js';

export interface RfpContext {
	files: string[];
	anchors: Map<string, { start: number; end: number; file: string; anchor?: string }>;
	client?: string;
	vendor?: string;
	rfpName?: string;
	proposal_date?: string;
}

export async function buildFullRfpContext(
	baseDir: string,
	fullRfpPath?: string,
	config?: RfpParserConfig
): Promise<RfpContext | null> {
	const files: string[] = [];

	if (fullRfpPath) {
		// Use configured RFP path
		const resolvedPath = path.resolve(process.cwd(), fullRfpPath);
		try {
			// Check if it's a single file or directory
			const stats = await import('node:fs').then(fs => fs.promises.stat(resolvedPath).catch(() => null));
			if (stats?.isFile()) {
				files.push(resolvedPath);
			} else if (stats?.isDirectory()) {
				const list = await glob(path.join(resolvedPath, '**/*.md'), {
					ignore: ['**/assets/**', '**/node_modules/**'],
				});
				files.push(...list);
			}
		} catch {
			/* ignore */
		}
	} else {
		// Fallback to discovering full-rfp roots
		const roots = [
			path.join(baseDir, 'full-rfp'),
			path.resolve(baseDir, '..', 'full-rfp'),
			path.resolve(baseDir, '..', '..', 'full-rfp'),
		];
		for (const r of roots) {
			try {
				const list = await glob(path.join(r, '**/*.md'), { ignore: ['**/assets/**', '**/node_modules/**'] });
				files.push(...list);
			} catch {
				/* ignore */
			}
		}
	}

	if (files.length === 0) return null;

	const anchors = new Map<string, { start: number; end: number; file: string; anchor?: string }>();

	// Only process requirement patterns if config is provided
	if (config?.requirements?.patterns && config.requirements.patterns.length > 0) {
		const slugify = (h: string) =>
			h
				.toLowerCase()
				.trim()
				.replace(/[`*_]/g, '')
				.replace(/[^\w\s-]/g, '')
				.replace(/\s+/g, '-');

		// Build combined regex from all configured patterns
		const combinedPattern = config.requirements.patterns.join('|');
		const headingRegex = new RegExp(`^(#+)\\s+.*(${combinedPattern}).*$`, 'i');
		const inlineRegex = new RegExp(`\\b(${combinedPattern})\\b`, 'i');

		for (const file of files) {
			const content = await readFileSafe(file);
			if (!content) continue;
			const lines = content.split('\n');
			const hits: Array<{ id: string; start: number; end: number; anchor?: string }> = [];

			// Pass 1: headings with identifiers
			for (let i = 0; i < lines.length; i++) {
				const line = lines[i];
				const m = headingRegex.exec(line);
				if (m) {
					const id = m[2].toUpperCase();
					const anchor = slugify(line.replace(/^#+\s*/, ''));
					hits.push({ id, start: i, end: i, anchor });
				}
			}

			// Pass 2: IMPORTANT/TIP blocks listing IDs
			for (let i = 0; i < lines.length; i++) {
				if (!/^>\s*\[!/.test(lines[i])) continue;
				for (let j = i; j < Math.min(i + 12, lines.length); j++) {
					const mm = inlineRegex.exec(lines[j]);
					if (mm) {
						const id = mm[1].toUpperCase();
						hits.push({ id, start: i, end: i });
						break;
					}
				}
			}

			// Pass 3: generic fallback — any line with an identifier token
			for (let i = 0; i < lines.length; i++) {
				const mm = inlineRegex.exec(lines[i]);
				if (mm) {
					const id = mm[1].toUpperCase();
					hits.push({ id, start: i, end: i });
				}
			}

			// Close ranges by next hit or EOF and record first occurrence per id
			hits.sort((a, b) => a.start - b.start);
			for (let i = 0; i < hits.length; i++) {
				hits[i].end = (i + 1 < hits.length ? hits[i + 1].start : lines.length) - 1;
			}
			for (const h of hits) {
				if (!anchors.has(h.id)) anchors.set(h.id, { start: h.start, end: h.end, file, anchor: h.anchor });
			}
		}
	}

	// Metadata extraction from first file
	const first = files[0];
	const firstContent = await readFileSafe(first);

	let vendor: string | undefined;
	let client: string | undefined;
	let rfpName: string | undefined;
	let proposal_date: string | undefined;

	if (!config) {
		// No config provided, return context with files and anchors only
		return { files, anchors };
	}

	// Use static metadata if provided (highest priority)
	if (config.metadata) {
		vendor = config.metadata.vendor;
		client = config.metadata.client;
		rfpName = config.metadata.rfpName;
	}

	// Extract metadata from document if extraction config provided and static metadata not set
	if (firstContent && config.extraction) {
		if (!vendor && config.extraction.vendor) {
			const match = firstContent.match(new RegExp(config.extraction.vendor.pattern, 'i'));
			vendor = match ? match[1] : config.extraction.vendor.fallback || undefined;
		}

		if (!client && config.extraction.client) {
			const match = firstContent.match(new RegExp(config.extraction.client.pattern, 'i'));
			client = match ? match[1] : config.extraction.client.fallback || undefined;
		}

		if (!rfpName && config.extraction.rfpName) {
			const match = firstContent.match(new RegExp(config.extraction.rfpName.pattern, 'i'));
			rfpName = match ? match[1] : config.extraction.rfpName.fallback || undefined;
		}

		if (config.extraction.proposalDate) {
			const match = firstContent.match(new RegExp(config.extraction.proposalDate.pattern, 'i'));
			if (match) {
				const dateStr = match[1];
				const format = config.extraction.proposalDate.dateFormat || 'YYYY-MM-DD';

				// Parse date based on format
				if (format === 'DD-MM-YY') {
					// Convert DD-MM-YY to YYYY-MM-DD
					const parsed = dateStr.replace(/(\d{2})-(\d{2})-(\d{2})/, '20$3-$2-$1');
					proposal_date = new Date(parsed).toISOString();
				} else {
					// Assume ISO-compatible format
					proposal_date = new Date(dateStr).toISOString();
				}
			}
		}
	}

	return { files, anchors, client, vendor, rfpName, proposal_date } as const;
}
