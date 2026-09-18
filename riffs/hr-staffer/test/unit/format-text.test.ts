import { describe, expect, it } from 'vitest';
import { formatAsText } from '../../src/formatters/format-text.js';
import type { Employee, OrgNode } from '../../src/lib/types.js';

describe('format-text', () => {
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

	const createOrgNode = (employee: Employee, directReports: OrgNode[] = []): OrgNode => ({
		employee,
		directReports,
	});

	describe('formatAsText', () => {
		it('given single employee tree, when formatAsText called with defaults, then returns employee name with title', () => {
			const tree = createOrgNode(createEmployee({ displayName: 'Alice' }));

			const result = formatAsText(tree);

			expect(result).toBe('Alice (Engineer)');
		});

		it('given flat two-level tree, when formatAsText called, then formats with indentation for reports', () => {
			const alice = createEmployee({ displayName: 'Alice', title: 'Manager' });
			const bob = createEmployee({ displayName: 'Bob', title: 'Engineer', manager: 'Alice' });
			const tree = createOrgNode(alice, [createOrgNode(bob)]);

			const result = formatAsText(tree);

			expect(result).toContain('Alice (Manager)');
			expect(result).toContain('  Bob (Engineer)');
			expect(result.split('\n')).toHaveLength(2);
		});

		it('given tree with multiple direct reports, when formatAsText called, then formats all reports with same indentation', () => {
			const alice = createEmployee({ displayName: 'Alice', title: 'Director' });
			const bob = createEmployee({ displayName: 'Bob', title: 'Manager', manager: 'Alice' });
			const carol = createEmployee({ displayName: 'Carol', title: 'Manager', manager: 'Alice' });
			const tree = createOrgNode(alice, [createOrgNode(bob), createOrgNode(carol)]);

			const result = formatAsText(tree);

			expect(result).toContain('Alice (Director)');
			expect(result).toContain('  Bob (Manager)');
			expect(result).toContain('  Carol (Manager)');
		});

		it('given tree with nested hierarchy, when formatAsText called, then applies progressive indentation', () => {
			const alice = createEmployee({ displayName: 'Alice', title: 'Director' });
			const bob = createEmployee({ displayName: 'Bob', title: 'Manager', manager: 'Alice' });
			const carol = createEmployee({ displayName: 'Carol', title: 'Engineer', manager: 'Bob' });
			const tree = createOrgNode(alice, [createOrgNode(bob, [createOrgNode(carol)])]);

			const result = formatAsText(tree);

			expect(result).toContain('Alice (Director)');
			expect(result).toContain('  Bob (Manager)');
			expect(result).toContain('    Carol (Engineer)');
			expect(result.split('\n')).toHaveLength(3);
		});

		it('given tree with includeDepartment and includeEmail options, when formatAsText called, then includes all fields', () => {
			const alice = createEmployee({
				displayName: 'Alice',
				title: 'Manager',
				department: 'Engineering',
				email: 'alice@example.com',
			});
			const tree = createOrgNode(alice);

			const result = formatAsText(tree, {
				includeTitle: true,
				includeDepartment: true,
				includeEmail: true,
			});

			expect(result).toBe('Alice (Manager) [Engineering] <alice@example.com>');
		});

		it('given tree with options disabled, when formatAsText called, then shows only display name', () => {
			const alice = createEmployee({
				displayName: 'Alice',
				title: 'Manager',
				department: 'Engineering',
				email: 'alice@example.com',
			});
			const tree = createOrgNode(alice);

			const result = formatAsText(tree, {
				includeTitle: false,
				includeDepartment: false,
				includeEmail: false,
			});

			expect(result).toBe('Alice');
		});

		it('given tree deeper than maxDepth, when formatAsText called with maxDepth option, then stops at depth limit', () => {
			const alice = createEmployee({ displayName: 'Alice', title: 'Director' });
			const bob = createEmployee({ displayName: 'Bob', title: 'Manager', manager: 'Alice' });
			const carol = createEmployee({ displayName: 'Carol', title: 'Engineer', manager: 'Bob' });
			const david = createEmployee({ displayName: 'David', title: 'IC', manager: 'Carol' });

			const tree = createOrgNode(alice, [createOrgNode(bob, [createOrgNode(carol, [createOrgNode(david)])])]);

			const result = formatAsText(tree, { maxDepth: 1 });

			expect(result).toContain('Alice');
			expect(result).toContain('Bob');
			expect(result).not.toContain('Carol');
			expect(result).not.toContain('David');
		});
	});
});
