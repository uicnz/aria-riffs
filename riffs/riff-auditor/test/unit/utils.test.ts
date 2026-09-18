/**
 * Unit tests for riff-auditor utility functions
 */

import { describe, expect, it } from 'vitest';
import {
	collectUnderscoreKeys,
	countWrapperUsage,
	findSnakeCaseStringLiterals,
	toPascalCase,
	toScreamingSnakeCase,
} from '../../src/audits/utils.js';

describe('toPascalCase', () => {
	it('converts kebab-case to PascalCase', () => {
		expect(toPascalCase('doc-indexer')).toBe('DocIndexer');
		expect(toPascalCase('image-transcoder')).toBe('ImageTranscoder');
		expect(toPascalCase('riff-auditor')).toBe('RiffAuditor');
	});

	it('handles single word', () => {
		expect(toPascalCase('riff')).toBe('Riff');
	});

	it('handles multiple dashes', () => {
		expect(toPascalCase('my-long-riff-name')).toBe('MyLongRiffName');
	});
});

describe('toScreamingSnakeCase', () => {
	it('converts kebab-case to SCREAMING_SNAKE_CASE', () => {
		expect(toScreamingSnakeCase('doc-indexer')).toBe('DOC_INDEXER');
		expect(toScreamingSnakeCase('image-transcoder')).toBe('IMAGE_TRANSCODER');
		expect(toScreamingSnakeCase('riff-auditor')).toBe('RIFF_AUDITOR');
	});
});

describe('collectUnderscoreKeys', () => {
	it('finds underscore keys in objects', () => {
		const results: string[] = [];
		collectUnderscoreKeys({ snake_case: 'value', camelCase: 'value' }, '', results);
		expect(results).toEqual(['snake_case']);
	});

	it('finds nested underscore keys', () => {
		const results: string[] = [];
		collectUnderscoreKeys(
			{
				parent: {
					child_key: 'value',
				},
			},
			'',
			results
		);
		expect(results).toEqual(['parent.child_key']);
	});

	it('handles empty objects', () => {
		const results: string[] = [];
		collectUnderscoreKeys({}, '', results);
		expect(results).toEqual([]);
	});
});

describe('findSnakeCaseStringLiterals', () => {
	it('finds snake_case strings in single quotes', () => {
		const content = "const x = 'snake_case_value';";
		expect(findSnakeCaseStringLiterals(content)).toEqual(['snake_case_value']);
	});

	it('finds snake_case strings in double quotes', () => {
		const content = 'const x = "snake_case_value";';
		expect(findSnakeCaseStringLiterals(content)).toEqual(['snake_case_value']);
	});

	it('ignores camelCase strings', () => {
		const content = "const x = 'camelCase';";
		expect(findSnakeCaseStringLiterals(content)).toEqual([]);
	});

	it('returns sorted unique values', () => {
		const content = "const x = 'b_key'; const y = 'a_key'; const z = 'b_key';";
		expect(findSnakeCaseStringLiterals(content)).toEqual(['a_key', 'b_key']);
	});
});

describe('countWrapperUsage', () => {
	it('counts bracket notation usage', () => {
		const content = "config['doc-indexer'].path; config['doc-indexer'].file;";
		expect(countWrapperUsage('doc-indexer', content)).toBe(2);
	});

	it('returns 0 when no usage', () => {
		const content = 'const x = 1;';
		expect(countWrapperUsage('doc-indexer', content)).toBe(0);
	});
});
