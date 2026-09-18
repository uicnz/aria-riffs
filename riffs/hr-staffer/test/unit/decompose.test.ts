import { describe, expect, it } from 'vitest';
import { extractSections } from '../../src/core/decompose.js';
import type { DecomposerConfig } from '../../src/lib/types.js';

describe('extractSections', () => {
	// Fixtures
	const defaultConfig: DecomposerConfig = {
		input_file: 'test.md',
		output_directory: '/tmp/test',
		header_pattern: '^#{1,6} .+',
	};
	const sourceFile = 'test.md';

	// Helper to reduce boilerplate
	const toSections = (lines: string[]) => Array.from(extractSections(lines, defaultConfig, sourceFile));

	it('given empty content, when extractSections called, then yields empty generator', () => {
		const sections = toSections([]);

		expect(sections).toEqual([]);
	});

	it('given content with no headers, when extractSections called, then yields empty generator', () => {
		const sections = toSections(['Just text content', 'More text', 'No headers here']);

		expect(sections).toEqual([]);
	});

	it('given single header with content, when extractSections called, then yields one section', () => {
		const sections = toSections(['# Title', '', 'Content here']);

		expect(sections).toHaveLength(1);
		expect(sections[0].heading).toBe('# Title');
		expect(sections[0].content).toBe('# Title\n\nContent here');
	});

	it('given multiple headers, when extractSections called, then yields multiple sections', () => {
		const sections = toSections(['## Section 1', 'Content 1', '## Section 2', 'Content 2']);

		expect(sections).toHaveLength(2);
		expect(sections[0].heading).toBe('## Section 1');
		expect(sections[0].content).toBe('## Section 1\nContent 1');
		expect(sections[1].heading).toBe('## Section 2');
		expect(sections[1].content).toBe('## Section 2\nContent 2');
	});

	it('given mixed header levels (H2, H3, H4), when extractSections called, then yields section for each header', () => {
		const sections = toSections(['## H2', 'Content H2', '### H3', 'Content H3', '#### H4', 'Content H4']);

		expect(sections).toHaveLength(3);
		expect(sections[0].heading).toBe('## H2');
		expect(sections[1].heading).toBe('### H3');
		expect(sections[2].heading).toBe('#### H4');
	});

	it('given multiple sections, when extractSections called, then tracks correct line ranges', () => {
		const sections = toSections([
			'## Section 1', // line 0
			'Content 1a', // line 1
			'Content 1b', // line 2
			'## Section 2', // line 3
			'Content 2', // line 4
		]);

		expect(sections[0].metadata.line_range).toEqual([0, 2]);
		expect(sections[1].metadata.line_range).toEqual([3, 4]);
	});

	it('given section with heading, when extractSections called, then generates filename from heading', () => {
		const sections = toSections(['## Andrew Allan', 'Content']);

		expect(sections[0].filename).toBe('0000-andrew-allan.md');
	});

	it('given heading with special characters, when extractSections called, then sanitizes filename to kebab-case', () => {
		const sections = toSections(['## Sales & Solutions (North)', 'Content']);

		expect(sections[0].filename).toBe('0000-sales-solutions-north.md');
	});

	it('given content with leading and trailing whitespace, when extractSections called, then trims content', () => {
		const sections = toSections(['## Title', '', '', 'Content line', '', '']);

		expect(sections[0].content).toBe('## Title\n\n\nContent line');
	});

	it('given any section, when extractSections called, then metadata includes all required fields', () => {
		const sections = toSections(['## Title', 'Content']);

		const metadata = sections[0].metadata;
		expect(metadata).toHaveProperty('source_file', sourceFile);
		expect(metadata).toHaveProperty('source_section', '## Title');
		expect(metadata).toHaveProperty('section_index', 0);
		expect(metadata).toHaveProperty('line_range');
		expect(metadata).toHaveProperty('decomposed_at');
		expect(typeof metadata.decomposed_at).toBe('string');
		// Verify it's a valid ISO timestamp
		expect(() => new Date(metadata.decomposed_at)).not.toThrow();
	});

	it('given any section, when extractSections called, then frontmatter is valid YAML with all metadata fields', () => {
		const sections = toSections(['## Title', 'Content']);

		const frontmatter = sections[0].frontmatter;

		// Frontmatter should start and end with ---
		expect(frontmatter).toMatch(/^---\n/);
		expect(frontmatter).toMatch(/\n---$/);

		// Should contain all metadata fields
		expect(frontmatter).toContain(`source_file: ${sourceFile}`);
		expect(frontmatter).toContain('source_section: "## Title"');
		expect(frontmatter).toContain('section_index: 0');
		expect(frontmatter).toContain('line_range: [0, 1]');
		expect(frontmatter).toContain('decomposed_at:');
	});
});
