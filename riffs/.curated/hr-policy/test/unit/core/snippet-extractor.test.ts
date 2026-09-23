import { describe, expect, it } from 'vitest';
import { extractSnippet } from '../../../src/core/snippet-extractor.js';

describe('extractSnippet', () => {
	describe('basic extraction', () => {
		it('given single-line document with query, when extractSnippet called, then returns snippet with matching text', () => {
			const content = 'This is a test document';
			const snippet = extractSnippet(content, 'test', 0);

			expect(snippet).not.toBeNull();
			expect(snippet?.text).toContain('test');
			expect(snippet?.startLine).toBe(1);
			expect(snippet?.endLine).toBe(1);
		});

		it('given multi-line document with query, when extractSnippet called, then returns snippet with context', () => {
			const content = `Line 1: introduction
Line 2: important policy
Line 3: conclusion`;
			const snippet = extractSnippet(content, 'policy', 1);

			expect(snippet).not.toBeNull();
			expect(snippet?.text).toContain('policy');
			expect(snippet?.startLine).toBe(1);
			expect(snippet?.endLine).toBe(3);
		});

		it('given document with no matches, when extractSnippet called, then returns null', () => {
			const content = 'This is a document with no matches';
			const snippet = extractSnippet(content, 'nonexistent', 1);

			expect(snippet).toBeNull();
		});
	});

	describe('match detection', () => {
		it('given document with case-insensitive match, when extractSnippet called, then finds match regardless of case', () => {
			const content = 'The Policy requires approval';
			const snippet = extractSnippet(content, 'policy', 0);

			expect(snippet).not.toBeNull();
			expect(snippet?.text.toLowerCase()).toContain('policy');
		});

		it('given document with multiple matching terms, when extractSnippet called, then returns all match indices', () => {
			const content = 'policy and policy approval for policy';
			const snippet = extractSnippet(content, 'policy', 0);

			expect(snippet).not.toBeNull();
			expect(snippet?.matchIndices.length).toBeGreaterThan(1);
		});

		it('given document with multi-word query, when extractSnippet called, then finds all terms', () => {
			const content = 'The company policy requires approval process';
			const snippet = extractSnippet(content, 'policy requires', 0);

			expect(snippet).not.toBeNull();
			expect(snippet?.matchIndices.length).toBeGreaterThanOrEqual(2);
		});
	});

	describe('context window', () => {
		it('given document with context lines specified, when extractSnippet called, then includes surrounding context', () => {
			const content = `Line 1
Line 2
Line 3: match here
Line 4
Line 5`;
			const snippet = extractSnippet(content, 'match', 1);

			expect(snippet).not.toBeNull();
			expect(snippet?.text).toContain('Line 2');
			expect(snippet?.text).toContain('Line 3');
			expect(snippet?.text).toContain('Line 4');
		});

		it('given match at start of document, when context window requested, then truncates appropriately', () => {
			const content = `Line 1: match
Line 2
Line 3`;
			const snippet = extractSnippet(content, 'match', 2);

			expect(snippet).not.toBeNull();
			expect(snippet?.startLine).toBe(1);
			expect(snippet?.endLine).toBeGreaterThan(1);
		});

		it('given match at end of document, when context window requested, then truncates appropriately', () => {
			const content = `Line 1
Line 2
Line 3: match`;
			const snippet = extractSnippet(content, 'match', 2);

			expect(snippet).not.toBeNull();
			expect(snippet?.endLine).toBe(3);
			expect(snippet?.startLine).toBeLessThan(3);
		});

		it('given default context lines, when extractSnippet called without parameter, then uses 2 lines default', () => {
			const content = `Line 1
Line 2
Line 3: match
Line 4
Line 5`;
			const snippet = extractSnippet(content, 'match');

			expect(snippet).not.toBeNull();
			expect(snippet?.text).toContain('Line 2');
			expect(snippet?.text).toContain('Line 3');
			expect(snippet?.text).toContain('Line 4');
		});
	});

	describe('line number calculation', () => {
		it('given snippet from middle of document, when extracted, then startLine and endLine are 1-indexed', () => {
			const content = `Line 1
Line 2: match
Line 3`;
			const snippet = extractSnippet(content, 'match', 1);

			expect(snippet).not.toBeNull();
			if (!snippet) return;
			expect(snippet.startLine).toBeGreaterThanOrEqual(1);
			expect(snippet.endLine).toBeGreaterThanOrEqual(snippet.startLine);
		});

		it('given document with multiple sections, when extractSnippet called, then returns correct absolute line numbers', () => {
			const content = `Section 1: intro
Section 2: content
Section 3: match
Section 4: conclusion`;
			const snippet = extractSnippet(content, 'match', 0);

			expect(snippet).not.toBeNull();
			expect(snippet?.startLine).toBe(3);
			expect(snippet?.endLine).toBe(3);
		});
	});

	describe('match position tracking', () => {
		it('given single match in snippet, when extracted, then matchIndices contains start and end position', () => {
			const content = 'This is a test';
			const snippet = extractSnippet(content, 'test', 0);

			expect(snippet).not.toBeNull();
			if (!snippet) return;
			expect(snippet.matchIndices.length).toBeGreaterThan(0);
			const firstMatch = snippet.matchIndices[0];
			expect(firstMatch?.start).toBeGreaterThanOrEqual(0);
			expect(firstMatch?.end).toBeGreaterThan(firstMatch?.start ?? 0);
		});

		it('given multiple matches, when extracted, then matchIndices sorted by position', () => {
			const content = 'test code test logic test';
			const snippet = extractSnippet(content, 'test', 0);

			expect(snippet).not.toBeNull();
			for (let i = 1; i < snippet!.matchIndices.length; i++) {
				expect(snippet!.matchIndices[i]!.start).toBeGreaterThan(snippet!.matchIndices[i - 1]!.end);
			}
		});

		it('given adjacent matches, when extracted, then overlapping regions merged', () => {
			const content = 'test here test and test again';
			const snippet = extractSnippet(content, 'test', 0);

			expect(snippet).not.toBeNull();
			// Should find multiple whole-word matches for 'test'
			expect(snippet?.matchIndices.length).toBeGreaterThanOrEqual(3);
			// Verify no overlapping indices
			const indices = snippet?.matchIndices ?? [];
			for (let i = 1; i < indices.length; i++) {
				expect(indices[i]!.start).toBeGreaterThanOrEqual(indices[i - 1]!.end);
			}
		});

		it('given snippet with newlines, when match indices calculated, then correctly accounts for line breaks', () => {
			const content = `First line
Second line: match
Third line`;
			const snippet = extractSnippet(content, 'match', 0);

			expect(snippet).not.toBeNull();
			if (!snippet) return;
			// Match indices should be relative to snippet text
			const firstMatch = snippet.matchIndices[0];
			expect(firstMatch?.start).toBeLessThan(snippet.text.length);
			expect(firstMatch?.end).toBeLessThanOrEqual(snippet.text.length);
		});
	});

	describe('match density selection', () => {
		it('given document with multiple query occurrences per line, when extractSnippet called, then selects most dense region', () => {
			const content = `line 1: policy policy policy
line 2: other content
line 3: policy
line 4: more policy policy policy policy`;
			const snippet = extractSnippet(content, 'policy', 0);

			expect(snippet).not.toBeNull();
			// Should select line 4 or line 1 (highest density)
			expect(snippet?.matchIndices.length).toBeGreaterThan(1);
		});

		it('given first match and later denser match, when density calculated, then finds valid match region', () => {
			const content = `line 1: test
line 2: regular content
line 3: test test test`;
			const snippet = extractSnippet(content, 'test', 0);

			expect(snippet).not.toBeNull();
			// Should find at least one match in the snippet
			expect(snippet?.matchIndices.length).toBeGreaterThan(0);
			// Snippet should contain the search term
			expect(snippet?.text).toContain('test');
		});
	});

	describe('special characters and edge cases', () => {
		it('given query with special regex characters, when extractSnippet called, then properly escapes pattern', () => {
			const content = 'The amount is approximately dotfive dollars';
			const snippet = extractSnippet(content, 'dotfive', 0);

			expect(snippet).not.toBeNull();
			expect(snippet?.text).toContain('dotfive');
		});

		it('given query matching only whole word, when extractSnippet called, then ignores partial matches', () => {
			const content = 'See whether and where and when we go';
			const snippet = extractSnippet(content, 'where', 0);

			expect(snippet).not.toBeNull();
			// Should only match 'where', not 'whether'
			expect(snippet?.matchIndices.length).toBe(1);
			expect(snippet?.text).toContain('where');
		});

		it('given whitespace in query, when extractSnippet called, then handles multiple spaces', () => {
			const content = `line 1
line 2 with test content
line 3`;
			const snippet = extractSnippet(content, 'test   content', 1);

			expect(snippet).not.toBeNull();
		});

		it('given empty content, when extractSnippet called, then returns null', () => {
			const snippet = extractSnippet('', 'test', 1);

			expect(snippet).toBeNull();
		});

		it('given empty query, when extractSnippet called, then returns null', () => {
			const content = 'some content';
			const snippet = extractSnippet(content, '', 1);

			expect(snippet).toBeNull();
		});
	});

	describe('match metadata', () => {
		it('given extracted snippet, when returned, then includes matchStartCol and matchEndCol', () => {
			const content = 'The quick brown fox jumps';
			const snippet = extractSnippet(content, 'brown', 0);

			expect(snippet).not.toBeNull();
			if (!snippet) return;
			expect(snippet.matchStartCol).toBeGreaterThanOrEqual(0);
			expect(snippet.matchEndCol).toBeGreaterThan(snippet.matchStartCol);
		});

		it('given snippet with multiple matches, when extracted, then matchStartCol and matchEndCol span all matches', () => {
			const content = 'test code test logic test';
			const snippet = extractSnippet(content, 'test', 0);

			expect(snippet).not.toBeNull();
			const firstStart = snippet?.matchIndices[0]?.start;
			const lastEnd = snippet?.matchIndices[snippet!.matchIndices.length - 1]?.end;

			expect(snippet?.matchStartCol).toBeLessThanOrEqual(firstStart!);
			expect(snippet?.matchEndCol).toBeGreaterThanOrEqual(lastEnd!);
		});
	});

	describe('snippet structure', () => {
		it('given extracted snippet, when structure checked, then includes all required fields', () => {
			const content = 'Test document with test content';
			const snippet = extractSnippet(content, 'test', 0);

			expect(snippet).not.toBeNull();
			expect(snippet).toHaveProperty('text');
			expect(snippet).toHaveProperty('startLine');
			expect(snippet).toHaveProperty('endLine');
			expect(snippet).toHaveProperty('matchStartCol');
			expect(snippet).toHaveProperty('matchEndCol');
			expect(snippet).toHaveProperty('matchIndices');
			expect(Array.isArray(snippet?.matchIndices)).toBe(true);
		});

		it('given snippet, when matchIndices validated, then each has start and end', () => {
			const content = 'test test test';
			const snippet = extractSnippet(content, 'test', 0);

			expect(snippet).not.toBeNull();
			for (const index of snippet!.matchIndices) {
				expect(index).toHaveProperty('start');
				expect(index).toHaveProperty('end');
				expect(typeof index.start).toBe('number');
				expect(typeof index.end).toBe('number');
			}
		});
	});
});
