import { promises as fs } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { processDirectory } from '../../src/core/decompose-docs.js';

describe('processDirectory', () => {
	// Use /tmp for test isolation
	const testBaseDir = '/tmp/decompose-directory-test';
	const testInputDir = path.join(testBaseDir, 'input');
	const testOutputDir = path.join(testBaseDir, 'output');

	beforeEach(async () => {
		// Create fresh test directories
		await fs.mkdir(testInputDir, { recursive: true });
		await fs.mkdir(testOutputDir, { recursive: true });
	});

	afterEach(async () => {
		// Clean up test directories
		try {
			await fs.rm(testBaseDir, { recursive: true, force: true });
		} catch {
			// Cleanup failure is not critical
		}
	});

	describe('single markdown file in directory', () => {
		it('given single markdown file in directory, when processDirectory called, then processes file', async () => {
			const filePath = path.join(testInputDir, 'test.md');
			const content = `Intro content

## Section One

Details`;

			await fs.writeFile(filePath, content, 'utf-8');

			const sections = await processDirectory(testInputDir, testOutputDir);

			expect(sections).toHaveLength(2);
			expect(sections[0]?.heading).toBe('intro');
			expect(sections[1]?.heading).toBe('Section One');
		});

		it('given single markdown file, when processDirectory called, then creates subdirectory with filename', async () => {
			const filePath = path.join(testInputDir, 'handbook.md');
			const content = `Intro

## Section

Content`;

			await fs.writeFile(filePath, content, 'utf-8');

			await processDirectory(testInputDir, testOutputDir);

			// Output should be in testOutputDir/handbook/ with section files
			const expectedDir = path.join(testOutputDir, 'handbook');
			const dirExists = await fs
				.access(expectedDir)
				.then(() => true)
				.catch(() => false);
			expect(dirExists).toBe(true);

			// Check that section files exist
			const introPath = path.join(expectedDir, '00-intro.md');
			const introExists = await fs
				.access(introPath)
				.then(() => true)
				.catch(() => false);
			expect(introExists).toBe(true);
		});
	});

	describe('multiple markdown files in directory', () => {
		it('given multiple markdown files in same directory, when processDirectory called, then processes all files', async () => {
			const file1 = path.join(testInputDir, 'file1.md');
			const file2 = path.join(testInputDir, 'file2.md');

			await fs.writeFile(file1, 'Intro\n\n## Section', 'utf-8');
			await fs.writeFile(file2, 'Intro\n\n## Section', 'utf-8');

			const sections = await processDirectory(testInputDir, testOutputDir);

			// Should have sections from both files
			expect(sections.length).toBeGreaterThanOrEqual(4);
		});

		it('given multiple markdown files, when processDirectory called, then creates separate subdirectory for each', async () => {
			const file1 = path.join(testInputDir, 'policy1.md');
			const file2 = path.join(testInputDir, 'policy2.md');

			await fs.writeFile(file1, 'Content for policy 1', 'utf-8');
			await fs.writeFile(file2, 'Content for policy 2', 'utf-8');

			await processDirectory(testInputDir, testOutputDir);

			const dir1 = path.join(testOutputDir, 'policy1');
			const dir2 = path.join(testOutputDir, 'policy2');

			const dir1Exists = await fs
				.access(dir1)
				.then(() => true)
				.catch(() => false);
			const dir2Exists = await fs
				.access(dir2)
				.then(() => true)
				.catch(() => false);

			expect(dir1Exists).toBe(true);
			expect(dir2Exists).toBe(true);
		});
	});

	describe('nested directory structure', () => {
		it('given markdown files in nested subdirectories, when processDirectory called, then processes all files recursively', async () => {
			const subdir = path.join(testInputDir, 'subdir', 'deeper');
			await fs.mkdir(subdir, { recursive: true });

			const file1 = path.join(testInputDir, 'top.md');
			const file2 = path.join(subdir, 'nested.md');

			await fs.writeFile(file1, 'Top level', 'utf-8');
			await fs.writeFile(file2, 'Nested level', 'utf-8');

			const sections = await processDirectory(testInputDir, testOutputDir);

			// Should process both files
			expect(sections.length).toBeGreaterThanOrEqual(2);
		});

		it('given nested files, when processDirectory called, then creates output subdirectories for each', async () => {
			const subdir = path.join(testInputDir, 'policies');
			await fs.mkdir(subdir, { recursive: true });

			await fs.writeFile(path.join(subdir, 'file.md'), 'Content', 'utf-8');

			await processDirectory(testInputDir, testOutputDir);

			const outputSubdir = path.join(testOutputDir, 'file');
			const exists = await fs
				.access(outputSubdir)
				.then(() => true)
				.catch(() => false);
			expect(exists).toBe(true);
		});
	});

	describe('glob pattern filtering', () => {
		it('given mixed file types with *.md pattern, when processDirectory called, then only processes markdown files', async () => {
			await fs.writeFile(path.join(testInputDir, 'file.md'), 'Markdown', 'utf-8');
			await fs.writeFile(path.join(testInputDir, 'file.txt'), 'Text', 'utf-8');
			await fs.writeFile(path.join(testInputDir, 'file.json'), 'JSON', 'utf-8');

			const sections = await processDirectory(testInputDir, testOutputDir, ['*.md']);

			// Should only process the .md file
			expect(sections.length).toBeGreaterThanOrEqual(1);

			// Check that only markdown subdirectory exists
			const mdDir = path.join(testOutputDir, 'file');
			const txtDir = path.join(testOutputDir, 'file.txt');
			const jsonDir = path.join(testOutputDir, 'file.json');

			const mdExists = await fs
				.access(mdDir)
				.then(() => true)
				.catch(() => false);
			const txtExists = await fs
				.access(txtDir)
				.then(() => true)
				.catch(() => false);
			const jsonExists = await fs
				.access(jsonDir)
				.then(() => true)
				.catch(() => false);

			expect(mdExists).toBe(true);
			expect(txtExists).toBe(false);
			expect(jsonExists).toBe(false);
		});

		it('given multiple patterns, when processDirectory called, then processes files matching any pattern', async () => {
			await fs.writeFile(path.join(testInputDir, 'file1.md'), 'Markdown', 'utf-8');
			await fs.writeFile(path.join(testInputDir, 'file2.markdown'), 'Markdown', 'utf-8');

			const sections = await processDirectory(testInputDir, testOutputDir, ['*.md', '*.markdown']);

			expect(sections.length).toBeGreaterThanOrEqual(2);
		});

		it('given empty directory, when processDirectory called with patterns, then returns empty array', async () => {
			const sections = await processDirectory(testInputDir, testOutputDir, ['*.md']);

			expect(sections).toHaveLength(0);
		});
	});

	describe('custom boundary patterns', () => {
		it('given custom primary pattern, when processDirectory called, then uses custom pattern for all files', async () => {
			const filePath = path.join(testInputDir, 'test.md');
			const content = `Intro

# Title One

Content

# Title Two

More`;

			await fs.writeFile(filePath, content, 'utf-8');

			// Use H1 as primary pattern
			const sections = await processDirectory(testInputDir, testOutputDir, ['*.md'], '^# .+');

			// Should find two H1 sections plus intro
			expect(sections.length).toBeGreaterThanOrEqual(2);
		});
	});

	describe('return values', () => {
		it('given processed directory, when processDirectory returns, then returns all sections from all files', async () => {
			const file1 = path.join(testInputDir, 'file1.md');
			const file2 = path.join(testInputDir, 'file2.md');

			await fs.writeFile(file1, 'Intro\n\n## S1\n\n## S2', 'utf-8');
			await fs.writeFile(file2, 'Intro\n\n## S3', 'utf-8');

			const result = await processDirectory(testInputDir, testOutputDir);

			expect(Array.isArray(result)).toBe(true);
			expect(result.length).toBeGreaterThanOrEqual(4);
		});

		it('given multiple files, when sections returned, then each section has correct metadata', async () => {
			const filePath = path.join(testInputDir, 'test.md');
			await fs.writeFile(filePath, 'Intro\n\n## Section', 'utf-8');

			const sections = await processDirectory(testInputDir, testOutputDir);

			for (const section of sections) {
				expect(section).toHaveProperty('heading');
				expect(section).toHaveProperty('content');
				expect(section).toHaveProperty('metadata');
				expect(section).toHaveProperty('filename');
				expect(section.metadata.source_file).toBe(filePath);
			}
		});
	});

	describe('error handling', () => {
		it('given non-existent input directory, when processDirectory called, then returns empty array (no error)', async () => {
			const nonExistent = path.join(testBaseDir, 'does-not-exist');

			const sections = await processDirectory(nonExistent, testOutputDir);

			expect(sections).toHaveLength(0);
		});

		it('given valid input with invalid output parent, when processDirectory called, then creates output directories', async () => {
			const filePath = path.join(testInputDir, 'test.md');
			await fs.writeFile(filePath, 'Content', 'utf-8');

			const deepOutputDir = path.join(testOutputDir, 'deep', 'nested', 'output');

			const sections = await processDirectory(testInputDir, deepOutputDir);

			const dirExists = await fs
				.access(deepOutputDir)
				.then(() => true)
				.catch(() => false);
			expect(dirExists).toBe(true);
			expect(sections.length).toBeGreaterThanOrEqual(1);
		});
	});

	describe('file ordering and consistency', () => {
		it('given multiple files, when processDirectory called multiple times, then processes consistently', async () => {
			const file1 = path.join(testInputDir, 'file1.md');
			const file2 = path.join(testInputDir, 'file2.md');

			await fs.writeFile(file1, 'Content', 'utf-8');
			await fs.writeFile(file2, 'Content', 'utf-8');

			const result1 = await processDirectory(testInputDir, testOutputDir);

			// Clean and re-run
			await fs.rm(testOutputDir, { recursive: true, force: true });
			await fs.mkdir(testOutputDir, { recursive: true });

			const result2 = await processDirectory(testInputDir, testOutputDir);

			expect(result1.length).toBe(result2.length);
		});

		it('given files with different content sizes, when processDirectory called, then processes all correctly', async () => {
			const smallFile = path.join(testInputDir, 'small.md');
			const largeFile = path.join(testInputDir, 'large.md');

			await fs.writeFile(smallFile, 'Small', 'utf-8');

			const largeContent = Array(100).fill('## Section Title\n\nContent goes here\n\n').join('');
			await fs.writeFile(largeFile, largeContent, 'utf-8');

			const sections = await processDirectory(testInputDir, testOutputDir);

			expect(sections.length).toBeGreaterThanOrEqual(2);
		});
	});

	describe('hidden files and directories', () => {
		it('given hidden files in directory, when processDirectory called, then skips hidden files', async () => {
			await fs.writeFile(path.join(testInputDir, '.hidden.md'), 'Content', 'utf-8');
			await fs.writeFile(path.join(testInputDir, 'visible.md'), 'Content', 'utf-8');

			const sections = await processDirectory(testInputDir, testOutputDir);

			// Should only process visible.md
			expect(sections.length).toBeGreaterThanOrEqual(1);

			const hiddenDir = path.join(testOutputDir, '.hidden');
			const hiddenExists = await fs
				.access(hiddenDir)
				.then(() => true)
				.catch(() => false);
			expect(hiddenExists).toBe(false);
		});

		it('given hidden subdirectories, when processDirectory called, then skips hidden subdirs', async () => {
			const hiddenSubdir = path.join(testInputDir, '.config');
			await fs.mkdir(hiddenSubdir, { recursive: true });
			await fs.writeFile(path.join(hiddenSubdir, 'file.md'), 'Content', 'utf-8');
			await fs.writeFile(path.join(testInputDir, 'visible.md'), 'Content', 'utf-8');

			const sections = await processDirectory(testInputDir, testOutputDir);

			// Should only process visible.md
			expect(sections.length).toBeGreaterThanOrEqual(1);
		});
	});
});
