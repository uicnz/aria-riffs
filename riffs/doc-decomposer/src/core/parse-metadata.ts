/**
 * Metadata parser for RFP classification files
 */

import { CATEGORIES, REGEX_PATTERNS } from '../lib/config.js';
import type { MetadataEntry, MetadataLookup } from '../lib/types.js';
import { extractValue, readFile } from '../utils/utils.js';

/**
 * Parse metadata from classification file
 */
export async function parseMetadata(metadataFile: string): Promise<MetadataLookup> {
	const content = await readFile(metadataFile);
	const metadataLookup: MetadataLookup = {};

	const metadataRegex = REGEX_PATTERNS.METADATA_SECTION;
	let match: RegExpExecArray | null;

	// biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex exec pattern
	while ((match = metadataRegex.exec(content)) !== null) {
		const [, title, identifier, metadataBlock] = match;

		if (!identifier || !title) continue;

		// Extract metadata values using regex patterns
		const Priority = extractValue(metadataBlock || '', REGEX_PATTERNS.PRIORITY);
		const Category = extractValue(metadataBlock || '', REGEX_PATTERNS.CATEGORY);
		const Department = extractValue(metadataBlock || '', REGEX_PATTERNS.DEPARTMENT);
		const Leader = extractValue(metadataBlock || '', REGEX_PATTERNS.LEADER);
		const CustomiseRaw = extractValue(metadataBlock || '', REGEX_PATTERNS.CUSTOMISE);

		// Use category value directly from source
		const categoryValue = Category;

		// Determine Customise value based on Category
		const Customise = determineCustomise(categoryValue, CustomiseRaw);

		metadataLookup[identifier] = {
			Title: title.trim(),
			Identifier: identifier.trim(),
			Priority: Priority.trim(),
			Category: categoryValue,
			Department: Department.trim(),
			Leader: Leader.trim(),
			Customise,
		};
	}

	return metadataLookup;
}

/**
 * Determine Customise value based on Category
 */
function determineCustomise(category: string, rawValue: string): boolean {
	// Normalize input value
	const normalizedRaw = rawValue.toLowerCase();

	// If explicitly set in source, use that
	if (rawValue && normalizedRaw === 'yes') {
		return true;
	}
	if (rawValue && normalizedRaw === 'no') {
		return false;
	}

	// Otherwise, derive from category
	if (category === 'standard') {
		return false; // Standard responses don't need customisation
	} else {
		return true; // Hybrid and Specific need customisation
	}
}

/**
 * Validate metadata entry has required fields
 */
export function validateMetadata(entry: MetadataEntry): { valid: boolean; errors: string[] } {
	const errors: string[] = [];

	if (!entry.Identifier) {
		errors.push('Missing Identifier');
	}

	if (!entry.Category) {
		errors.push('Missing Category');
	} else {
		if (CATEGORIES.length > 0 && !CATEGORIES.includes(entry.Category)) {
			errors.push(`Invalid Category: ${entry.Category}. Valid categories: ${CATEGORIES.join(', ')}`);
		}
	}

	if (!entry.Department) {
		errors.push('Missing Department');
	}

	if (!entry.Priority) {
		errors.push('Missing Priority');
	}

	if (typeof entry.Customise !== 'boolean') {
		errors.push(`Invalid Customise value: ${entry.Customise} (must be boolean)`);
	}

	return {
		valid: errors.length === 0,
		errors,
	};
}

/**
 * Get summary statistics for metadata
 */
export function getMetadataStats(lookup: MetadataLookup): {
	total: number;
	byCategory: Record<string, number>;
	byDepartment: Record<string, number>;
	customCount: number;
} {
	const entries = Object.values(lookup);

	const byCategory: Record<string, number> = {};
	const byDepartment: Record<string, number> = {};
	let customCount = 0;

	for (const entry of entries) {
		// Count by category
		byCategory[entry.Category] = (byCategory[entry.Category] || 0) + 1;

		// Count by department
		byDepartment[entry.Department] = (byDepartment[entry.Department] || 0) + 1;

		// Count customisation needed
		if (entry.Customise) {
			customCount++;
		}
	}

	return {
		total: entries.length,
		byCategory,
		byDepartment,
		customCount,
	};
}
