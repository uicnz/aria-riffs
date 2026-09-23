import { describe, expect, it } from 'vitest';
import { parseFrontmatter, stripFrontmatter } from '../../../src/core/frontmatter-parser.js';

describe('parseFrontmatter', () => {
	describe('valid frontmatter parsing', () => {
		it('given content with valid YAML frontmatter, when parseFrontmatter called, then extracts all fields', () => {
			const content = `---
source_file: /path/to/file.md
source_section: Health Insurance
section_index: 1
line_range:
  - 45
  - 112
decomposed_at: '2025-11-24T10:30:00Z'
original_heading: '## Health Insurance'
boundary_type: primary
---

Markdown content here`;

			const result = parseFrontmatter(content);

			expect(result).not.toBeNull();
			expect(result?.source_file).toBe('/path/to/file.md');
			expect(result?.source_section).toBe('Health Insurance');
			expect(result?.section_index).toBe(1);
			expect(result?.line_range).toEqual([45, 112]);
			expect(result?.decomposed_at).toBe('2025-11-24T10:30:00Z');
			expect(result?.original_heading).toBe('## Health Insurance');
			expect(result?.boundary_type).toBe('primary');
		});

		it('given content with fallback boundary type, when parseFrontmatter called, then captures fallback', () => {
			const content = `---
source_file: /path/to/file.md
source_section: Introduction
section_index: 0
line_range:
  - 1
  - 44
decomposed_at: '2025-11-24T10:30:00Z'
original_heading: ''
boundary_type: fallback
---

Content here`;

			const result = parseFrontmatter(content);

			expect(result?.boundary_type).toBe('fallback');
		});

		it('given content without boundary_type field, when parseFrontmatter called, then parses successfully with undefined', () => {
			const content = `---
source_file: /path/to/file.md
source_section: Section
section_index: 1
line_range:
  - 10
  - 20
decomposed_at: '2025-11-24T10:30:00Z'
original_heading: '## Section'
---

Content`;

			const result = parseFrontmatter(content);

			expect(result).not.toBeNull();
			expect(result?.boundary_type).toBeUndefined();
		});

		it('given content with empty original_heading, when parseFrontmatter called, then preserves empty string', () => {
			const content = `---
source_file: /path/to/file.md
source_section: intro
section_index: 0
line_range:
  - 1
  - 10
decomposed_at: '2025-11-24T10:30:00Z'
original_heading: ''
---

Content`;

			const result = parseFrontmatter(content);

			expect(result?.original_heading).toBe('');
		});
	});

	describe('invalid or missing content', () => {
		it('given content without frontmatter marker, when parseFrontmatter called, then returns null', () => {
			const content = 'Just regular markdown content\nNo frontmatter here';

			const result = parseFrontmatter(content);

			expect(result).toBeNull();
		});

		it('given content with opening marker but no closing marker, when parseFrontmatter called, then returns null', () => {
			const content = `---
source_file: /path/to/file.md
source_section: Section
section_index: 1

No closing marker`;

			const result = parseFrontmatter(content);

			expect(result).toBeNull();
		});

		it('given content with invalid YAML in frontmatter, when parseFrontmatter called, then returns null', () => {
			const content = `---
source_file: /path/to/file.md
: invalid yaml syntax here
---

Content`;

			const result = parseFrontmatter(content);

			expect(result).toBeNull();
		});

		it('given content with empty frontmatter block, when parseFrontmatter called, then returns null', () => {
			const content = `---
---

Content`;

			const result = parseFrontmatter(content);

			expect(result).toBeNull();
		});
	});

	describe('missing required fields', () => {
		it('given frontmatter missing source_file, when parseFrontmatter called, then returns null', () => {
			const content = `---
source_section: Section
section_index: 1
line_range:
  - 10
  - 20
decomposed_at: '2025-11-24T10:30:00Z'
original_heading: '## Section'
---

Content`;

			const result = parseFrontmatter(content);

			expect(result).toBeNull();
		});

		it('given frontmatter missing source_section, when parseFrontmatter called, then returns null', () => {
			const content = `---
source_file: /path/to/file.md
section_index: 1
line_range:
  - 10
  - 20
decomposed_at: '2025-11-24T10:30:00Z'
original_heading: '## Section'
---

Content`;

			const result = parseFrontmatter(content);

			expect(result).toBeNull();
		});

		it('given frontmatter missing section_index, when parseFrontmatter called, then returns null', () => {
			const content = `---
source_file: /path/to/file.md
source_section: Section
line_range:
  - 10
  - 20
decomposed_at: '2025-11-24T10:30:00Z'
original_heading: '## Section'
---

Content`;

			const result = parseFrontmatter(content);

			expect(result).toBeNull();
		});

		it('given frontmatter missing line_range, when parseFrontmatter called, then returns null', () => {
			const content = `---
source_file: /path/to/file.md
source_section: Section
section_index: 1
decomposed_at: '2025-11-24T10:30:00Z'
original_heading: '## Section'
---

Content`;

			const result = parseFrontmatter(content);

			expect(result).toBeNull();
		});

		it('given frontmatter missing decomposed_at, when parseFrontmatter called, then returns null', () => {
			const content = `---
source_file: /path/to/file.md
source_section: Section
section_index: 1
line_range:
  - 10
  - 20
original_heading: '## Section'
---

Content`;

			const result = parseFrontmatter(content);

			expect(result).toBeNull();
		});

		it('given frontmatter missing original_heading, when parseFrontmatter called, then returns null', () => {
			const content = `---
source_file: /path/to/file.md
source_section: Section
section_index: 1
line_range:
  - 10
  - 20
decomposed_at: '2025-11-24T10:30:00Z'
---

Content`;

			const result = parseFrontmatter(content);

			expect(result).toBeNull();
		});
	});

	describe('edge cases', () => {
		it('given content with multiple --- markers in body, when parseFrontmatter called, then uses first closing marker', () => {
			const content = `---
source_file: /path/to/file.md
source_section: Section
section_index: 1
line_range:
  - 10
  - 20
decomposed_at: '2025-11-24T10:30:00Z'
original_heading: '## Section'
---

Content with --- inside

More content`;

			const result = parseFrontmatter(content);

			expect(result).not.toBeNull();
			expect(result?.source_section).toBe('Section');
		});

		it('given content with zero section_index, when parseFrontmatter called, then parses correctly', () => {
			const content = `---
source_file: /path/to/file.md
source_section: intro
section_index: 0
line_range:
  - 1
  - 50
decomposed_at: '2025-11-24T10:30:00Z'
original_heading: ''
---

Content`;

			const result = parseFrontmatter(content);

			expect(result?.section_index).toBe(0);
		});

		it('given content with large line_range numbers, when parseFrontmatter called, then parses correctly', () => {
			const content = `---
source_file: /path/to/file.md
source_section: Section
section_index: 1
line_range:
  - 5000
  - 10000
decomposed_at: '2025-11-24T10:30:00Z'
original_heading: '## Section'
---

Content`;

			const result = parseFrontmatter(content);

			expect(result?.line_range).toEqual([5000, 10000]);
		});
	});
});

