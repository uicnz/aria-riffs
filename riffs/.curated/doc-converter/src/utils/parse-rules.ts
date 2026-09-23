import fs from 'node:fs';
import path from 'node:path';
import type { Logger } from 'pino';

export interface MDRule {
	code: string;
	description: string;
	aliases: string[];
	tags: string[];
}

/**
 * Parse markdownlint rules from existing local documentation files
 * Located in: riffs/.curated/doc-converter/docs/reference/markdownlint-rules/
 */
export function parseMarkdownlintRules(logger?: Logger): Record<string, MDRule> {
	const rules: Record<string, MDRule> = {};
	const docsDir = path.join(process.cwd(), 'riffs/.curated/doc-converter/docs/reference/markdownlint-rules');

	if (!fs.existsSync(docsDir)) {
		logger?.warn({ docsDir }, 'MD rules documentation directory not found');
		return rules;
	}

	const files = fs
		.readdirSync(docsDir)
		.filter(f => f.startsWith('md') && f.endsWith('.md') && f.match(/^md\d+\.md$/i));

	for (const file of files) {
		const filePath = path.join(docsDir, file);
		const content = fs.readFileSync(filePath, 'utf8');

		// Parse title: # `MD001` - Description
		const titleMatch = content.match(/^#\s+`(MD\d+)`\s+-\s+(.+)$/m);

		// Parse tags: Tags: `tagname` or Tags: `tag1`, `tag2`
		const tagsMatch = content.match(/^Tags:\s+(.+)$/m);

		// Parse aliases: Aliases: `alias-name` (optional)
		const aliasMatch = content.match(/^Aliases:\s+`([^`]+)`/m);

		if (titleMatch) {
			const code = titleMatch[1];
			const description = titleMatch[2].trim();
			const tags = tagsMatch ? tagsMatch[1].match(/`([^`]+)`/g)?.map(t => t.replace(/`/g, '')) || [] : [];
			const aliases = aliasMatch ? [aliasMatch[1]] : [];

			rules[code] = {
				code,
				description,
				aliases,
				tags,
			};
		}
	}

	return rules;
}
