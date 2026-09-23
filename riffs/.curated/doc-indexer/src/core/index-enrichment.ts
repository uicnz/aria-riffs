/**
 * Index-time enrichment for improved search quality.
 *
 * Implements strategies from hr-staffer:
 * - Contextual embedding prefixes (category/department/title hierarchy)
 * - Abbreviation injection for FTS (expands terms at index time)
 * - Keyword enrichment based on document type
 *
 * All enrichment terms are loaded from config - no hardcoded values.
 */

import type { RfpDocMetadata, SearchConfig } from '../lib/types.js';

/**
 * Search config with abbreviations for enrichment.
 * Set via initIndexEnrichment() before using other functions.
 */
let searchConfig: SearchConfig = {
	abbreviations: {},
	synonyms: [],
	stopWords: [],
	identifierExpansions: {},
	domainProducts: [],
	domainConcepts: [],
};

/**
 * Initialize index enrichment with config.
 * Must be called before using enrichment functions.
 */
export function initIndexEnrichment(config: SearchConfig): void {
	searchConfig = config;
}

/**
 * Build contextual embedding text with hierarchy prefix.
 *
 * Structure:
 * ```
 * [Category: hybrid] [Department: commercial-service-management]
 * # Service Levels (MR16)
 *
 * Request:
 * [request text]
 *
 * Response:
 * [response text]
 * ```
 *
 * This helps the embedding model understand document context,
 * similar to hr-staffer's hierarchical section approach.
 */
export function buildContextualEmbedText(metadata: RfpDocMetadata): string {
	const parts: string[] = [];

	// 1. Hierarchy context prefix
	const contextParts: string[] = [];
	if (metadata.category) {
		contextParts.push(`Category: ${metadata.category}`);
	}
	if (metadata.department) {
		// Convert kebab-case to readable format
		const deptReadable = metadata.department.replace(/-/g, ' ');
		contextParts.push(`Department: ${deptReadable}`);
	}
	if (metadata.type) {
		contextParts.push(`Type: ${metadata.type}`);
	}
	if (contextParts.length > 0) {
		parts.push(`[${contextParts.join('] [')}]`);
	}

	// 2. Title with identifier
	if (metadata.title && metadata.identifier) {
		parts.push(`# ${metadata.title} (${metadata.identifier})`);
	} else if (metadata.title) {
		parts.push(`# ${metadata.title}`);
	} else if (metadata.identifier) {
		parts.push(`# ${metadata.identifier}`);
	}

	// 3. Description if present
	if (metadata.description) {
		parts.push(`Description: ${metadata.description}`);
	}

	// 4. Request and Response sections
	if (metadata.request_text) {
		parts.push(`Request:\n${metadata.request_text}`);
	}
	if (metadata.response_text) {
		parts.push(`Response:\n${metadata.response_text}`);
	}

	return parts.join('\n\n');
}

/**
 * Build enriched FTS text with abbreviation expansions.
 *
 * Adds expanded forms of abbreviations found in the document,
 * so searching for "SLA" will match documents about "service levels".
 *
 * Also adds reverse mappings - if document mentions "service level",
 * inject "SLA" so abbreviation searches work.
 */
export function buildEnrichedFtsText(metadata: RfpDocMetadata, embedText: string): string {
	const parts: string[] = [];

	// 1. Add searchable metadata fields as keywords
	const keywords: string[] = [];

	if (metadata.identifier) {
		keywords.push(metadata.identifier);
		// Add expanded identifier type
		const idPrefix = metadata.identifier.match(/^([A-Z]+)/)?.[1];
		if (idPrefix) {
			keywords.push(...getIdentifierExpansion(idPrefix));
		}
	}

	if (metadata.title) {
		keywords.push(metadata.title);
	}

	if (metadata.description) {
		keywords.push(metadata.description);
	}

	if (metadata.category) {
		keywords.push(metadata.category);
	}

	if (metadata.department) {
		keywords.push(metadata.department);
		// Add readable version
		keywords.push(metadata.department.replace(/-/g, ' '));
	}

	// 2. Find and expand abbreviations in the content
	const abbreviationExpansions = findAndExpandAbbreviations(embedText);
	keywords.push(...abbreviationExpansions);

	// 3. Find and inject abbreviations for expanded terms
	const reverseAbbreviations = findReverseAbbreviations(embedText);
	keywords.push(...reverseAbbreviations);

	// 4. Combine: keywords first, then full content
	if (keywords.length > 0) {
		// Deduplicate keywords
		const uniqueKeywords = [...new Set(keywords.map(k => k.toLowerCase()))];
		parts.push(uniqueKeywords.join(' '));
	}

	parts.push(embedText);

	return parts.join('\n\n');
}

/**
 * Get expanded terms for identifier prefixes.
 * E.g., "MR" -> ["management", "requirement"]
 * Uses identifierExpansions from config.
 */
function getIdentifierExpansion(prefix: string): string[] {
	if (!searchConfig.identifierExpansions) {
		return [];
	}
	return searchConfig.identifierExpansions[prefix.toUpperCase()] ?? [];
}

/**
 * Find abbreviations in text and return their expansions.
 * Uses config abbreviations mapping.
 */
function findAndExpandAbbreviations(text: string): string[] {
	const expansions: string[] = [];
	const textLower = text.toLowerCase();

	for (const [abbrev, expanded] of Object.entries(searchConfig.abbreviations)) {
		// Check if abbreviation appears as a whole word
		const regex = new RegExp(`\\b${abbrev}\\b`, 'i');
		if (regex.test(textLower)) {
			expansions.push(...expanded);
		}
	}

	return expansions;
}

/**
 * Find expanded terms in text and return their abbreviations.
 * Reverse lookup to inject abbreviations when expanded form is present.
 */
function findReverseAbbreviations(text: string): string[] {
	const abbreviations: string[] = [];
	const textLower = text.toLowerCase();

	for (const [abbrev, expanded] of Object.entries(searchConfig.abbreviations)) {
		// Check if all expanded terms appear in text
		const allTermsPresent = expanded.every(term => textLower.includes(term.toLowerCase()));
		if (allTermsPresent && expanded.length >= 2) {
			abbreviations.push(abbrev);
		}
	}

	return abbreviations;
}

/**
 * Extract domain-specific keywords from content.
 * Identifies technical terms, product names, and concepts.
 * Uses domainProducts and domainConcepts from config.
 */
export function extractDomainKeywords(text: string): string[] {
	const keywords: string[] = [];
	const textLower = text.toLowerCase();

	// Technical product/platform names (case-insensitive detection)
	const products = searchConfig.domainProducts ?? [];
	for (const product of products) {
		if (textLower.includes(product.toLowerCase())) {
			keywords.push(product);
		}
	}

	// Technical concepts
	const concepts = searchConfig.domainConcepts ?? [];
	for (const concept of concepts) {
		if (textLower.includes(concept.toLowerCase())) {
			keywords.push(concept);
		}
	}

	return keywords;
}
