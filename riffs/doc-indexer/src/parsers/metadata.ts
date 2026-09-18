export function parseMetadataBlock(md: string): Record<string, string> {
	const tip = md.match(/> \[!TIP\][\s\S]*?Metadata:[\s\S]*?(?=\n##|$)/);
	if (!tip) return {} as Record<string, string>;
	const block = tip[0];
	const find = (label: string) => {
		const m = block.match(new RegExp(`${label}:\\s*([^\n]+)`));
		return m ? m[1].trim() : undefined;
	};
	return {
		identifier: (find('- Identifier') || find('Identifier'))?.replace(/`/g, ''),
		description: (find('- Description') || find('Description'))?.replace(/`/g, ''),
		priority: (find('- Priority') || find('Priority'))?.replace(/`/g, ''),
		category: (find('- Category') || find('Category'))?.replace(/`/g, ''),
		department: (find('- Department') || find('Department'))?.replace(/`/g, ''),
		leader: (find('- Leader') || find('Leader'))?.replace(/`/g, ''),
		customise: (find('- Customise') || find('Customise'))?.replace(/`/g, ''),
	} as Record<string, string>;
}

export function parseTitle(md: string): string | undefined {
	const m = md.match(/^#\s+(.+)$/m);
	return m ? m[1].trim() : undefined;
}

export function detectDocType(id?: string, patterns?: string[]): string | undefined {
	if (!id || !patterns || patterns.length === 0) return undefined;

	for (const pattern of patterns) {
		const match = id.match(new RegExp(pattern));
		if (match?.[1]) {
			// Extract type prefix from the first capture group, removing digits
			return match[1].replace(/\d+/, '');
		}
	}
	return undefined;
}

export function extractAssets(md: string): string[] {
	const imgs = [...md.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map(m => m[1]);
	return imgs;
}
