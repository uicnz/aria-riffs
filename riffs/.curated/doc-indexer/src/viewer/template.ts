export interface HtmlTemplateOptions {
	title: string;
	riffs: string[];
	styles: string[];
	body: string;
}

export function createHtmlTemplate(options: HtmlTemplateOptions): string {
	const { title, riffs, styles, body } = options;

	return `<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    ${riffs.map(s => `    ${s}`).join('\n')}
    ${styles.map(s => `    ${s}`).join('\n')}
</head>
<body>
${body}
</body>
</html>`;
}

export function escapeHtml(str: unknown): string {
	return String(str)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}
