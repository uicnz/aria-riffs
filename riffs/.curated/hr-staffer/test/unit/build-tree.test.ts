import { describe, expect, it } from 'vitest';
import { buildOrgTree, countEmployees, getTreeDepth } from '../../src/core/build-tree.js';
import type { Employee } from '../../src/lib/types.js';

describe('build-tree', () => {
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

	describe('buildOrgTree', () => {
		it('given flat employee list with hierarchical relationships, when buildOrgTree called, then builds correct tree structure', () => {
			const employees: Employee[] = [
				{ ...validEmployee, displayName: 'Alice', manager: 'No Manager' },
				{ ...validEmployee, displayName: 'Bob', manager: 'Alice' },
				{ ...validEmployee, displayName: 'Carol', manager: 'Alice' },
			];

			const result = buildOrgTree(employees);

			expect(result.employee.displayName).toBe('Alice');
			expect(result.directReports).toHaveLength(2);
			expect(result.directReports[0].employee.displayName).toBe('Bob');
			expect(result.directReports[1].employee.displayName).toBe('Carol');
		});

		it('given employee list with no root, when buildOrgTree called, then throws error', () => {
			const employees: Employee[] = [
				{ ...validEmployee, displayName: 'Alice', manager: 'Bob' },
				{ ...validEmployee, displayName: 'Bob', manager: 'Carol' },
			];

			expect(() => buildOrgTree(employees)).toThrow('No root employee found');
		});

		it('given employee list with multiple roots, when buildOrgTree called, then throws error', () => {
			const employees: Employee[] = [
				{ ...validEmployee, displayName: 'Alice', manager: 'No Manager' },
				{ ...validEmployee, displayName: 'Bob', manager: 'No Manager' },
			];

			expect(() => buildOrgTree(employees)).toThrow('Multiple root employees found');
		});
	});

	describe('getTreeDepth', () => {
		it('given single employee tree, when getTreeDepth called, then returns depth 0', () => {
			const employees: Employee[] = [{ ...validEmployee, displayName: 'Alice', manager: 'No Manager' }];

			const tree = buildOrgTree(employees);
			const depth = getTreeDepth(tree);

			expect(depth).toBe(0);
		});

		it('given multi-level tree, when getTreeDepth called, then returns correct depth', () => {
			const employees: Employee[] = [
				{ ...validEmployee, displayName: 'Alice', manager: 'No Manager' },
				{ ...validEmployee, displayName: 'Bob', manager: 'Alice' },
				{ ...validEmployee, displayName: 'Carol', manager: 'Bob' },
			];

			const tree = buildOrgTree(employees);
			const depth = getTreeDepth(tree);

			expect(depth).toBe(2);
		});

		it('given tree with uneven branches, when getTreeDepth called, then returns max depth', () => {
			const employees: Employee[] = [
				{ ...validEmployee, displayName: 'Alice', manager: 'No Manager' },
				{ ...validEmployee, displayName: 'Bob', manager: 'Alice' },
				{ ...validEmployee, displayName: 'Carol', manager: 'Alice' },
				{ ...validEmployee, displayName: 'David', manager: 'Bob' },
				{ ...validEmployee, displayName: 'Eve', manager: 'David' },
			];

			const tree = buildOrgTree(employees);
			const depth = getTreeDepth(tree);

			expect(depth).toBe(3);
		});
	});

	describe('countEmployees', () => {
		it('given single employee tree, when countEmployees called, then returns 1', () => {
			const employees: Employee[] = [{ ...validEmployee, displayName: 'Alice', manager: 'No Manager' }];

			const tree = buildOrgTree(employees);
			const count = countEmployees(tree);

			expect(count).toBe(1);
		});

		it('given multi-level tree with N employees, when countEmployees called, then returns N', () => {
			const employees: Employee[] = [
				{ ...validEmployee, displayName: 'Alice', manager: 'No Manager' },
				{ ...validEmployee, displayName: 'Bob', manager: 'Alice' },
				{ ...validEmployee, displayName: 'Carol', manager: 'Alice' },
				{ ...validEmployee, displayName: 'David', manager: 'Bob' },
			];

			const tree = buildOrgTree(employees);
			const count = countEmployees(tree);

			expect(count).toBe(4);
		});
	});
});
