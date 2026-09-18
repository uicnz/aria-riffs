/**
 * Query expansion for employee directory searches.
 * Provides synonym groups for job titles, departments, and locations
 * to improve search recall.
 */

/**
 * Verb-to-role mapping for natural language queries.
 * Maps management verbs to their corresponding role nouns.
 */
const VERB_TO_ROLE: Record<string, string[]> = {
	manages: ['manager'],
	managing: ['manager'],
	manage: ['manager'],
	leads: ['leader', 'lead'],
	leading: ['leader', 'lead'],
	heads: ['head'],
	heading: ['head'],
	directs: ['director'],
	directing: ['director'],
	supervises: ['supervisor'],
	supervising: ['supervisor'],
};

/**
 * Get preferred role terms for a verb.
 */
export function getPreferredRoleForVerb(term: string): string[] {
	return VERB_TO_ROLE[term.toLowerCase()] ?? [];
}

/**
 * Question words that indicate a natural language query.
 */
const QUESTION_WORDS = new Set(['who', 'what', 'which', 'where', 'find', 'show', 'list', 'get']);

/**
 * Check if query contains a management verb in a question context.
 * Only returns verb when used as actual verb, not when used as noun in job title.
 */
export function extractManagementVerb(query: string): string | null {
	const terms = query.toLowerCase().split(/\s+/);
	const hasQuestionContext = terms.length > 0 && QUESTION_WORDS.has(terms[0] ?? '');
	if (!hasQuestionContext) {
		return null;
	}
	for (const term of terms) {
		if (VERB_TO_ROLE[term]) {
			return term;
		}
	}
	return null;
}

/**
 * C-level and executive title abbreviations.
 * Universal business abbreviations.
 */
const TITLE_ABBREVIATIONS: Record<string, string[]> = {
	cto: ['chief', 'technology', 'officer'],
	cfo: ['chief', 'financial', 'officer'],
	ceo: ['chief', 'executive', 'officer'],
	cio: ['chief', 'information', 'officer'],
	coo: ['chief', 'operations', 'officer'],
	ciso: ['chief', 'information', 'security', 'officer'],
	cmo: ['chief', 'marketing', 'officer'],
	cpo: ['chief', 'product', 'officer'],
	cro: ['chief', 'revenue', 'officer'],
	vp: ['vice', 'president'],
	svp: ['senior', 'vice', 'president'],
	evp: ['executive', 'vice', 'president'],
	md: ['managing', 'director'],
	gm: ['general', 'manager'],
};

/**
 * Expand title abbreviations.
 */
export function expandTitleAbbreviation(term: string): string[] {
	return TITLE_ABBREVIATIONS[term.toLowerCase()] ?? [];
}

/**
 * Synonym groups for employee/HR searches.
 * Each group contains terms that should match together.
 */
const SYNONYM_GROUPS: string[][] = [
	// Job title variations
	['engineer', 'developer', 'dev', 'programmer', 'coder'],
	['manager', 'lead', 'head', 'director', 'supervisor', 'leader'],
	['senior', 'sr', 'snr', 'principal'],
	['junior', 'jr', 'jnr', 'associate', 'graduate'],
	['analyst', 'specialist', 'consultant'],
	['coordinator', 'administrator', 'admin'],
	['architect', 'designer'],
	['executive', 'exec', 'chief', 'vp', 'president', 'officer'],
	['assistant', 'asst'],

	// Department variations
	['engineering', 'development', 'tech', 'technology', 'it'],
	['hr', 'human', 'resources', 'people', 'talent'],
	['finance', 'financial', 'accounting', 'accounts'],
	['sales', 'commercial', 'revenue', 'business'],
	['marketing', 'brand', 'communications', 'comms'],
	['operations', 'ops', 'infrastructure', 'infra'],
	['support', 'helpdesk', 'service', 'desk'],
	['network', 'noc', 'networking'],
	['product', 'pm', 'management'],
	['project', 'delivery', 'pmo'],
	['security', 'infosec', 'cybersecurity', 'cyber'],
	['procurement', 'purchasing', 'supply'],

	// Location variations - NZ cities
	['auckland', 'akl'],
	['wellington', 'wgtn', 'welly'],
	['christchurch', 'chch'],
	['dunedin', 'dun'],
	['hamilton', 'ham'],
	['tauranga', 'tau'],

	// Common abbreviations
	['new', 'zealand', 'nz'],
	['australia', 'aus', 'oz'],
	['united', 'states', 'us', 'usa', 'america'],
	['united', 'kingdom', 'uk', 'britain'],

	// Organization terms
	['team', 'group', 'department', 'dept', 'division'],
	['company', 'organization', 'org', 'organisation'],
	['office', 'site', 'location', 'branch'],
];

/**
 * Index for fast synonym lookup.
 * Maps each term to the index of its synonym group.
 */
const synonymIndex = new Map<string, number>();

// Build the index
for (let i = 0; i < SYNONYM_GROUPS.length; i++) {
	const group = SYNONYM_GROUPS[i];
	if (group) {
		for (const term of group) {
			synonymIndex.set(term.toLowerCase(), i);
		}
	}
}

/**
 * Get synonyms for a single term.
 * Returns an array including the original term plus any synonyms.
 */
export function getSynonyms(term: string): string[] {
	const normalized = term.toLowerCase();
	const groupIndex = synonymIndex.get(normalized);

	if (groupIndex === undefined) {
		return [term];
	}

	const group = SYNONYM_GROUPS[groupIndex];
	if (!group) {
		return [term];
	}

	// Return all terms from the group (includes original)
	return [...group];
}

/**
 * Expand a query by adding synonyms and title abbreviation expansions.
 * Returns an array of all terms deduplicated.
 */
export function expandQuery(query: string): string[] {
	const terms = query
		.toLowerCase()
		.split(/\s+/)
		.filter(t => t.length > 0);

	const expanded = new Set<string>();

	for (const term of terms) {
		expanded.add(term);

		const synonyms = getSynonyms(term);
		for (const syn of synonyms) {
			expanded.add(syn);
		}

		const titleExpansion = expandTitleAbbreviation(term);
		for (const exp of titleExpansion) {
			expanded.add(exp);
		}
	}

	return Array.from(expanded);
}

/**
 * Check if a query contains terms that can be expanded.
 * Useful for deciding whether to run an expanded search pass.
 */
export function hasExpandableTerms(query: string): boolean {
	const terms = query
		.toLowerCase()
		.split(/\s+/)
		.filter(t => t.length > 0);

	for (const term of terms) {
		if (synonymIndex.has(term)) {
			return true;
		}
		if (TITLE_ABBREVIATIONS[term]) {
			return true;
		}
	}

	return false;
}

/**
 * Get original query terms without stop words.
 * Used for the base FTS pass.
 */
export function getQueryTerms(query: string): string[] {
	return query
		.toLowerCase()
		.split(/\s+/)
		.filter(t => t.length > 2);
}