describe('stripFrontmatter', () => {
	describe('valid frontmatter removal', () => {
		it('given content with frontmatter, when stripFrontmatter called, then removes frontmatter block', () => {
			const content = `---
source_file: /path/to/file.md
source_section: Section
section_index: 1
line_range:
  - 10
  - 20
decomposed_at: '2025-11-24T10:30:00Z'
original_heading: '## Section'
---

Markdown content here
More content`;

			const result = stripFrontmatter(content);

			expect(result).not.toContain('source_file:');
			expect(result).not.toContain('---\n');
			expect(result).toContain('Markdown content here');
			expect(result).toContain('More content');
		});

		it('given content without frontmatter, when stripFrontmatter called, then returns content unchanged', () => {
			const content = 'Just markdown\nNo frontmatter';

			const result = stripFrontmatter(content);

			expect(result).toBe(content);
		});

		it('given content with frontmatter and empty body, when stripFrontmatter called, then returns empty or whitespace', () => {
			const content = `---
source_file: /path/to/file.md
source_section: Section
section_index: 1
line_range:
  - 10
  - 20
decomposed_at: '2025-11-24T10:30:00Z'
original_heading: '## Section'
---`;

			const result = stripFrontmatter(content);

			expect(result.trim()).toBe('');
		});

		it('given content with opening marker but no closing, when stripFrontmatter called, then returns original', () => {
			const content = `---
source_file: /path/to/file.md

Some content`;

			const result = stripFrontmatter(content);

			expect(result).toBe(content);
		});
	});

	describe('return value structure', () => {
		it('given content with multiple empty lines after frontmatter, when stripFrontmatter called, then preserves them', () => {
			const content = `---
source_file: /path/to/file.md
source_section: Section
section_index: 1
line_range:
  - 10
  - 20
decomposed_at: '2025-11-24T10:30:00Z'
original_heading: '## Section'
---


Content with leading blank lines`;

			const result = stripFrontmatter(content);

			expect(result).toContain('Content with leading blank lines');
			expect(result.startsWith('\n')).toBe(true);
		});
	});
});
