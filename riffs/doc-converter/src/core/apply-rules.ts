import type { RuleContext } from '../lib/types.js';
import { RULES } from '../rules/index.js';

// Execution order: exact parity with Python implementation
const ORDER: string[] = [
	// Phase 1: Initial Cleanup
	'AR014', // remove-html-tags
	'AR015', // remove-html-comments
	'AR013', // format-links
	'AR016', // remove-stray-hashes
	// Phase 2: Basic Formatting
	'AR008', // unindent-tables
	'AR009', // insert-table-separators
	'AR006', // fix-list-marker-spacing
	'AR017', // remove-trailing-whitespace
	// Phase 3: Structural
	'AR001', // ensure-h1-header
	'AR002', // demote-subsequent-h1
	'AR010', // extract-missing-images
	'AR011', // ensure-images-after-h1
	'AR012', // update-image-alt-text
	// Phase 4: Final Polish
	'AR005', // fix-emphasis-as-heading
	'AR004', // remove-trailing-punctuation-from-headings
	'AR003', // ensure-blank-lines-around-headings
	'AR007', // indent-nested-lists
	'AR018', // normalize-blank-lines
];

export function applyAllRules(content: string, ctx: RuleContext, enabledRuleSet?: Set<string>): string {
	let out = content;
	for (const code of ORDER) {
		if (enabledRuleSet && !enabledRuleSet.has(code)) continue;
		const rule = RULES[code];
		if (!rule) continue;
		out = rule.function(out, rule.defaultOptions, ctx);
	}
	return out;
}
