/**
 * Query expansion for improved search recall.
 * Expands search queries with synonyms and related terms.
 */

/**
 * HR-specific synonym map.
 * Maps terms to their synonyms/related terms.
 * Bidirectional: both directions are expanded.
 */
const SYNONYM_GROUPS: string[][] = [
	// Medical/Emergency equipment
	['aed', 'defibrillator', 'automated external defibrillator'],
	['first aid', 'firstaid', 'medical kit', 'first-aid'],

	// Leave types
	['paternal', 'paternity', 'parental', 'father'],
	['maternal', 'maternity', 'parental', 'mother'],
	['annual leave', 'vacation', 'holiday', 'pto', 'paid time off'],
	['sick leave', 'sick day', 'medical leave', 'illness'],
	['bereavement', 'compassionate leave', 'funeral leave'],

	// Employment terms
	['salary', 'pay', 'wages', 'compensation', 'remuneration'],
	['bonus', 'incentive', 'commission'],
	['expense', 'reimbursement', 'claim'],
	['terminate', 'termination', 'resign', 'resignation', 'dismiss', 'dismissal', 'fire', 'quit'],
	['hire', 'hiring', 'recruit', 'recruitment', 'onboard', 'onboarding'],

	// Benefits
	['health insurance', 'medical insurance', 'healthcare', 'health cover'],
	['retirement', 'pension', 'superannuation', 'kiwisaver'],

	// Safety
	['fire', 'fire alarm', 'fire drill', 'fire extinguisher', 'fire safety'],
	['earthquake', 'emergency', 'evacuation', 'disaster'],
	['hazard', 'risk', 'danger', 'safety concern'],

	// Locations
	['office', 'workplace', 'work site', 'premises'],

	// Time/Scheduling
	['hours', 'working hours', 'work hours', 'schedule'],
	['overtime', 'extra hours', 'additional hours'],
	['flexible', 'flexitime', 'flex time', 'remote', 'wfh', 'work from home'],

	// Conduct
	['harassment', 'bullying', 'discrimination'],
	['grievance', 'complaint', 'dispute'],
	['misconduct', 'disciplinary', 'discipline'],

	// Documents/Processes
	['policy', 'procedure', 'guideline', 'rule'],
	['form', 'application', 'request'],
	['approval', 'approve', 'authorization', 'authorise', 'authorize'],
];

/**
 * Build a lookup map from the synonym groups.
 * Each term maps to all its synonyms (including itself).
 */
function buildSynonymMap(): Map<string, Set<string>> {
	const map = new Map<string, Set<string>>();

	for (const group of SYNONYM_GROUPS) {
		const allTerms = new Set(group.map(t => t.toLowerCase()));

		for (const term of allTerms) {
			const existing = map.get(term);
			if (existing) {
				// Merge with existing synonyms
				for (const t of allTerms) {
					existing.add(t);
				}
			} else {
				map.set(term, new Set(allTerms));
			}
		}
	}

	return map;
}

const SYNONYM_MAP = buildSynonymMap();

/**
 * Expand a single term with its synonyms.
 *
 * @param term - The term to expand
 * @returns Array of the term plus its synonyms
 */
export function expandTerm(term: string): string[] {
	const normalized = term.toLowerCase();
	const synonyms = SYNONYM_MAP.get(normalized);

	if (synonyms) {
		return Array.from(synonyms);
	}

	return [normalized];
}

/**
 * Expand a query with synonyms for each term.
 * Returns the original query plus expanded variants.
 *
 * @param query - The cleaned query (stop words removed)
 * @returns Array of query variants
 */
export function expandQuery(query: string): string[] {
	const terms = query
		.toLowerCase()
		.split(/\s+/)
		.filter(t => t.length > 0);
	if (terms.length === 0) return [query];

	const variants: Set<string> = new Set();
	variants.add(query); // Always include original

	// For each term, generate variants with synonyms
	for (let i = 0; i < terms.length; i++) {
		const term = terms[i];
		if (!term) continue;

		const synonyms = expandTerm(term);

		for (const syn of synonyms) {
			if (syn !== term) {
				// Create variant with this synonym
				const variantTerms = [...terms];
				variantTerms[i] = syn;
				variants.add(variantTerms.join(' '));
			}
		}
	}

	// Also check for multi-word synonyms
	const queryLower = query.toLowerCase();
	for (const group of SYNONYM_GROUPS) {
		for (const phrase of group) {
			if (queryLower.includes(phrase)) {
				// Find other phrases in the group and create variants
				for (const otherPhrase of group) {
					if (otherPhrase !== phrase) {
						variants.add(queryLower.replace(phrase, otherPhrase));
					}
				}
			}
		}
	}

	return Array.from(variants);
}

/**
 * Expand a query and build FTS5 OR query with all variants.
 * Used for comprehensive lexical search.
 *
 * @param cleanedQuery - The cleaned query
 * @returns FTS5 query string with OR-joined terms from all variants
 */
export function expandQueryForFts(cleanedQuery: string): string {
	const variants = expandQuery(cleanedQuery);

	// Collect all unique terms from all variants
	const allTerms: Set<string> = new Set();
	for (const variant of variants) {
		const terms = variant.split(/\s+/).filter(t => t.length > 0);
		for (const term of terms) {
			allTerms.add(term);
		}
	}

	if (allTerms.size === 0) return '';
	if (allTerms.size === 1) return `${Array.from(allTerms)[0]}*`;

	// Build OR query with prefix matching
	return Array.from(allTerms)
		.map(t => `${t}*`)
		.join(' OR ');
}
