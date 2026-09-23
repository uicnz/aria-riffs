import { describe, expect, it } from 'vitest';
import { validateEmails, validateEmployees } from '../../src/core/validate-employees.js';
import type { Employee } from '../../src/lib/types.js';

describe('validate-employees', () => {
	const validEmployee: Employee = {
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
	};

	describe('validateEmployees', () => {
		it('given empty employee list, when validateEmployees called, then returns error', () => {
			const result = validateEmployees([]);

			expect(result.valid).toBe(false);
			expect(result.errors).toContain('No employees found in data');
		});

		it('given employees with no root manager, when validateEmployees called, then returns error', () => {
			const employees: Employee[] = [
				{ ...validEmployee, displayName: 'Alice', manager: 'Bob' },
				{ ...validEmployee, displayName: 'Bob', manager: 'Carol' },
			];

			const result = validateEmployees(employees);

			expect(result.valid).toBe(false);
			expect(result.errors).toContain('No root employee found (no employee with "No Manager")');
		});

		it('given employees with multiple root managers, when validateEmployees called, then returns error', () => {
			const employees: Employee[] = [
				{ ...validEmployee, displayName: 'Alice', manager: 'No Manager' },
				{ ...validEmployee, displayName: 'Bob', manager: 'No Manager' },
			];

			const result = validateEmployees(employees);

			expect(result.valid).toBe(false);
			expect(result.errors.some(e => e.includes('Multiple root employees found'))).toBe(true);
		});

		it('given employee with missing display name, when validateEmployees called, then returns error', () => {
			const employees: Employee[] = [{ ...validEmployee, displayName: '', manager: 'No Manager' }];

			const result = validateEmployees(employees);

			expect(result.valid).toBe(false);
			expect(result.errors.some(e => e.includes('has no display name'))).toBe(true);
		});

		it('given employee with missing email, when validateEmployees called, then returns error', () => {
			const employees: Employee[] = [
				{ ...validEmployee, displayName: 'Alice', email: '', manager: 'No Manager' },
			];

			const result = validateEmployees(employees);

			expect(result.valid).toBe(false);
			expect(result.errors.some(e => e.includes('has no email address'))).toBe(true);
		});

		it('given employee with missing title and department, when validateEmployees called, then returns warning', () => {
			const employees: Employee[] = [
				{ ...validEmployee, displayName: 'Alice', title: '', department: '', manager: 'No Manager' },
			];

			const result = validateEmployees(employees);

			expect(result.valid).toBe(true);
			expect(result.warnings.some(e => e.includes('has no title'))).toBe(true);
			expect(result.warnings.some(e => e.includes('has no department'))).toBe(true);
		});

		it('given employees with duplicate display names (requireUniqueNames=true), when validateEmployees called, then returns error', () => {
			const employees: Employee[] = [
				{ ...validEmployee, displayName: 'Alice', manager: 'No Manager' },
				{ ...validEmployee, displayName: 'Alice', manager: 'Alice' },
			];

			const result = validateEmployees(employees, { requireUniqueNames: true });

			expect(result.valid).toBe(false);
			expect(result.errors.some(e => e.includes('Duplicate display name found'))).toBe(true);
		});

		it('given employees with duplicate emails (requireUniqueEmails=true), when validateEmployees called, then returns error', () => {
			const employees: Employee[] = [
				{ ...validEmployee, displayName: 'Alice', email: 'test@example.com', manager: 'No Manager' },
				{ ...validEmployee, displayName: 'Bob', email: 'test@example.com', manager: 'Alice' },
			];

			const result = validateEmployees(employees, { requireUniqueEmails: true });

			expect(result.valid).toBe(false);
			expect(result.errors.some(e => e.includes('Duplicate email address'))).toBe(true);
		});

		it('given employee with invalid manager reference, when validateEmployees called, then returns error', () => {
			const employees: Employee[] = [
				{ ...validEmployee, displayName: 'Alice', manager: 'No Manager' },
				{ ...validEmployee, displayName: 'Bob', manager: 'NonExistent' },
			];

			const result = validateEmployees(employees);

			expect(result.valid).toBe(false);
			expect(result.errors.some(e => e.includes('invalid manager reference'))).toBe(true);
		});

		it('given disconnected subtree unreachable from root (allowOrphans=false), when validateEmployees called, then returns circular error', () => {
			const employees: Employee[] = [
				{ ...validEmployee, displayName: 'Alice', manager: 'No Manager' },
				{ ...validEmployee, displayName: 'Bob', manager: 'Alice' },
				{ ...validEmployee, displayName: 'Carol', manager: 'David' },
				{ ...validEmployee, displayName: 'David', manager: 'Carol' }, // Carol and David form cycle separate from root
			];

			const result = validateEmployees(employees, { allowOrphans: false });

			// Circular reference will be detected
			expect(result.errors.some(e => e.includes('Circular reporting relationship'))).toBe(true);
		});

		it('given circular reporting relationship, when validateEmployees called, then returns error', () => {
			const employees: Employee[] = [
				{ ...validEmployee, displayName: 'Alice', manager: 'Bob' },
				{ ...validEmployee, displayName: 'Bob', manager: 'Alice' },
			];

			const result = validateEmployees(employees);

			expect(result.valid).toBe(false);
			expect(result.errors.some(e => e.includes('Circular reporting relationship'))).toBe(true);
		});

		it('given valid employees with proper hierarchy, when validateEmployees called, then returns valid', () => {
			const employees: Employee[] = [
				{ ...validEmployee, displayName: 'Alice', email: 'alice@example.com', manager: 'No Manager' },
				{ ...validEmployee, displayName: 'Bob', email: 'bob@example.com', manager: 'Alice' },
				{ ...validEmployee, displayName: 'Carol', email: 'carol@example.com', manager: 'Bob' },
			];

			const result = validateEmployees(employees);

			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});
	});

	describe('validateEmails', () => {
		it('given valid email addresses, when validateEmails called, then returns valid', () => {
			const employees: Employee[] = [
				{ ...validEmployee, displayName: 'Alice', email: 'alice@example.com' },
				{ ...validEmployee, displayName: 'Bob', email: 'bob@example.com' },
			];

			const result = validateEmails(employees);

			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it('given invalid email format, when validateEmails called, then returns error', () => {
			const employees: Employee[] = [{ ...validEmployee, displayName: 'Alice', email: 'invalid-email' }];

			const result = validateEmails(employees);

			expect(result.valid).toBe(false);
			expect(result.errors.some(e => e.includes('Invalid email format'))).toBe(true);
		});
	});
});
