import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import yaml from 'yaml';
import { decompose } from '../../src/core/decompose.js';
import type { DecomposerConfig } from '../../src/lib/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('decompose integration tests', () => {
	// Fixtures
	const testOutputDir = '/tmp/hr-staffer-decompose-test';
	const fixtureFile = path.resolve(__dirname, '../fixtures/org-chart.md');
	const defaultConfig: DecomposerConfig = {
		input_file: fixtureFile,
		output_directory: testOutputDir,
		header_pattern: '^#{1,6} .+',
	};

	beforeEach(() => {
		// Ensure clean state
		rmSync(testOutputDir, { recursive: true, force: true });
		mkdirSync(testOutputDir, { recursive: true });
	});

	afterEach(() => {
		rmSync(testOutputDir, { recursive: true, force: true });
	});

	it('given real org-chart.md file, when decompose called, then reads file and returns section count and files', () => {
		const result = decompose(defaultConfig, false);

		expect(result.sectionCount).toBeGreaterThan(0);
		expect(result.files).toHaveLength(result.sectionCount);
	});

	it('given dryRun=true, when decompose called, then returns paths without writing files to disk', () => {
		const result = decompose(defaultConfig, true);

		expect(result.sectionCount).toBeGreaterThan(0);
		expect(result.files).toHaveLength(result.sectionCount);
		// Verify no files were actually written (directory should be empty)
		const files = readdirSync(testOutputDir);
		expect(files).toHaveLength(0);
	});

	it('given decompose writes files, when reading written file, then contains valid YAML frontmatter', () => {
		const result = decompose(defaultConfig, false);

		// Read the first file and verify frontmatter
		const fileContent = readFileSync(result.files[0], 'utf8');

		// Extract frontmatter between --- delimiters
		const frontmatterMatch = fileContent.match(/^---\n([\s\S]*?)\n---/);
		expect(frontmatterMatch).not.toBeNull();

		// Parse as YAML - should not throw
		const frontmatter = yaml.parse(frontmatterMatch![1]);

		// Verify required fields
		expect(frontmatter).toHaveProperty('source_file');
		expect(frontmatter).toHaveProperty('source_section');
		expect(frontmatter).toHaveProperty('section_index');
		expect(frontmatter).toHaveProperty('line_range');
		expect(frontmatter).toHaveProperty('decomposed_at');
	});

	it('given decompose writes files, when reading written file, then contains heading and content after frontmatter', () => {
		const result = decompose(defaultConfig, false);

		// Read the first file
		const fileContent = readFileSync(result.files[0], 'utf8');

		// Parse YAML frontmatter to get source_section (the heading)
		const frontmatterMatch = fileContent.match(/^---\n([\s\S]*?)\n---/);
		const frontmatter = yaml.parse(frontmatterMatch![1]);
		const expectedHeading = frontmatter.source_section;

		// Content after frontmatter should contain the heading
		const contentAfterFrontmatter = fileContent.replace(/^---\n[\s\S]*?\n---\n+/, '');

		// First line after frontmatter should be the heading
		const firstLine = contentAfterFrontmatter.split('\n')[0];
		expect(firstLine).toBe(expectedHeading);

		// There should be content after the heading (at least one more line with content or empty)
		const lines = contentAfterFrontmatter.split('\n');
		expect(lines.length).toBeGreaterThan(1);
	});

	it('given decompose writes files, when checking returned file paths, then all files exist on disk', () => {
		const result = decompose(defaultConfig, false);

		// Every file path returned should exist
		for (const filePath of result.files) {
			expect(existsSync(filePath)).toBe(true);
		}

		// Number of files on disk should match returned count
		const filesOnDisk = readdirSync(testOutputDir);
		expect(filesOnDisk).toHaveLength(result.sectionCount);
	});
});
