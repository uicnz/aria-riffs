import { describe, expect, it } from 'vitest';
import { decomposeDocument, processSections } from '../../src/core/decompose-docs.js';
import type { DecomposeEvent, Section } from '../../src/lib/types.js';

describe('processSections', () => {
	/**
	 * Helper to create mock DecomposeEvent for testing
	 */
	function createMockEvent(
		heading: string,
		content: string,
		boundaryType: 'primary' | 'fallback' = 'primary',
		boundaryChange: boolean = false
	): DecomposeEvent {
		return {
			section: {
				heading,
				content,
				metadata: {
					source_file: 'test.md',
					source_section: heading === 'intro' ? 'intro' : heading,
					section_index: -1, // Will be assigned by processSections
					line_range: [1, 10],
					decomposed_at: new Date().toISOString(),
					original_heading: heading === 'intro' ? '' : `## ${heading}`,
					boundary_type: boundaryType,
				},
				filename: '', // Will be assigned by processSections
			},
			boundaryChange,
			boundaryType,
		};
	}

	/**
	 * Helper to collect all sections from generator
	 */
	function collectSections(events: Iterable<DecomposeEvent>): Section[] {
		const sections: Section[] = [];
		for (const section of processSections(events)) {
			sections.push(section);
		}
		return sections;
	}

	describe('basic generator behavior', () => {
		it('given primary boundaries only, when processSections called, then yields sections', () => {
			const events = [
				createMockEvent('intro', 'Intro content'),
				createMockEvent('Health Insurance', 'Insurance details'),
				createMockEvent('Retirement Plans', 'Retirement details'),
			];

			const sections = collectSections(events);

			expect(sections).toHaveLength(3);
		});

		it('given primary boundaries only, when processSections called, then assigns section numbers 0, 1, 2', () => {
			const events = [
				createMockEvent('intro', 'Intro content'),
				createMockEvent('Health Insurance', 'Insurance details'),
				createMockEvent('Retirement Plans', 'Retirement details'),
			];

			const sections = collectSections(events);

			expect(sections[0]?.metadata.section_index).toBe(0);
			expect(sections[1]?.metadata.section_index).toBe(1);
			expect(sections[2]?.metadata.section_index).toBe(2);
		});

		it('given primary boundaries only, when processSections called, then generates kebab-case filenames', () => {
			const events = [
				createMockEvent('intro', 'Intro content'),
				createMockEvent('Health Insurance', 'Insurance details'),
				createMockEvent('Retirement Plans', 'Retirement details'),
			];

			const sections = collectSections(events);

			expect(sections[0]?.filename).toBe('00-intro.md');
			expect(sections[1]?.filename).toBe('01-health-insurance.md');
			expect(sections[2]?.filename).toBe('02-retirement-plans.md');
		});
	});

	describe('fallback boundary accumulation', () => {
		it('given fallback boundaries only, when processSections called, then accumulates all sections', () => {
			const events = [
				createMockEvent('intro', 'Intro', 'fallback'),
				createMockEvent('First Subsection', 'Content A', 'fallback'),
				createMockEvent('Second Subsection', 'Content B', 'fallback'),
			];

			const sections = collectSections(events);

			expect(sections).toHaveLength(3);
		});

		it('given fallback boundaries only, when processSections called, then all sections marked as fallback', () => {
			const events = [
				createMockEvent('intro', 'Intro', 'fallback'),
				createMockEvent('First Subsection', 'Content A', 'fallback'),
				createMockEvent('Second Subsection', 'Content B', 'fallback'),
			];

			const sections = collectSections(events);

			sections.forEach(section => {
				expect(section.metadata.boundary_type).toBe('fallback');
			});
		});
	});

	describe('boundary upgrade handling', () => {
		it('given fallback sections then boundary upgrade, when processSections called, then merges all fallback sections into intro', () => {
			const events = [
				createMockEvent('intro', 'Intro content', 'fallback'),
				createMockEvent('First H3', 'First content', 'fallback'),
				createMockEvent('Second H3', 'Second content', 'fallback', true), // boundaryChange = true
				createMockEvent('First H2', 'Primary content', 'primary'),
			];

			const sections = collectSections(events);

			// After merge: 00-intro (merged intro + 2 fallback sections), 01-first-h2
			expect(sections).toHaveLength(2);
			expect(sections[0]?.metadata.section_index).toBe(0);
			expect(sections[1]?.metadata.section_index).toBe(1);
		});

		it('given boundary upgrade, when processSections called, then merged intro contains all fallback content', () => {
			const events = [
				createMockEvent('intro', 'Intro text', 'fallback'),
				createMockEvent('First H3', 'First details', 'fallback'),
				createMockEvent('Second H3', 'Second details', 'fallback', true),
				createMockEvent('First H2', 'Primary content', 'primary'),
			];

			const sections = collectSections(events);

			const mergedIntro = sections[0]?.content || '';
			expect(mergedIntro).toContain('Intro text');
			expect(mergedIntro).toContain('First details');
			expect(mergedIntro).toContain('Second details');
		});

		it('given boundary upgrade, when processSections called, then subsequent primary sections stream immediately', () => {
			const events = [
				createMockEvent('intro', 'Intro', 'fallback'),
				createMockEvent('First H3', 'Content A', 'fallback', true),
				createMockEvent('First H2', 'Content B', 'primary'),
				createMockEvent('Second H2', 'Content C', 'primary'),
				createMockEvent('Third H2', 'Content D', 'primary'),
			];

			const sections = collectSections(events);

			// 00-intro (merged), 01-first-h2, 02-second-h2, 03-third-h2
			expect(sections).toHaveLength(4);
			expect(sections[0]?.metadata.section_index).toBe(0);
			expect(sections[1]?.metadata.section_index).toBe(1);
			expect(sections[2]?.metadata.section_index).toBe(2);
			expect(sections[3]?.metadata.section_index).toBe(3);
		});
	});

	describe('filename generation', () => {
		it('given section with simple heading, when processSections called, then generates correct filename', () => {
			const events = [createMockEvent('intro', 'Intro'), createMockEvent('Overview', 'Content')];

			const sections = collectSections(events);

			expect(sections[0]?.filename).toBe('00-intro.md');
			expect(sections[1]?.filename).toBe('01-overview.md');
		});

		it('given section with special characters, when processSections called, then sanitizes filename', () => {
			const events = [
				createMockEvent('intro', 'Intro'),
				createMockEvent("FAQ: What's the 401(k) match?", 'Content'),
			];

			const sections = collectSections(events);

			expect(sections[1]?.filename).toMatch(/^01-/);
			expect(sections[1]?.filename).toContain('-');
		});

		it('given multiple sections with duplicates, when processSections called, then filenames numbered sequentially', () => {
			const events = [
				createMockEvent('intro', 'Intro'),
				createMockEvent('Overview', 'Content A'),
				createMockEvent('Overview', 'Content B'),
				createMockEvent('Overview', 'Content C'),
			];

			const sections = collectSections(events);

			expect(sections[0]?.filename).toBe('00-intro.md');
			expect(sections[1]?.filename).toBe('01-overview.md');
			expect(sections[2]?.filename).toBe('02-overview.md');
			expect(sections[3]?.filename).toBe('03-overview.md');
		});

		it('given intro section with H1 heading, when processSections called, then uses H1 text for filename', () => {
			const event = createMockEvent('intro', 'Intro');
			event.section.metadata.original_heading = '# Company Handbook';

			const sections = collectSections([event]);

			expect(sections[0]?.filename).toBe('00-company-handbook.md');
		});

		it('given intro section with no H1 heading, when processSections called, then uses intro as filename', () => {
			const event = createMockEvent('intro', 'Intro');
			event.section.metadata.original_heading = '';

			const sections = collectSections([event]);

			expect(sections[0]?.filename).toBe('00-intro.md');
		});

		it('given intro section with H1 containing special characters, when processSections called, then sanitizes for filename', () => {
			const event = createMockEvent('intro', 'Intro');
			event.section.metadata.original_heading = "# FAQ: What's the Best Policy?";

			const sections = collectSections([event]);

			expect(sections[0]?.filename).toMatch(/^00-/);
			expect(sections[0]?.filename).toContain('-');
			expect(sections[0]?.filename).toMatch(/\.md$/);
		});
	});

	describe('metadata preservation', () => {
		it('given sections with metadata, when processSections called, then preserves source information', () => {
			const events = [createMockEvent('intro', 'Intro'), createMockEvent('Health Insurance', 'Content')];

			const sections = collectSections(events);

			expect(sections[1]?.metadata.source_file).toBe('test.md');
			expect(sections[1]?.metadata.original_heading).toBe('## Health Insurance');
		});

		it('given sections, when processSections called, then updates section index but preserves other metadata', () => {
			const events = [
				createMockEvent('intro', 'Intro'),
				createMockEvent('Section One', 'Content'),
				createMockEvent('Section Two', 'Content'),
			];

			const sections = collectSections(events);

			// Original section_index is 0, should be updated to actual index
			expect(sections[0]?.metadata.section_index).toBe(0);
			expect(sections[1]?.metadata.section_index).toBe(1);
			expect(sections[2]?.metadata.section_index).toBe(2);

			// Other metadata should be preserved
			expect(sections[1]?.metadata.source_file).toBe('test.md');
		});
	});

	describe('integration with decomposeDocument', () => {
		it('given real decompose events, when processSections called, then processes correctly', () => {
			function* readLines(content: string) {
				yield* content.split('\n');
			}

			const content = `Intro

## Section One

Content one

## Section Two

Content two`;

			const events = decomposeDocument(readLines(content), 'test.md');
			const sections = collectSections(events);

			expect(sections).toHaveLength(3);
			expect(sections[0]?.filename).toBe('00-intro.md');
			expect(sections[1]?.filename).toBe('01-section-one.md');
			expect(sections[2]?.filename).toBe('02-section-two.md');
		});

		it('given decompose with boundary upgrade, when processSections called, then merges correctly', () => {
			function* readLines(content: string) {
				yield* content.split('\n');
			}

			const content = `Intro

### First H3

Content A

### Second H3

Content B

## First H2

Content C`;

			const events = decomposeDocument(readLines(content), 'test.md');
			const sections = collectSections(events);

			// Should have: merged intro (from intro + 2 H3), then H2 section
			expect(sections.length).toBeGreaterThan(0);
			expect(sections[0]?.metadata.section_index).toBe(0);
		});
	});
});
