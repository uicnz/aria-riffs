import { describe, expect, it } from 'vitest';
import { parseCSVContent } from '../../src/core/parse-csv.js';

describe('parse-csv', () => {
	const validCSVHeader =
		'Display Name,First Name,Last Name,Email Address,Title,Department,Manager,Mobile,Street Address,City,Country';

	describe('parseCSVContent', () => {
		it('given valid CSV content with correct headers, when parseCSVContent called, then returns array of employees', () => {
			const content = `${validCSVHeader}
Jane Doe,Jane,Doe,jane@example.com,CEO,Executive,No Manager,+1-555-0000,123 Main St,San Francisco,USA`;

			const result = parseCSVContent(content);

			expect(result).toHaveLength(1);
			expect(result[0]).toMatchObject({
				displayName: 'Jane Doe',
				firstName: 'Jane',
				lastName: 'Doe',
				email: 'jane@example.com',
				title: 'CEO',
				department: 'Executive',
				manager: 'No Manager',
				mobile: '+1-555-0000',
				streetAddress: '123 Main St',
				city: 'San Francisco',
				country: 'USA',
			});
		});

		it('given CSV with missing header columns, when parseCSVContent called, then throws descriptive error', () => {
			const content = 'Display Name,First Name,Last Name,Email Address,Title\nJane,Jane,Doe,jane@example.com,CEO';

			expect(() => parseCSVContent(content)).toThrow('Invalid CSV header');
			expect(() => parseCSVContent(content)).toThrow('expected 11 columns');
		});

		it('given whitespace-only CSV content, when parseCSVContent called, then throws header-only error', () => {
			const content = '';

			expect(() => parseCSVContent(content)).toThrow('only contains a header row with no data');
		});

		it('given CSV with header only (no data rows), when parseCSVContent called, then throws error', () => {
			const content = validCSVHeader;

			expect(() => parseCSVContent(content)).toThrow('only contains a header row with no data');
		});

		it('given CSV with quoted fields containing commas, when parseCSVContent called, then parses correctly', () => {
			const content = `${validCSVHeader}
"Doe, Jane",Jane,Doe,jane@example.com,CEO,"Executive, Operations",No Manager,+1-555-0000,"123 Main St, Suite 100",San Francisco,USA`;

			const result = parseCSVContent(content);

			expect(result).toHaveLength(1);
			expect(result[0].displayName).toBe('Doe, Jane');
			expect(result[0].department).toBe('Executive, Operations');
			expect(result[0].streetAddress).toBe('123 Main St, Suite 100');
		});

		it('given CSV with multiple employees, when parseCSVContent called, then returns all employees', () => {
			const content = `${validCSVHeader}
Alice,Alice,Smith,alice@example.com,Manager,Engineering,No Manager,+1-555-0001,456 Oak Ave,New York,USA
Bob,Bob,Jones,bob@example.com,Engineer,Engineering,Alice,+1-555-0002,789 Pine Rd,Boston,USA
Carol,Carol,Brown,carol@example.com,Engineer,Engineering,Alice,+1-555-0003,321 Elm St,Chicago,USA`;

			const result = parseCSVContent(content);

			expect(result).toHaveLength(3);
			expect(result[0].displayName).toBe('Alice');
			expect(result[1].displayName).toBe('Bob');
			expect(result[2].displayName).toBe('Carol');
			expect(result[1].manager).toBe('Alice');
			expect(result[2].manager).toBe('Alice');
		});

		it('given CSV with incorrect column count in data row, when parseCSVContent called, then throws error with line number', () => {
			const content = `${validCSVHeader}
Jane,Jane,Doe,jane@example.com,CEO,Executive,No Manager,+1-555-0000,123 Main St
Bob,Bob,Jones,bob@example.com,Engineer,Engineering,Jane,+1-555-0001,456 Oak Ave,New York,USA`;

			expect(() => parseCSVContent(content)).toThrow('Invalid CSV format at line 2');
			expect(() => parseCSVContent(content)).toThrow('expected 11 fields, got 9');
		});

		it('given CSV with extra columns, when parseCSVContent called, then throws error', () => {
			const content = `${validCSVHeader}
Jane,Jane,Doe,jane@example.com,CEO,Executive,No Manager,+1-555-0000,123 Main St,San Francisco,USA,Extra`;

			expect(() => parseCSVContent(content)).toThrow('Invalid CSV format at line 2');
			expect(() => parseCSVContent(content)).toThrow('expected 11 fields, got 12');
		});

		it('given CSV header with wrong column names, when parseCSVContent called, then throws error', () => {
			const wrongHeader = 'Name,First,Last,Email,Title,Department,Manager,Mobile,Address,City,Country';
			const content = `${wrongHeader}
Jane,Jane,Doe,jane@example.com,CEO,Executive,No Manager,+1-555-0000,123 Main St,San Francisco,USA`;

			expect(() => parseCSVContent(content)).toThrow("CSV header columns don't match required format");
			expect(() => parseCSVContent(content)).toThrow('expected "Display Name"');
		});

		it('given CSV with escaped quotes in quoted field, when parseCSVContent called, then parses correctly', () => {
			const content = `${validCSVHeader}
Jane Doe,Jane,Doe,jane@example.com,"CEO / ""Chief"" Executive",Executive,No Manager,+1-555-0000,123 Main St,San Francisco,USA`;

			const result = parseCSVContent(content);

			expect(result).toHaveLength(1);
			expect(result[0].title).toBe('CEO / "Chief" Executive');
		});

		it('given CSV with trailing newlines, when parseCSVContent called, then parses correctly', () => {
			const content = `${validCSVHeader}
Jane Doe,Jane,Doe,jane@example.com,CEO,Executive,No Manager,+1-555-0000,123 Main St,San Francisco,USA

`;

			const result = parseCSVContent(content);

			expect(result).toHaveLength(1);
		});

		it('given CSV with whitespace in fields, when parseCSVContent called, then trims whitespace', () => {
			const content = `${validCSVHeader}
  Jane Doe  ,  Jane  ,  Doe  ,  jane@example.com  ,  CEO  ,  Executive  ,  No Manager  ,  +1-555-0000  ,  123 Main St  ,  San Francisco  ,  USA  `;

			const result = parseCSVContent(content);

			expect(result).toHaveLength(1);
			expect(result[0].displayName).toBe('Jane Doe');
			expect(result[0].firstName).toBe('Jane');
			expect(result[0].city).toBe('San Francisco');
		});
	});
});
