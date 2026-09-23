/**
 * Document decomposer - streaming generator that decomposes markdown documents
 * into smaller, indexed segments using lazy boundary detection and a state machine
 * with one-way latch upgrade from fallback to primary boundaries.
 *
 * PUBLIC API: decomposeDocument (only export)
 * PRIVATE: All helper functions
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { stringify as yamlStringify } from 'yaml';
import type { BoundaryType, DecomposeEvent, Section, SectionMetadata } from '../lib/types.js';

type State = 'undetected' | 'primary' | 'fallback';

/**
 * Extract plain text from markdown heading, removing # prefix
 */
function extractHeadingText(heading: string): string {
	return heading.replace(/^#+\s+/, '').trim();
}

/**
 * Find H1 heading in content lines, return full heading or empty string if not found
 */
function findH1Heading(lines: string[]): string {
	const h1Regex = /^# .+/;
	for (const line of lines) {
		if (h1Regex.test(line)) {
			return line;
		}
	}
	return '';
}

/**
 * Create metadata for a section
 */
function createMetadata(
	sourceFile: string,
	heading: string,
	originalHeading: string,
	startLineNumber: number,
	endLineNumber: number,
	boundaryType: BoundaryType = 'primary'
): SectionMetadata {
	return {
		source_file: sourceFile,
		source_section: heading,
		section_index: -1,
		line_range: [startLineNumber, endLineNumber],
		decomposed_at: new Date().toISOString(),
		original_heading: originalHeading,
		boundary_type: boundaryType,
	};
}

/**
 * Create a Section object with metadata
 * For intro sections (headingLine === 'intro'), extracts H1 heading if present
 * and uses the H1 text for source_section
 */
function createSection(
	content: string[],
	headingLine: string,
	sourceFile: string,
	startLineNumber: number,
	endLineNumber: number,
	boundaryType: BoundaryType = 'primary'
): Section {
	let heading = extractHeadingText(headingLine);
	let originalHeading = headingLine;

	// For intro sections, try to find H1 heading in content
	if (headingLine === 'intro') {
		const h1 = findH1Heading(content);
		originalHeading = h1; // Will be empty string if not found
		// Use H1 text for source_section if present
		if (h1) {
			heading = extractHeadingText(h1);
		}
	}

	const metadata = createMetadata(sourceFile, heading, originalHeading, startLineNumber, endLineNumber, boundaryType);
	return { heading, content: content.join('\n'), metadata };
}

/**
 * Generate kebab-case filename from heading text
 * For section 0 (intro), uses H1 heading text if available, otherwise falls back to 'intro'
 */
function generateFilename(heading: string, sectionIndex: number, h1Heading?: string): string {
	let textToUse = heading;

	// For intro section, prefer H1 heading if available
	if (sectionIndex === 0 && h1Heading) {
		textToUse = extractHeadingText(h1Heading);
	}

	const kebab = textToUse
		.toLowerCase()
		.replace(/[^\w\s-]/g, '') // Remove special chars except word chars, spaces, dashes
		.replace(/\s+/g, '-') // Replace spaces with dashes
		.replace(/-+/g, '-') // Collapse consecutive dashes
		.replace(/^-+|-+$/g, ''); // Trim leading/trailing dashes

	const paddedIndex = sectionIndex.toString().padStart(2, '0');
	return `${paddedIndex}-${kebab || 'intro'}.md`;
}

/**
 * Merge multiple sections into a single intro section
 * Used when fallback sections need to be coalesced during boundary upgrade
 * Extracts H1 heading if present for original_heading and source_section
 */
function mergeIntoIntro(sections: Section[]): Section {
	if (sections.length === 0) {
		throw new Error('Cannot merge empty sections array');
	}

	const mergedContent = sections.map(s => s.content).join('\n\n');
	const startLine = Math.min(...sections.map(s => s.metadata.line_range[0]));
	const endLine = Math.max(...sections.map(s => s.metadata.line_range[1]));

	// Find H1 heading in merged content, if present
	const contentLines = mergedContent.split('\n');
	const h1Heading = findH1Heading(contentLines);
	// Use H1 text for source_section if present, otherwise 'intro'
	const sourceSection = h1Heading ? extractHeadingText(h1Heading) : 'intro';

	// biome-ignore lint/style/noNonNullAssertion: Already checked length > 0
	const firstSection = sections[0]!;
	const merged: Section = {
		heading: 'intro',
		content: mergedContent,
		metadata: {
			...firstSection.metadata,
			source_section: sourceSection,
			line_range: [startLine, endLine],
			original_heading: h1Heading,
		},
		filename: '',
	};

	return merged;
}

/**
 * Consumer/transformer for DecomposeEvent stream
 * Converts event stream to numbered, processed sections
 *
 * Behavior:
 * - Primary boundaries: emit immediately (streaming mode)
 * - Fallback boundaries: accumulate until boundary change or end
 * - On boundary upgrade: merge all accumulated fallback sections into intro
 * - Assign final section numbers and generate filenames
 *
 * @param events - Iterable of DecomposeEvent from decomposeDocument
 * @yields Section with assigned section_index and filename
 */
export function* processSections(events: Iterable<DecomposeEvent>): Generator<Section> {
	let accumulated: Section[] = [];
	let nextIndex = 0;

	for (const event of events) {
		if (event.boundaryChange) {
			// Upgrade detected: merge all accumulated fallback sections (including this one)
			accumulated.push(event.section);

			const merged = mergeIntoIntro(accumulated);
			merged.metadata.section_index = 0;
			merged.filename = generateFilename(merged.heading, 0, merged.metadata.original_heading);
			yield merged;

			// Reset for primary sections
			accumulated = [];
			nextIndex = 1;
		} else if (event.boundaryType === 'primary') {
			// Primary boundary - emit immediately
			event.section.metadata.section_index = nextIndex;
			event.section.filename = generateFilename(
				event.section.heading,
				nextIndex,
				event.section.metadata.original_heading
			);
			yield event.section;
			nextIndex += 1;
		} else {
			// Fallback boundary - accumulate
			accumulated.push(event.section);
		}
	}

	// End of stream - emit all remaining accumulated sections
	for (const section of accumulated) {
		section.metadata.section_index = nextIndex;
		section.filename = generateFilename(section.heading, nextIndex, section.metadata.original_heading);
		yield section;
		nextIndex += 1;
	}
}

/**
 * Main public API: Generator function that decomposes markdown documents
 * into sections with metadata, using streaming processing and lazy boundary detection.
 *
 * @param content - Iterable of lines (can be from file, array, stream, etc)
 * @param sourceFile - Source file path for metadata tracking
 * @param primaryPattern - Regex pattern for primary boundaries (default: H2 headings)
 * @param fallbackPattern - Regex pattern for fallback boundaries (default: H3 headings)
 * @yields DecomposeEvent containing section and boundaryChange flag
 */
export function* decomposeDocument(
	content: Iterable<string>,
	sourceFile: string,
	primaryPattern: string = '^## .+',
	fallbackPattern: string = '^### .+'
): Generator<DecomposeEvent> {
	const primaryRegex = new RegExp(primaryPattern);
	const fallbackRegex = new RegExp(fallbackPattern);

	let state: State = 'undetected';
	let lines: string[] = [];
	let heading: string = 'intro'; // from start of file to first boundary we call this section 'intro'
	let lineNumber = 0;
	let startLine = 1;

	function startNewSection(boundaryLine: string, isUpgrade: boolean = false): DecomposeEvent {
		// Determine boundaryType: 'primary' if in primary state, 'fallback' otherwise
		const boundaryType: BoundaryType = state === 'primary' ? 'primary' : 'fallback';
		const section = createSection(lines, heading, sourceFile, startLine, lineNumber - 1, boundaryType);
		// Reset for next section
		lines = [boundaryLine];
		heading = boundaryLine;
		startLine = lineNumber;
		return { section, boundaryChange: isUpgrade, boundaryType };
	}

	/*
    Process the content as a stream of lines.
    We implement a state machine with three states: undetected, primary, fallback.

    1. Undetected: No boundary seen yet.
        If we see the primary boundary, switch to primary state.
        If we see the fallback boundary, switch to fallback state.
        Otherwise, accumulate content.
    2. Primary: We have seen a primary boundary, so we have committed to using this as boundary.
        If we see another primary boundary, start a new section.
        Otherwise, accumulate content.
    3. Fallback: We have seen a fallback boundary, so we are using fallback boundaries for now.
        If we see a primary boundary, we upgrade to primary state (one-way latch) and start a new section marked as upgraded.
        If we see another fallback boundary, start a new section.
        Otherwise, accumulate content.

    The one-way latch upgrade allows sections to be reclassified from fallback to primary
    if a primary boundary is encountered later in the document.
    */
	for (const line of content) {
		lineNumber += 1;

		switch (state) {
			case 'undetected': {
				if (primaryRegex.test(line)) {
					state = 'primary';
					yield startNewSection(line);
					break;
				}
				if (fallbackRegex.test(line)) {
					state = 'fallback';
					yield startNewSection(line);
					break;
				}
				// Default: accumulate content
				lines.push(line);
				break;
			}

			case 'primary': {
				if (primaryRegex.test(line)) {
					yield startNewSection(line);
					break;
				}
				lines.push(line);
				break;
			}

			case 'fallback': {
				if (primaryRegex.test(line)) {
					// UPGRADE: Fallback -> Primary (one-way latch)
					state = 'primary';
					yield startNewSection(line, true);
					break;
				}
				if (fallbackRegex.test(line)) {
					yield startNewSection(line);
					break;
				}
				lines.push(line);
				break;
			}
		}
	}

	// Emit final section if there's content
	const hasContent = lines.some(line => line.trim().length > 0);
	if (hasContent) {
		const boundaryType: BoundaryType = state === 'primary' ? 'primary' : 'fallback';
		const section = createSection(lines, heading, sourceFile, startLine, lineNumber, boundaryType);
		yield { section, boundaryChange: false, boundaryType };
	}
}

/**
 * Process a markdown document from file to decomposed sections with file output
 *
 * Orchestrates:
 * 1. Read file from disk
 * 2. Create line iterator
 * 3. Process through decomposeDocument generator
 * 4. Transform through processSections
 * 5. Write sections to output directory with YAML frontmatter
 *
 * @param inputFilePath - Path to input markdown file
 * @param outputDir - Directory where decomposed sections will be written
 * @param primaryPattern - Optional regex pattern for primary boundaries (default: H2)
 * @param fallbackPattern - Optional regex pattern for fallback boundaries (default: H3)
 * @returns Array of Section objects with assigned filenames
 */
export async function processDocument(
	inputFilePath: string,
	outputDir: string,
	primaryPattern: string = '^## .+',
	fallbackPattern: string = '^### .+'
): Promise<Section[]> {
	// Read file content
	const content = await fs.readFile(inputFilePath, 'utf-8');

	// Get relative path for metadata
	const sourceFile = inputFilePath;

	// Create line iterator
	function* readLines() {
		yield* content.split('\n');
	}

	// Process: generator → transformer
	const events = decomposeDocument(readLines(), sourceFile, primaryPattern, fallbackPattern);
	const sections: Section[] = Array.from(processSections(events));

	// Create output directory if needed
	await fs.mkdir(outputDir, { recursive: true });

	// Write sections to files
	for (const section of sections) {
		const filename = section.filename ?? '00-intro.md';
		const filePath = path.join(outputDir, filename);

		// Generate YAML frontmatter
		const frontmatter = yamlStringify(section.metadata, {
			lineWidth: 0,
		});

		// Combine frontmatter + content
		const fileContent = `---\n${frontmatter}---\n\n${section.content}`;

		await fs.writeFile(filePath, fileContent, 'utf-8');
	}

	return sections;
}

/**
 * Recursively walk directory tree yielding markdown file paths
 * Filters by glob patterns (e.g., '*.md', '**\/*.md')
 *
 * @param dir - Directory to walk
 * @param patterns - Glob patterns to match
 * @yields Full paths to matching markdown files
 */
async function* walkDirectory(dir: string, patterns: string[]): AsyncGenerator<string> {
	// Simple pattern matching: check if filename or relative path matches patterns
	const matchesPattern = (filepath: string): boolean => {
		const filename = path.basename(filepath);
		for (const pattern of patterns) {
			// Handle simple patterns like '*.md'
			if (pattern.includes('*')) {
				const regex = new RegExp(`^${pattern.replace(/\*/g, '.*')}$`);
				if (regex.test(filename)) return true;
				// Also check relative path for patterns like '**/*.md'
				const relPath = filepath.split(dir)[1] || '';
				if (regex.test(relPath)) return true;
			} else if (filename === pattern) {
				return true;
			}
		}
		return false;
	};

	try {
		const entries = await fs.readdir(dir, { withFileTypes: true });

		for (const entry of entries) {
			// Skip hidden files and directories
			if (entry.name.startsWith('.')) continue;

			const fullPath = path.join(dir, entry.name);

			if (entry.isDirectory()) {
				yield* walkDirectory(fullPath, patterns);
			} else if (entry.isFile() && matchesPattern(fullPath)) {
				yield fullPath;
			}
		}
	} catch {
		// Directory doesn't exist or isn't readable, skip silently
	}
}

/**
 * Process all markdown files in a directory
 *
 * Orchestrates:
 * 1. Walk input directory recursively
 * 2. Filter files matching glob patterns
 * 3. For each file, call processDocument
 * 4. Create subdirectory in output for each input file
 * 5. Return all sections from all files
 *
 * @param inputDir - Input directory to scan for markdown files
 * @param outputDir - Output directory (will create subdirs for each file)
 * @param patterns - Glob patterns to match files (e.g., ['*.md', '**\/*.md'])
 * @param primaryPattern - Optional regex pattern for primary boundaries (default: H2)
 * @param fallbackPattern - Optional regex pattern for fallback boundaries (default: H3)
 * @returns Array of all Section objects from all decomposed files
 */
export async function processDirectory(
	inputDir: string,
	outputDir: string,
	patterns: string[] = ['*.md', '**/*.md'],
	primaryPattern: string = '^## .+',
	fallbackPattern: string = '^### .+'
): Promise<Section[]> {
	const allSections: Section[] = [];

	// Walk directory and process each markdown file
	for await (const filePath of walkDirectory(inputDir, patterns)) {
		// Create output subdirectory based on input file structure
		const fileNameWithoutExt = path.basename(filePath, '.md');
		const outputSubdir = path.join(outputDir, fileNameWithoutExt);

		// Process the file
		const sections = await processDocument(filePath, outputSubdir, primaryPattern, fallbackPattern);
		allSections.push(...sections);
	}

	return allSections;
}
