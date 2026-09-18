import * as cheerio from 'cheerio';

function preprocessLinksInLists(html: string): string {
	const $ = cheerio.load(html);
	$('li a[href]').each((_, a) => {
		const $a = $(a);
		const text = $a.text().trim();
		const href = $a.attr('href');
		if (!href) return;
		const replacement = `[${text}](${href})`;
		$a.replaceWith(replacement);
	});
	return $.html();
}

export function processHtml(html: string): string {
	const $ = cheerio.load(html);

	// Remove style and script tags - they're meaningless for markdown conversion
	$('style').remove();
	$('script').remove();

	// Remove empty tables and tables without rows to prevent GFM plugin crashes
	// Word documents can produce malformed tables that violate TurnDown's assumptions
	$('table').each((_, table) => {
		const $table = $(table);
		const rows = $table.find('tr');
		if (rows.length === 0) {
			$table.remove();
		}
	});

	// Preprocess links in lists
	const cleanedHtml = $.html();
	return preprocessLinksInLists(cleanedHtml);
}
