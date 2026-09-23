/**
 * Frontmatter parser for decomposed markdown sections
 * Extracts YAML metadata from markdown files with frontmatter blocks
 */

import { parse as parseYaml } from 'yaml';
import type { FrontmatterData } from '../lib/types.js';

/**
 * Parse YAML frontmatter from markdown content
 * Expects content in format: ---\nYAML\n---\nMarkdown
 *
 * @param content - Markdown content with optional frontmatter
 * @returns Parsed frontmatter data or null if not found
 */
export function parseFrontmatter(content: string): FrontmatterData | null {
	// Check if content starts with frontmatter marker
	if (!content.startsWith('---')) {
		return null;
	}

	// Find the closing frontmatter marker
	const lines = content.split('\n');
	let endIndex = -1;

	for (let i = 1; i < lines.length; i++) {
		if (lines[i] === '---') {
			endIndex = i;
			break;
		}
	}

	if (endIndex === -1) {
		return null;
	}

	// Extract frontmatter block
	const frontmatterBlock = lines.slice(1, endIndex).join('\n');

	try {
		const parsed = parseYaml(frontmatterBlock) as Record<string, unknown>;

		// Validate required fields and extract
		const sourceFile = parsed['source_file'] as string | undefined;
		const sourceSection = parsed['source_section'] as string | undefined;
		const sectionIndex = parsed['section_index'] as number | undefined;
		const lineRange = parsed['line_range'] as [number, number] | undefined;
		const decomposedAt = parsed['decomposed_at'] as string | undefined;
		const originalHeading = parsed['original_heading'] as string | undefined;
		const boundaryType = parsed['boundary_type'] as 'primary' | 'fallback' | undefined;

		// All fields required except boundary_type which is optional
		if (
			!sourceFile ||
			!sourceSection ||
			sectionIndex === undefined ||
			!lineRange ||
			!decomposedAt ||
			originalHeading === undefined
		) {
			return null;
		}

		return {
			source_file: sourceFile,
			source_section: sourceSection,
			section_index: sectionIndex,
			line_range: lineRange,
			decomposed_at: decomposedAt,
			original_heading: originalHeading,
			boundary_type: boundaryType,
		};
	} catch {
		// YAML parsing failed, return null
		return null;
	}
}

/**
 * Extract markdown content after frontmatter block
 * Removes the YAML frontmatter, leaving only the markdown content
 *
 * @param content - Markdown content with optional frontmatter
 * @returns Content without frontmatter
 */
export function stripFrontmatter(content: string): string {
	if (!content.startsWith('---')) {
		return content;
	}

	const lines = content.split('\n');
	let endIndex = -1;

	for (let i = 1; i < lines.length; i++) {
		if (lines[i] === '---') {
			endIndex = i;
			break;
		}
	}

	if (endIndex === -1) {
		return content;
	}

	// Return content after frontmatter, skipping the closing --- line
	return lines.slice(endIndex + 1).join('\n');
}
