import { describe, expect, it } from 'vitest';
import { formatAsMarkdown } from '../../src/formatters/format-markdown.js';
import type { Employee, OrgNode } from '../../src/lib/types.js';

describe('format-markdown', () => {
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

	describe('formatAsMarkdown', () => {
		it('given single employee tree, when formatAsMarkdown called, then includes document header and employee details', () => {
			const alice = createEmployee({
				displayName: 'Alice',
				email: 'alice@example.com',
				title: 'Director',
				department: 'Executive',
			});
			const tree = createOrgNode(alice);

			const result = formatAsMarkdown(tree);

			expect(result).toContain('# Organization Chart');
			expect(result).toContain('## Alice');
			expect(result).toContain('- Title: Director');
			expect(result).toContain('- Department: Executive');
			expect(result).toContain('- Email: <alice@example.com>');
			expect(result).toContain('- Phone: +1-555-0000');
		});

		it('given tree with options disabled, when formatAsMarkdown called, then excludes title and department', () => {
			const alice = createEmployee({ displayName: 'Alice', title: 'Director', department: 'Executive' });
			const tree = createOrgNode(alice);

			const result = formatAsMarkdown(tree, { includeTitle: false, includeDepartment: false });

			expect(result).toContain('## Alice');
			expect(result).not.toContain('- Title:');
			expect(result).not.toContain('- Department:');
			expect(result).toContain('- Email:'); // always included
		});

		it('given two-level tree, when formatAsMarkdown called, then uses H3 for direct reports', () => {
			const alice = createEmployee({ displayName: 'Alice', title: 'Director' });
			const bob = createEmployee({ displayName: 'Bob', title: 'Manager', manager: 'Alice' });
			const tree = createOrgNode(alice, [createOrgNode(bob)]);

			const result = formatAsMarkdown(tree);

			expect(result).toContain('## Alice');
			expect(result).toContain('### Bob');
			expect(result).toContain('- Direct Reports: 1');
		});

		it('given multi-level tree, when formatAsMarkdown called, then uses progressive heading levels', () => {
			const alice = createEmployee({ displayName: 'Alice' });
			const bob = createEmployee({ displayName: 'Bob', manager: 'Alice' });
			const carol = createEmployee({ displayName: 'Carol', manager: 'Bob' });
			const tree = createOrgNode(alice, [createOrgNode(bob, [createOrgNode(carol)])]);

			const result = formatAsMarkdown(tree);

			expect(result).toContain('## Alice');
			expect(result).toContain('### Bob');
			expect(result).toContain('#### Carol');
		});

		it('given tree with heading level cap, when formatAsMarkdown called with H6 limit, then caps heading at H6', () => {
			const alice = createEmployee({ displayName: 'Alice' });
			const bob = createEmployee({ displayName: 'Bob', manager: 'Alice' });
			const carol = createEmployee({ displayName: 'Carol', manager: 'Bob' });
			const david = createEmployee({ displayName: 'David', manager: 'Carol' });
			const eve = createEmployee({ displayName: 'Eve', manager: 'David' });
			const frank = createEmployee({ displayName: 'Frank', manager: 'Eve' });

			const tree = createOrgNode(alice, [
				createOrgNode(bob, [
					createOrgNode(carol, [createOrgNode(david, [createOrgNode(eve, [createOrgNode(frank)])])]),
				]),
			]);

			const result = formatAsMarkdown(tree);

			expect(result).toContain('## Alice');
			expect(result).toContain('### Bob');
			expect(result).toContain('#### Carol');
			expect(result).toContain('##### David');
			expect(result).toContain('###### Eve');
			expect(result).toContain('###### Frank'); // capped at H6
		});

		it('given tree with maxDepth option, when formatAsMarkdown called, then stops at depth limit', () => {
			const alice = createEmployee({ displayName: 'Alice' });
			const bob = createEmployee({ displayName: 'Bob', manager: 'Alice' });
			const carol = createEmployee({ displayName: 'Carol', manager: 'Bob' });
			const tree = createOrgNode(alice, [createOrgNode(bob, [createOrgNode(carol)])]);

			const result = formatAsMarkdown(tree, { maxDepth: 1 });

			expect(result).toContain('## Alice');
			expect(result).toContain('### Bob');
			expect(result).not.toContain('#### Carol');
		});

		it('given tree with multiple direct reports, when formatAsMarkdown called, then includes count of reports', () => {
			const alice = createEmployee({ displayName: 'Alice' });
			const bob = createEmployee({ displayName: 'Bob', manager: 'Alice' });
			const carol = createEmployee({ displayName: 'Carol', manager: 'Alice' });
			const tree = createOrgNode(alice, [createOrgNode(bob), createOrgNode(carol)]);

			const result = formatAsMarkdown(tree);

			expect(result).toContain('- Direct Reports: 2');
		});

		it('given single employee, when formatAsMarkdown called, then includes mermaid diagram section', () => {
			const alice = createEmployee({ displayName: 'Alice' });
			const tree = createOrgNode(alice);

			const result = formatAsMarkdown(tree);

			expect(result).toContain('---');
			expect(result).toContain('## Organization Charts');
			expect(result).toContain('erDiagram');
		});
	});
});
