import { promises as fs } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { processDocument } from '../../src/core/decompose-docs.js';

describe('processDocument', () => {
	// Use /tmp for test isolation
	const testOutputDir = '/tmp/decompose-test-output';

	beforeEach(async () => {
		// Create fresh test directory
		await fs.mkdir(testOutputDir, { recursive: true });
	});

	afterEach(async () => {
		// Clean up test directory
		try {
			await fs.rm(testOutputDir, { recursive: true, force: true });
		} catch {
			// Cleanup failure is not critical
		}
	});

	describe('file reading and section creation', () => {
		it('given valid markdown file, when processDocument called, then reads file and creates sections', async () => {
			const inputFile = path.join(testOutputDir, 'test-input.md');
			const content = `Intro content here

## Section One

Details for section one

## Section Two

Details for section two`;

			await fs.writeFile(inputFile, content, 'utf-8');

			const sections = await processDocument(inputFile, testOutputDir);

			expect(sections).toHaveLength(3);
			expect(sections[0]?.heading).toBe('intro');
			expect(sections[1]?.heading).toBe('Section One');
			expect(sections[2]?.heading).toBe('Section Two');
		});

		it('given markdown with intro section, when processDocument called, then preserves intro content', async () => {
			const inputFile = path.join(testOutputDir, 'test-input.md');
			const content = `This is the introduction
with multiple lines

## Main Section

Content here`;

			await fs.writeFile(inputFile, content, 'utf-8');

			const sections = await processDocument(inputFile, testOutputDir);

			expect(sections[0]?.content).toContain('This is the introduction');
			expect(sections[0]?.content).toContain('with multiple lines');
		});

		it('given markdown with nested headings, when processDocument called, then keeps nested content with parent', async () => {
			const inputFile = path.join(testOutputDir, 'test-input.md');
			const content = `Intro

## Main Section

Main content

### Subsection

Nested content

## Another Section

More content`;

			await fs.writeFile(inputFile, content, 'utf-8');

			const sections = await processDocument(inputFile, testOutputDir);

			const mainSection = sections.find(s => s.heading === 'Main Section');
			expect(mainSection?.content).toContain('### Subsection');
			expect(mainSection?.content).toContain('Nested content');
		});
	});

	describe('file writing with frontmatter', () => {
		it('given markdown file, when processDocument called, then writes sections to output directory', async () => {
			const inputFile = path.join(testOutputDir, 'test-input.md');
			const content = `Intro

## Section One

Content`;

			await fs.writeFile(inputFile, content, 'utf-8');

			const sections = await processDocument(inputFile, testOutputDir);

			// Check that files were written
			expect(sections).toHaveLength(2);
			const introPath = path.join(testOutputDir, sections[0]?.filename || '');
			expect(
				await fs
					.access(introPath)
					.then(() => true)
					.catch(() => false)
			).toBe(true);
		});

		it('given sections, when processDocument called, then writes files with YAML frontmatter', async () => {
			const inputFile = path.join(testOutputDir, 'test-input.md');
			const content = `Intro text

## First Section

Section content`;

			await fs.writeFile(inputFile, content, 'utf-8');

			const sections = await processDocument(inputFile, testOutputDir);

			const introPath = path.join(testOutputDir, sections[0]?.filename || '');
			const fileContent = await fs.readFile(introPath, 'utf-8');

			// Check for YAML frontmatter markers
			expect(fileContent).toMatch(/^---\n/);
			expect(fileContent).toMatch(/\n---\n/);

			// Check that content is after frontmatter
			const parts = fileContent.split('---');
			expect(parts).toHaveLength(3);
			expect(parts[2]).toContain('Intro text');
		});

		it('given sections, when processDocument called, then frontmatter includes source metadata', async () => {
			const inputFile = path.join(testOutputDir, 'test-input.md');
			const content = `Intro

## Test Section

Content`;

			await fs.writeFile(inputFile, content, 'utf-8');

			const sections = await processDocument(inputFile, testOutputDir);

			const sectionPath = path.join(testOutputDir, sections[1]?.filename || '');
			const fileContent = await fs.readFile(sectionPath, 'utf-8');

			// Extract frontmatter
			const match = fileContent.match(/^---\n([\s\S]*?)\n---/);
			expect(match).toBeTruthy();

			if (match) {
				const frontmatter = match[1];
				expect(frontmatter).toContain('source_file:');
				expect(frontmatter).toContain('source_section:');
				expect(frontmatter).toContain('line_range:');
				expect(frontmatter).toContain('original_heading:');
			}
		});

		it('given sections, when processDocument called, then filename matches section_index pattern', async () => {
			const inputFile = path.join(testOutputDir, 'test-input.md');
			const content = `Intro

## Section One

Content

## Section Two

More`;

			await fs.writeFile(inputFile, content, 'utf-8');

			const sections = await processDocument(inputFile, testOutputDir);

			expect(sections[0]?.filename).toBe('00-intro.md');
			expect(sections[1]?.filename).toMatch(/^01-/);
			expect(sections[2]?.filename).toMatch(/^02-/);
		});
	});

	describe('output directory handling', () => {
		it('given non-existent output directory, when processDocument called, then creates directory', async () => {
			const inputFile = path.join(testOutputDir, 'test-input.md');
			const content = `Intro

## Section

Content`;

			await fs.writeFile(inputFile, content, 'utf-8');

			const nonExistentDir = path.join(testOutputDir, 'nested', 'output', 'dir');

			const sections = await processDocument(inputFile, nonExistentDir);

			expect(sections).toHaveLength(2);
			const dirExists = await fs
				.access(nonExistentDir)
				.then(() => true)
				.catch(() => false);
			expect(dirExists).toBe(true);
		});

		it('given existing output directory, when processDocument called, then writes to existing directory', async () => {
			const inputFile = path.join(testOutputDir, 'test-input.md');
			const content = `Intro

## Section

Content`;

			await fs.writeFile(inputFile, content, 'utf-8');

			const sections = await processDocument(inputFile, testOutputDir);

			expect(sections).toHaveLength(2);
			const introPath = path.join(testOutputDir, sections[0]?.filename || '');
			const exists = await fs
				.access(introPath)
				.then(() => true)
				.catch(() => false);
			expect(exists).toBe(true);
		});
	});

	describe('document reconstruction', () => {
		it('given decomposed sections, when files are created, then can be read back in order', async () => {
			const inputFile = path.join(testOutputDir, 'test-input.md');
			const originalContent = `Intro content

## Section One

Details one

## Section Two

Details two`;

			await fs.writeFile(inputFile, originalContent, 'utf-8');

			const sections = await processDocument(inputFile, testOutputDir);

			// Verify sections were written with correct filenames
			const sortedSections = sections.sort((a, b) => {
				const indexA = a.metadata.section_index ?? 0;
				const indexB = b.metadata.section_index ?? 0;
				return indexA - indexB;
			});

			// Verify all files exist and have content
			for (const section of sortedSections) {
				const filePath = path.join(testOutputDir, section.filename ?? '');
				const fileContent = await fs.readFile(filePath, 'utf-8');

				// File should have frontmatter + content
				expect(fileContent).toMatch(/^---\n/);
				expect(fileContent).toMatch(/\n---\n/);

				// Extract content portion
				const contentMatch = fileContent.match(/^---\n[\s\S]*?\n---\n\n([\s\S]*)$/);
				expect(contentMatch).toBeTruthy();
				if (contentMatch?.[1]) {
					expect(contentMatch[1].trim().length).toBeGreaterThan(0);
				}
			}

			// Verify section ordering
			expect(sortedSections[0]?.filename).toBe('00-intro.md');
			expect(sortedSections[1]?.filename).toMatch(/^01-/);
			expect(sortedSections[2]?.filename).toMatch(/^02-/);
		});
	});

	describe('edge cases', () => {
		it('given file with no boundaries, when processDocument called, then creates single intro section', async () => {
			const inputFile = path.join(testOutputDir, 'test-input.md');
			const content = `Just some content
with no section boundaries
at all`;

			await fs.writeFile(inputFile, content, 'utf-8');

			const sections = await processDocument(inputFile, testOutputDir);

			expect(sections).toHaveLength(1);
			expect(sections[0]?.heading).toBe('intro');
		});

		it('given file starting with section, when processDocument called, then creates empty intro', async () => {
			const inputFile = path.join(testOutputDir, 'test-input.md');
			const content = `## First Section

Content here`;

			await fs.writeFile(inputFile, content, 'utf-8');

			const sections = await processDocument(inputFile, testOutputDir);

			expect(sections[0]?.heading).toBe('intro');
			expect(sections[0]?.content.trim()).toBe('');
		});

		it('given empty file, when processDocument called, then creates no sections', async () => {
			const inputFile = path.join(testOutputDir, 'test-input.md');
			await fs.writeFile(inputFile, '', 'utf-8');

			const sections = await processDocument(inputFile, testOutputDir);

			expect(sections).toHaveLength(0);
		});
	});

	describe('return value', () => {
		it('given processed document, when processDocument returns, then returns array of Sections', async () => {
			const inputFile = path.join(testOutputDir, 'test-input.md');
			const content = `Intro

## Section

Content`;

			await fs.writeFile(inputFile, content, 'utf-8');

			const result = await processDocument(inputFile, testOutputDir);

			expect(Array.isArray(result)).toBe(true);
			expect(result.length).toBeGreaterThan(0);
			expect(result[0]).toHaveProperty('heading');
			expect(result[0]).toHaveProperty('content');
			expect(result[0]).toHaveProperty('metadata');
			expect(result[0]).toHaveProperty('filename');
		});
	});
});
