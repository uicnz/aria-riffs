import { unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { parseCSV } from '../../src/core/parse-csv.js';

describe('parse-csv', () => {
	let tempFiles: string[] = [];

	afterEach(() => {
		tempFiles.forEach(file => {
			try {
				unlinkSync(file);
			} catch {
				// File might already be deleted
			}
		});
		tempFiles = [];
	});

	function createTempCSV(lines: string[]): string {
		const filePath = join(tmpdir(), `test-${Date.now()}-${Math.random()}.csv`);
		writeFileSync(filePath, lines.join('\n'), 'utf-8');
		tempFiles.push(filePath);
		return filePath;
	}

	describe('parseCSV', () => {
		it('given valid CSV file, when parseCSV called, then reads file and returns employees', () => {
			const csvPath = createTempCSV([
				'Display Name,First Name,Last Name,Email Address,Title,Department,Manager,Mobile,Street Address,City,Country',
				'Alice,Alice,Smith,alice@example.com,Manager,Engineering,No Manager,+1-555-0001,456 Oak Ave,New York,USA',
				'Bob,Bob,Jones,bob@example.com,Engineer,Engineering,Alice,+1-555-0002,789 Pine Rd,Boston,USA',
			]);

			const result = parseCSV(csvPath);

			expect(result).toHaveLength(2);
			expect(result[0].displayName).toBe('Alice');
			expect(result[1].displayName).toBe('Bob');
			expect(result[1].manager).toBe('Alice');
		});

		it('given valid CSV file with Windows line endings, when parseCSV called, then parses correctly', () => {
			const csvPath = createTempCSV([
				'Display Name,First Name,Last Name,Email Address,Title,Department,Manager,Mobile,Street Address,City,Country',
				'Jane Doe,Jane,Doe,jane@example.com,CEO,Executive,No Manager,+1-555-0000,123 Main St,San Francisco,USA',
			]);

			const result = parseCSV(csvPath);

			expect(result).toHaveLength(1);
			expect(result[0].displayName).toBe('Jane Doe');
		});
	});
});
