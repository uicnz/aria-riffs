import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { DecomposerConfig, Section } from '../lib/types.js';

/**
 * Extract sections from markdown content by splitting on header patterns.
 * Generator function yields sections as they are completed.
 *
 * @param lines - Iterable of lines (from file or array)
 * @param config - Decomposer configuration with header_pattern
 * @param sourceFile - Path to source file (for metadata)
 */
export function* extractSections(
	lines: Iterable<string>,
	config: DecomposerConfig,
	sourceFile: string
): Generator<Section> {
	const headerRegex = new RegExp(config.header_pattern);
	let heading = '';
	let content: string[] = [];
	let startLine = 0;
	let sectionIndex = 0;
	let lineNumber = 0;

	for (const line of lines) {
		if (headerRegex.test(line)) {
			// Yield previous section if it exists
			if (heading) {
				yield createSection(heading, content, sourceFile, sectionIndex, startLine, lineNumber - 1);
				sectionIndex++;
			}
			// Start new section with heading as first line of content
			heading = line;
			content = [];
			startLine = lineNumber;
		}
		content.push(line);
		lineNumber++;
	}
	// Yield final section
	if (heading) {
		yield createSection(heading, content, sourceFile, sectionIndex, startLine, lineNumber - 1);
	}
}

/**
 * Generate filename from heading text and section index
 */
function generateFilename(heading: string, sectionIndex: number): string {
	const safeHeading = heading
		.replace(/^#+\s+/, '') // Remove markdown heading markers
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with dashes
		.replace(/^-+|-+$/g, ''); // Trim leading/trailing dashes

	return `${String(sectionIndex).padStart(4, '0')}-${safeHeading}.md`;
}

/**
 * Format metadata as YAML frontmatter
 */
function formatFrontmatter(metadata: {
	source_file: string;
	source_section: string;
	section_index: number;
	line_range: [number, number];
	decomposed_at: string;
}): string {
	return `---
source_file: ${metadata.source_file}
source_section: ${JSON.stringify(metadata.source_section)}
section_index: ${metadata.section_index}
line_range: [${metadata.line_range[0]}, ${metadata.line_range[1]}]
decomposed_at: ${metadata.decomposed_at}
---`;
}

/**
 * Create a section object with metadata, filename, and frontmatter
 */
function createSection(
	heading: string,
	content: string[],
	sourceFile: string,
	sectionIndex: number,
	startLine: number,
	endLine: number
): Section {
	const metadata = {
		source_file: sourceFile,
		source_section: heading,
		section_index: sectionIndex,
		line_range: [startLine, endLine] as [number, number],
		decomposed_at: new Date().toISOString(),
	};

	return {
		heading,
		content: content.join('\n').trimStart().trimEnd(),
		metadata,
		filename: generateFilename(heading, sectionIndex),
		frontmatter: formatFrontmatter(metadata),
	};
}

/**
 * Main decompose function: orchestrates the full decomposition pipeline
 * Reads file, decomposes into sections, optionally writes to disk
 *
 * @param config - Decomposer configuration
 * @param dryRun - If true, don't write files (default: false)
 * @returns Object with sectionCount and array of file paths
 */
export function decompose(
	config: DecomposerConfig,
	dryRun: boolean = false
): { sectionCount: number; files: string[] } {
	const fileContent = readFileSync(config.input_file, 'utf8');
	const lines = fileContent.split('\n');

	const files: string[] = [];
	let sectionCount = 0;

	// Only create output directory if not a dry run
	if (!dryRun) {
		mkdirSync(config.output_directory, { recursive: true });
	}

	// Process each section from the generator
	for (const section of extractSections(lines, config, config.input_file)) {
		const filepath = resolve(config.output_directory, section.filename);
		const content = `${section.frontmatter}\n\n${section.content}\n`;

		if (!dryRun) {
			writeFileSync(filepath, content, 'utf8');
		}

		files.push(filepath);
		sectionCount++;
	}

	return { sectionCount, files };
}
