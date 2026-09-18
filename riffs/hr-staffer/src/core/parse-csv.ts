import { readFileSync } from 'node:fs';
import type { Employee } from '../lib/types.js';

/**
 * Required CSV column headers in exact order
 */
const REQUIRED_CSV_COLUMNS = [
	'Display Name',
	'First Name',
	'Last Name',
	'Email Address',
	'Title',
	'Department',
	'Manager',
	'Mobile',
	'Street Address',
	'City',
	'Country',
] as const;

/**
 * Validate CSV header matches required columns
 */
function validateCSVHeader(headerLine: string): void {
	const headers = parseCSVLine(headerLine).map(h => h.trim());

	if (headers.length !== REQUIRED_CSV_COLUMNS.length) {
		throw new Error(
			`Invalid CSV header: expected ${REQUIRED_CSV_COLUMNS.length} columns, got ${headers.length}\n\n` +
				`Required columns:\n${REQUIRED_CSV_COLUMNS.map((col, i) => `  ${i + 1}. ${col}`).join('\n')}\n\n` +
				`Found columns:\n${headers.map((col, i) => `  ${i + 1}. ${col}`).join('\n')}`
		);
	}

	const mismatches: string[] = [];
	headers.forEach((header, index) => {
		if (header !== REQUIRED_CSV_COLUMNS[index]) {
			mismatches.push(`  Column ${index + 1}: expected "${REQUIRED_CSV_COLUMNS[index]}", got "${header}"`);
		}
	});

	if (mismatches.length > 0) {
		throw new Error(
			`CSV header columns don't match required format:\n\n${mismatches.join('\n')}\n\n` +
				`Required columns in order:\n${REQUIRED_CSV_COLUMNS.map((col, i) => `  ${i + 1}. ${col}`).join('\n')}`
		);
	}
}

/**
 * Parse a single CSV line handling quoted fields
 */
function parseCSVLine(line: string): string[] {
	const fields: string[] = [];
	let currentField = '';
	let inQuotes = false;

	for (let i = 0; i < line.length; i++) {
		const char = line[i];
		const nextChar = line[i + 1];

		if (char === '"' && inQuotes && nextChar === '"') {
			currentField += '"';
			i++;
		} else if (char === '"') {
			inQuotes = !inQuotes;
		} else if (char === ',' && !inQuotes) {
			fields.push(currentField);
			currentField = '';
		} else {
			currentField += char;
		}
	}

	fields.push(currentField);
	return fields;
}

/**
 * Parse CSV content (pure function - no file I/O)
 * Takes CSV file content as string and returns array of employees
 */
export function parseCSVContent(content: string): Employee[] {
	const lines = content.trim().split('\n');

	if (lines.length === 0) {
		throw new Error('CSV file is empty');
	}

	if (lines.length === 1) {
		throw new Error('CSV file only contains a header row with no data');
	}

	// Validate header
	validateCSVHeader(lines[0]);

	// Skip header line
	const dataLines = lines.slice(1);

	return dataLines.map((line, index) => {
		const fields = parseCSVLine(line).map(f => f.trim());

		if (fields.length !== 11) {
			throw new Error(`Invalid CSV format at line ${index + 2}: expected 11 fields, got ${fields.length}`);
		}

		return {
			displayName: fields[0],
			firstName: fields[1],
			lastName: fields[2],
			email: fields[3],
			title: fields[4],
			department: fields[5],
			manager: fields[6],
			mobile: fields[7],
			streetAddress: fields[8],
			city: fields[9],
			country: fields[10],
		};
	});
}

/**
 * Parse CSV file and return array of employees
 * Wrapper around parseCSVContent that handles file I/O
 */
export function parseCSV(filePath: string): Employee[] {
	const content = readFileSync(filePath, 'utf-8');
	return parseCSVContent(content);
}
