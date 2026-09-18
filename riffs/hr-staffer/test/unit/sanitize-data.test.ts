import { describe, expect, it } from 'vitest';
import { fullSanitization } from '../../src/core/sanitize-data.js';
import type { Employee } from '../../src/lib/types.js';

describe('sanitize-data', () => {
	const createEmployee = (overrides: Partial<Employee> = {}): Employee => ({
		displayName: 'John Doe',
		firstName: 'John',
		lastName: 'Doe',
		email: 'john@example.com',
		title: 'Engineer',
		department: 'Engineering',
		manager: 'No Manager',
		mobile: '+1-555-0000',
		streetAddress: '123 Main St',
		city: 'San Francisco',
		country: 'USA',
		...overrides,
	});

	describe('fullSanitization', () => {
		it('given employee list, when fullSanitization called, then applies all cleaning steps in correct order', () => {
			const employees: Employee[] = [
				createEmployee({
					displayName: '  Alice Smith  ',
					firstName: '  Alice  ',
					lastName: '  Smith  ',
					email: '  alice@example.com  ',
					title: '  Manager & Lead  ',
					department: '   Engineering   ',
					manager: '  NONE  ',
					mobile: '  +1-555-0001  ',
					streetAddress: '"123 Oak Ave"\r\nSuite 100',
					city: '  New York  ',
					country: '  USA  ',
				}),
				createEmployee({
					displayName: '  Bob Jones  ',
					firstName: '  Bob  ',
					lastName: '  Jones  ',
					email: '  bob@example.com  ',
					title: 'Engineer & Architect',
					department: 'Engineering   & Operations',
					manager: 'alice smith',
					mobile: '  +1-555-0002  ',
					streetAddress: '456 Pine Rd',
					city: '  Boston  ',
					country: '  USA  ',
				}),
				createEmployee({
					displayName: '  Carol Brown  ',
					firstName: '  Carol  ',
					lastName: '  Brown  ',
					email: '  carol@example.com  ',
					title: 'Analyst',
					department: '  Finance  ',
					manager: 'n/a',
					mobile: '  +1-555-0003  ',
					streetAddress: '789 Elm St',
					city: '  Chicago  ',
					country: '  USA  ',
				}),
			];

			const result = fullSanitization(employees);

			// Verify Alice (root employee)
			expect(result[0].displayName).toBe('Alice Smith');
			expect(result[0].firstName).toBe('Alice');
			expect(result[0].lastName).toBe('Smith');
			expect(result[0].email).toBe('alice@example.com');
			expect(result[0].title).toBe('Manager and Lead'); // & replaced with 'and'
			expect(result[0].department).toBe('Engineering'); // extra spaces removed
			expect(result[0].manager).toBe('No Manager'); // 'NONE' normalized
			expect(result[0].mobile).toBe('+1-555-0001');
			expect(result[0].streetAddress).toBe('123 Oak Ave"\nSuite 100'); // outer quotes removed, \r\n normalized to \n
			expect(result[0].city).toBe('New York');
			expect(result[0].country).toBe('USA');

			// Verify Bob (matched to Alice)
			expect(result[1].displayName).toBe('Bob Jones');
			expect(result[1].firstName).toBe('Bob');
			expect(result[1].title).toBe('Engineer and Architect');
			expect(result[1].department).toBe('Engineering and Operations'); // multiple spaces normalized to single space
			expect(result[1].manager).toBe('Alice Smith'); // 'alice smith' matched to 'Alice Smith' via normalization
			expect(result[1].mobile).toBe('+1-555-0002');

			// Verify Carol (root, n/a normalized)
			expect(result[2].displayName).toBe('Carol Brown');
			expect(result[2].manager).toBe('No Manager'); // 'n/a' normalized
		});
	});
});
