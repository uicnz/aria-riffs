import { describe, expect, it } from 'vitest';
import {
	expandQuery,
	expandTitleAbbreviation,
	getQueryTerms,
	getSynonyms,
	hasExpandableTerms,
} from '../../src/core/query-expansion.js';

describe('getSynonyms', () => {
	it('given term with synonyms, when getSynonyms called, then returns all synonyms', () => {
		const synonyms = getSynonyms('engineer');
		expect(synonyms).toContain('engineer');
		expect(synonyms).toContain('developer');
		expect(synonyms).toContain('dev');
		expect(synonyms).toContain('programmer');
	});

	it('given term without synonyms, when getSynonyms called, then returns original term only', () => {
		const synonyms = getSynonyms('xyz123');
		expect(synonyms).toEqual(['xyz123']);
	});

	it('given case-insensitive term, when getSynonyms called, then finds synonyms regardless of case', () => {
		const synonyms = getSynonyms('ENGINEER');
		expect(synonyms).toContain('engineer');
		expect(synonyms).toContain('developer');
	});
});

describe('expandQuery', () => {
	it('given query with expandable terms, when expandQuery called, then returns expanded terms', () => {
		const expanded = expandQuery('senior engineer auckland');
		expect(expanded).toContain('senior');
		expect(expanded).toContain('sr');
		expect(expanded).toContain('engineer');
		expect(expanded).toContain('developer');
		expect(expanded).toContain('auckland');
		expect(expanded).toContain('akl');
	});

	it('given query with no expandable terms, when expandQuery called, then returns original terms', () => {
		const expanded = expandQuery('john smith');
		expect(expanded).toEqual(['john', 'smith']);
	});

	it('given empty query, when expandQuery called, then returns empty array', () => {
		const expanded = expandQuery('');
		expect(expanded).toEqual([]);
	});

	it('given query with duplicate synonyms, when expandQuery called, then returns deduplicated terms', () => {
		const expanded = expandQuery('engineer developer');
		// Both terms are in the same synonym group, should not have duplicates
		const unique = new Set(expanded);
		expect(expanded.length).toBe(unique.size);
	});
});

describe('hasExpandableTerms', () => {
	it('given query with expandable term, when hasExpandableTerms called, then returns true', () => {
		expect(hasExpandableTerms('senior engineer')).toBe(true);
	});

	it('given query with no expandable terms, when hasExpandableTerms called, then returns false', () => {
		expect(hasExpandableTerms('john smith')).toBe(false);
	});

	it('given empty query, when hasExpandableTerms called, then returns false', () => {
		expect(hasExpandableTerms('')).toBe(false);
	});
});

describe('getQueryTerms', () => {
	it('given query, when getQueryTerms called, then returns lowercase terms', () => {
		const terms = getQueryTerms('Senior ENGINEER Auckland');
		expect(terms).toContain('senior');
		expect(terms).toContain('engineer');
		expect(terms).toContain('auckland');
	});

	it('given query with short terms, when getQueryTerms called, then filters out terms 2 chars or less', () => {
		const terms = getQueryTerms('a an to engineer');
		expect(terms).not.toContain('a');
		expect(terms).not.toContain('an');
		expect(terms).not.toContain('to');
		expect(terms).toContain('engineer');
	});
});

describe('synonym groups coverage', () => {
	it('given job title terms, when getSynonyms called, then finds appropriate synonyms', () => {
		// Manager synonyms
		expect(getSynonyms('manager')).toContain('lead');
		expect(getSynonyms('lead')).toContain('manager');

		// Senior synonyms
		expect(getSynonyms('senior')).toContain('sr');
		expect(getSynonyms('snr')).toContain('senior');

		// Junior synonyms
		expect(getSynonyms('junior')).toContain('jr');
		expect(getSynonyms('associate')).toContain('junior');
	});

	it('given department terms, when getSynonyms called, then finds appropriate synonyms', () => {
		// Engineering synonyms
		expect(getSynonyms('engineering')).toContain('tech');
		expect(getSynonyms('it')).toContain('engineering');

		// HR synonyms
		expect(getSynonyms('hr')).toContain('people');

		// Finance synonyms
		expect(getSynonyms('finance')).toContain('accounting');

		// NOC synonyms
		expect(getSynonyms('noc')).toContain('network');
	});

	it('given location terms, when getSynonyms called, then finds appropriate synonyms', () => {
		// NZ city abbreviations
		expect(getSynonyms('wellington')).toContain('wgtn');
		expect(getSynonyms('christchurch')).toContain('chch');
		expect(getSynonyms('auckland')).toContain('akl');
	});
});

describe('expandTitleAbbreviation', () => {
	it('given CTO abbreviation, when expandTitleAbbreviation called, then returns full title terms', () => {
		const expanded = expandTitleAbbreviation('CTO');
		expect(expanded).toContain('chief');
		expect(expanded).toContain('technology');
		expect(expanded).toContain('officer');
	});

	it('given CFO abbreviation, when expandTitleAbbreviation called, then returns full title terms', () => {
		const expanded = expandTitleAbbreviation('cfo');
		expect(expanded).toContain('chief');
		expect(expanded).toContain('financial');
		expect(expanded).toContain('officer');
	});

	it('given non-abbreviation term, when expandTitleAbbreviation called, then returns empty array', () => {
		const expanded = expandTitleAbbreviation('engineer');
		expect(expanded).toEqual([]);
	});

	it('given VP abbreviation, when expandTitleAbbreviation called, then returns vice president', () => {
		const expanded = expandTitleAbbreviation('VP');
		expect(expanded).toContain('vice');
		expect(expanded).toContain('president');
	});
});

describe('expandQuery with title abbreviations', () => {
	it('given CTO query, when expandQuery called, then includes Chief Technology Officer terms', () => {
		const expanded = expandQuery('CTO');
		expect(expanded).toContain('cto');
		expect(expanded).toContain('chief');
		expect(expanded).toContain('technology');
		expect(expanded).toContain('officer');
	});

	it('given query with title abbreviation, when hasExpandableTerms called, then returns true', () => {
		expect(hasExpandableTerms('CTO')).toBe(true);
		expect(hasExpandableTerms('CFO')).toBe(true);
		expect(hasExpandableTerms('VP engineering')).toBe(true);
	});
});
