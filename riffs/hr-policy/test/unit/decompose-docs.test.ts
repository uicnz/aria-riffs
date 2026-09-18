import { describe, expect, it } from 'vitest';
import { decomposeDocument } from '../../src/core/decompose-docs.js';
import type { DecomposeEvent } from '../../src/lib/types.js';

describe('decomposeDocument', () => {
	/**
	 * Helper to collect all events from generator
	 */
	function* readLines(content: string) {
		yield* content.split('\n');
	}

	function collectEvents(content: string, sourceFile: string = 'test.md'): DecomposeEvent[] {
		const events: DecomposeEvent[] = [];
		for (const event of decomposeDocument(readLines(content), sourceFile)) {
			events.push(event);
		}
		return events;
	}

	describe('basic generator behavior', () => {
		it('given empty content, when decomposeDocument called, then yields nothing', () => {
			const events = collectEvents('');
			expect(events).toHaveLength(0);
		});

		it('given single line with no boundaries, when decomposeDocument called, then yields intro section', () => {
			const content = 'Just some content.';
			const events = collectEvents(content);

			expect(events).toHaveLength(1);
			expect(events[0]?.section.content).toContain('Just some content');
			expect(events[0]?.boundaryChange).toBe(false);
		});

		it('given multiline content with no boundaries, when decomposeDocument called, then yields single intro section', () => {
			const content = `Line 1
Line 2
Line 3`;
			const events = collectEvents(content);

			expect(events).toHaveLength(1);
		});
	});

	describe('primary boundary detection', () => {
		it('given content with H2 boundaries, when decomposeDocument called, then detects primary boundaries', () => {
			const content = `Intro content

## Health Insurance

Insurance details

## Retirement Plans

Retirement details`;
			const events = collectEvents(content);
			expect(events).toHaveLength(3);
			expect(events[0]?.section.metadata.source_section).toBe('intro');
			expect(events[1]?.section.metadata.source_section).toBe('Health Insurance');
			expect(events[2]?.section.metadata.source_section).toBe('Retirement Plans');
		});

		it('given H2 boundaries, when decomposeDocument called, then creates sections in correct order', () => {
			const content = `Intro

## Health Insurance

Details

## Retirement Plans

Details`;
			const events = collectEvents(content);

			expect(events).toHaveLength(3);
			expect(events[0]?.section.metadata.source_section).toBe('intro');
			expect(events[1]?.section.metadata.source_section).toBe('Health Insurance');
			expect(events[2]?.section.metadata.source_section).toBe('Retirement Plans');
		});

		it('given H2 boundaries with special characters, when decomposeDocument called, then stores original heading', () => {
			const content = `Intro

## FAQ: What's the 401(k) match?

Details`;
			const events = collectEvents(content);

			expect(events[1]?.section.metadata.original_heading).toBe("## FAQ: What's the 401(k) match?");
		});
	});

	describe('fallback boundary detection', () => {
		it('given no H2 boundaries but H3 present, when decomposeDocument called, then detects fallback (H3) boundaries', () => {
			const content = `Intro content

### First Subsection

Content A

### Second Subsection

Content B`;
			const events = collectEvents(content);

			expect(events).toHaveLength(3);
			expect(events[0]?.section.metadata.source_section).toBe('intro');
			expect(events[1]?.section.metadata.source_section).toBe('First Subsection');
			expect(events[2]?.section.metadata.source_section).toBe('Second Subsection');
		});

		it('given only H3 boundaries, when decomposeDocument called, then creates sections from H3', () => {
			const content = `Intro

### Overview

Content

### Details

More`;
			const events = collectEvents(content);

			expect(events).toHaveLength(3);
			expect(events[0]?.section.metadata.source_section).toBe('intro');
			expect(events[1]?.section.metadata.source_section).toBe('Overview');
			expect(events[2]?.section.metadata.source_section).toBe('Details');
		});
	});

	describe('boundary upgrade (fallback to primary)', () => {
		it('given H3 first then H2 appears, when decomposeDocument called, then emits boundaryChange event on upgrade', () => {
			const content = `Intro

### First H3

Content

## Upgraded to H2

Content`;
			const events = collectEvents(content);
			expect(events).toHaveLength(3);
			expect(events[0]?.section.metadata.source_section).toBe('intro');
			expect(events[1]?.section.metadata.source_section).toBe('First H3');
			expect(events[1]?.boundaryChange).toBe(true);
			expect(events[2]?.section.metadata.source_section).toBe('Upgraded to H2');
			expect(events[2]?.boundaryChange).toBe(false);
		});

		it('given boundary upgrade, when decomposeDocument called, then fallback sections marked correctly', () => {
			const content = `Intro

### First H3

Content

### Second H3

Content

## Now H2

Content`;
			const events = collectEvents(content);

			expect(events).toHaveLength(4);
			expect(events[0]?.section.metadata.source_section).toBe('intro');
			expect(events[1]?.section.metadata.source_section).toBe('First H3');
			expect(events[1]?.boundaryChange).toBe(false);
			expect(events[2]?.section.metadata.source_section).toBe('Second H3');
			expect(events[2]?.boundaryChange).toBe(true);
			expect(events[3]?.section.metadata.source_section).toBe('Now H2');
			expect(events[3]?.boundaryChange).toBe(false);
		});

		it('given only H2 boundaries (no upgrade), when decomposeDocument called, then no boundaryChange events', () => {
			const content = `Intro

## First

Content

## Second

Content`;
			const events = collectEvents(content);

			const upgradeEvents = events.filter(e => e.boundaryChange === true);
			expect(upgradeEvents).toHaveLength(0);
		});
	});

	describe('metadata generation', () => {
		it('given intro section, when decomposeDocument called, then metadata has correct values', () => {
			const content = `Line 1
Line 2

## First Section

Details`;
			const events = collectEvents(content, 'sources/handbook.md');

			const introEvent = events[0];
			expect(introEvent?.section.metadata.source_file).toBe('sources/handbook.md');
			expect(introEvent?.section.metadata.original_heading).toBe('');
			expect(introEvent?.section.metadata.source_section).toBe('intro');
		});

		it('given section with boundary, when decomposeDocument called, then metadata includes heading', () => {
			const content = `Intro

## Health Insurance

Details`;
			const events = collectEvents(content, 'handbook.md');

			const sectionEvent = events[1];
			expect(sectionEvent?.section.metadata.original_heading).toBe('## Health Insurance');
			expect(sectionEvent?.section.metadata.source_section).toBe('Health Insurance');
		});

		it('given sections, when decomposeDocument called, then metadata includes line ranges', () => {
			const content = `Intro line
More intro

## Section One

Content

## Section Two

Content`;
			const events = collectEvents(content);

			events.forEach(event => {
				expect(event.section.metadata.line_range).toBeDefined();
				expect(event.section.metadata.line_range[0]).toBeGreaterThanOrEqual(1);
				expect(event.section.metadata.line_range[1]).toBeGreaterThanOrEqual(
					event.section.metadata.line_range[0]
				);
			});
		});

		it('given decomposed document, when metadata checked, then decomposed_at is valid ISO timestamp', () => {
			const content = 'Intro';
			const events = collectEvents(content);

			events.forEach(event => {
				const timestamp = event.section.metadata.decomposed_at;
				expect(timestamp).toBeDefined();
				expect(() => new Date(timestamp)).not.toThrow();
			});
		});

		it('given intro section with H1 heading, when decomposeDocument called, then H1 is stored as original_heading', () => {
			const content = `# Document Title

Some intro content

## First Section

Details`;
			const events = collectEvents(content);

			const introEvent = events[0];
			expect(introEvent?.section.metadata.original_heading).toBe('# Document Title');
		});

		it('given intro section with H1 heading, when decomposeDocument called, then source_section contains H1 text without prefix', () => {
			const content = `# Document Title

Some intro content

## First Section

Details`;
			const events = collectEvents(content);

			const introEvent = events[0];
			expect(introEvent?.section.metadata.source_section).toBe('Document Title');
		});

		it('given intro section with no H1 heading, when decomposeDocument called, then original_heading is empty string', () => {
			const content = `Some intro content

## First Section

Details`;
			const events = collectEvents(content);

			const introEvent = events[0];
			expect(introEvent?.section.metadata.original_heading).toBe('');
		});

		it('given intro section with no H1 heading, when decomposeDocument called, then source_section is intro', () => {
			const content = `Some intro content

## First Section

Details`;
			const events = collectEvents(content);

			const introEvent = events[0];
			expect(introEvent?.section.metadata.source_section).toBe('intro');
		});
	});

	describe('content extraction', () => {
		it('given content with intro and sections, when decomposeDocument called, then each section contains correct content', () => {
			const content = `This is intro

## Section One

Content for section one

## Section Two

Content for section two`;
			const events = collectEvents(content);

			const introContent = events[0]?.section.content;
			expect(introContent).toContain('This is intro');

			const section1 = events.find(e => e.section.metadata.source_section === 'Section One');
			expect(section1?.section.content).toContain('Content for section one');
		});

		it('given nested headings, when decomposeDocument called, then nested content stays with parent section', () => {
			const content = `Intro

## Main Section

Main content

### Nested Subsection

Nested content

## Another Section

Other`;
			const events = collectEvents(content);

			const mainSection = events.find(e => e.section.metadata.source_section === 'Main Section');
			expect(mainSection?.section.content).toContain('### Nested Subsection');
			expect(mainSection?.section.content).toContain('Nested content');
		});

		it('given empty intro (section starts immediately), when decomposeDocument called, then intro section has empty content', () => {
			const content = `## First Section

Content`;
			const events = collectEvents(content);

			const introEvent = events[0];
			expect(introEvent?.section.metadata.source_section).toBe('intro');
			expect(introEvent?.section.content.trim()).toBe('');
		});
	});

	describe('custom boundary patterns', () => {
		it('given custom primary pattern, when decomposeDocument called with pattern, then uses custom pattern', () => {
			const content = `Intro

### Custom Primary

Content

### Another Custom

More`;
			const events = Array.from(decomposeDocument(readLines(content), 'test.md', '^### .+', '^#### .+'));

			expect(events.length).toBeGreaterThan(1);
		});

		it('given custom fallback pattern, when decomposeDocument called with pattern, then uses custom fallback', () => {
			const content = `Intro

#### Fallback Level

Content`;
			const events = Array.from(decomposeDocument(readLines(content), 'test.md', '^### .+', '^#### .+'));

			expect(events[0]?.section.metadata.original_heading).toBe('');
			expect(events[1]?.section.metadata.original_heading).toBe('#### Fallback Level');
		});
	});

	describe('edge cases', () => {
		it('given duplicate heading names, when decomposeDocument called, then sections created in order', () => {
			const content = `Intro

## Overview

First overview

## Overview

Second overview`;
			const events = collectEvents(content);

			const sections = events.map(e => e.section.metadata.source_section);
			expect(sections[1]).toBe('Overview');
			expect(sections[2]).toBe('Overview');
		});

		it('given empty section (heading with no content before next boundary), when decomposeDocument called, then preserves empty section', () => {
			const content = `Intro

## Section One

## Section Two

Content`;
			const events = collectEvents(content);

			const section1 = events.find(e => e.section.metadata.source_section === 'Section One');
			expect(section1).toBeDefined();
		});
	});
});
