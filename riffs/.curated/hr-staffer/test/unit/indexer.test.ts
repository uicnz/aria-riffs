import { describe, expect, it } from 'vitest';
import { buildMetadata, parseTitle } from '../../src/core/indexer.js';

describe('parseTitle', () => {
	it('given markdown with H1 at start, when parseTitle called, then returns title text', () => {
		const input = '# My Title\n\nSome content';

		const result = parseTitle(input);

		expect(result).toBe('My Title');
	});

	it('given markdown with no H1, when parseTitle called, then returns undefined', () => {
		const input = '## Subtitle\n\nSome content';

		const result = parseTitle(input);

		expect(result).toBeUndefined();
	});
});

describe('buildMetadata', () => {
	it('given file path, when buildMetadata called, then id is filename without extension', () => {
		const filePath = '/path/to/0001-john-smith.md';
		const content = '# John Smith\n\nContent';

		const result = buildMetadata(filePath, content);

		expect(result.id).toBe('0001-john-smith');
	});

	it('given deep file path, when buildMetadata called, then relative_path contains last 3 path components', () => {
		const filePath = '/deep/nested/path/to/sections/0001-john-smith.md';
		const content = '# John Smith\n\nContent';

		const result = buildMetadata(filePath, content);

		expect(result.relative_path).toBe('to/sections/0001-john-smith.md');
	});

	it('given content with H1 title, when buildMetadata called, then title extracted from content', () => {
		const filePath = '/path/to/file.md';
		const content = '# Some Title\n\nContent here';

		const result = buildMetadata(filePath, content);

		expect(result.title).toBe('Some Title');
	});

	it('given any content, when buildMetadata called, then indexed_at is valid ISO timestamp', () => {
		const filePath = '/path/to/file.md';
		const content = 'Content';

		const result = buildMetadata(filePath, content);

		expect(result.indexed_at).toBeDefined();
		expect(() => new Date(result.indexed_at)).not.toThrow();
		// Verify it's recent (within last minute)
		const timestamp = new Date(result.indexed_at).getTime();
		const now = Date.now();
		expect(now - timestamp).toBeLessThan(60000);
	});

	it('given content with YAML frontmatter, when buildMetadata called, then source info extracted', () => {
		const filePath = '/path/to/file.md';
		const content = `---
source_file: .aria/db/hr-staffer/org-chart.md
line_range: [10, 25]
---

# Title

Content`;

		const result = buildMetadata(filePath, content);

		expect(result.source_path).toBe('.aria/db/hr-staffer/org-chart.md');
		expect(result.source_lines).toEqual([10, 25]);
	});

	it('given content without frontmatter, when buildMetadata called, then source_path is file path', () => {
		const filePath = '/path/to/file.md';
		const content = '# Title\n\nContent without frontmatter';

		const result = buildMetadata(filePath, content);

		expect(result.source_path).toBe(filePath);
		expect(result.source_lines).toBeUndefined();
	});

	it('given content with staff fields, when buildMetadata called, then extracts department, title, manager, location', () => {
		const filePath = '/path/to/0001-john-smith.md';
		const content = `---
source_file: test.md
---

#### John Smith

- Title: Senior Engineer
- Department: Engineering
- Manager: Jane Doe
- Email: john@example.com
- City: Auckland
- Country: NZ`;

		const result = buildMetadata(filePath, content);

		expect(result.department).toBe('Engineering');
		expect(result.job_title).toBe('Senior Engineer');
		expect(result.manager).toBe('Jane Doe');
		expect(result.city).toBe('Auckland');
		expect(result.country).toBe('NZ');
	});

	it('given content with missing staff fields, when buildMetadata called, then omits undefined fields', () => {
		const filePath = '/path/to/0001-john-smith.md';
		const content = `#### John Smith

- Title: Engineer
- City: Wellington`;

		const result = buildMetadata(filePath, content);

		expect(result.job_title).toBe('Engineer');
		expect(result.city).toBe('Wellington');
		expect(result.department).toBeUndefined();
		expect(result.manager).toBeUndefined();
		expect(result.country).toBeUndefined();
	});
});
