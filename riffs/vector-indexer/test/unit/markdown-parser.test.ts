/**
 * Unit tests for MarkdownParser
 */

import pino from 'pino';
import { beforeEach, describe, expect, it } from 'vitest';
import { MarkdownParser } from '../../src/core/markdown-parser.js';

describe('MarkdownParser', () => {
	let parser: MarkdownParser;
	let logger: pino.Logger;

	beforeEach(() => {
		logger = pino({ level: 'silent' });
		parser = new MarkdownParser(logger);
	});

	describe('parse', () => {
		it('should parse simple markdown with headings', () => {
			const markdown = `# Main Heading

Content under main heading.

## Subheading

Content under subheading.`;

			const sections = parser.parse(markdown);

			expect(sections).toHaveLength(1);
			expect(sections[0].level).toBe(1);
			expect(sections[0].heading).toBe('Main Heading');
			expect(sections[0].subsections).toHaveLength(1);
			expect(sections[0].subsections[0].level).toBe(2);
			expect(sections[0].subsections[0].heading).toBe('Subheading');
		});

		it('should handle nested heading hierarchy', () => {
			const markdown = `# H1

## H2

### H3

#### H4

Content at H4.`;

			const sections = parser.parse(markdown);

			expect(sections).toHaveLength(1);
			expect(sections[0].level).toBe(1);
			expect(sections[0].subsections).toHaveLength(1);
			expect(sections[0].subsections[0].level).toBe(2);
			expect(sections[0].subsections[0].subsections).toHaveLength(1);
			expect(sections[0].subsections[0].subsections[0].level).toBe(3);
		});

		it('should extract content between headings', () => {
			const markdown = `# Main

Paragraph one.

Paragraph two.

## Sub

Sub content.`;

			const sections = parser.parse(markdown);

			expect(sections[0].content).toContain('Paragraph one');
			expect(sections[0].content).toContain('Paragraph two');
			expect(sections[0].subsections[0].content).toContain('Sub content');
		});

		it('should handle multiple top-level headings', () => {
			const markdown = `# First

Content one.

# Second

Content two.`;

			const sections = parser.parse(markdown);

			expect(sections).toHaveLength(2);
			expect(sections[0].heading).toBe('First');
			expect(sections[1].heading).toBe('Second');
		});

		it('should estimate token counts', () => {
			const markdown = `# Heading

This is some content that should have tokens.`;

			const sections = parser.parse(markdown);

			expect(sections[0].tokens).toBeGreaterThan(0);
		});

		it('should handle empty content', () => {
			const markdown = `# Empty

## Also Empty

# Another`;

			const sections = parser.parse(markdown);

			expect(sections).toHaveLength(2);
			expect(sections[0].content).toBe('');
			expect(sections[1].content).toBe('');
		});

		it('should preserve parent relationships', () => {
			const markdown = `# Parent

## Child

### Grandchild`;

			const sections = parser.parse(markdown);

			const child = sections[0].subsections[0];
			const grandchild = child.subsections[0];

			expect(child.parent).toBe(sections[0]);
			expect(grandchild.parent).toBe(child);
		});
	});

	describe('flattenSections', () => {
		it('should flatten hierarchical sections', () => {
			const markdown = `# H1

## H2a

## H2b

### H3`;

			const sections = parser.parse(markdown);
			const flattened = parser.flattenSections(sections);

			expect(flattened).toHaveLength(4); // H1, H2a, H2b, H3
			expect(flattened[0].level).toBe(1);
			expect(flattened[1].level).toBe(2);
			expect(flattened[2].level).toBe(2);
			expect(flattened[3].level).toBe(3);
		});

		it('should preserve section order when flattening', () => {
			const markdown = `# First

## Second

### Third

## Fourth`;

			const sections = parser.parse(markdown);
			const flattened = parser.flattenSections(sections);

			expect(flattened.map(s => s.heading)).toEqual(['First', 'Second', 'Third', 'Fourth']);
		});
	});
});
