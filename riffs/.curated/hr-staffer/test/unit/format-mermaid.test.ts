import { describe, expect, it } from 'vitest';
import { formatAsMermaid, generateIndividualTeamFiles } from '../../src/formatters/format-mermaid.js';
import type { Employee, OrgNode } from '../../src/lib/types.js';

describe('format-mermaid', () => {
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

	describe('formatAsMermaid', () => {
		it('given single employee tree, when formatAsMermaid called, then generates mermaid erDiagram', () => {
			const alice = createEmployee({ displayName: 'Alice', title: 'CEO' });
			const tree = createOrgNode(alice);

			const result = formatAsMermaid(tree);

			expect(result).toContain('### Executive Leadership');
			expect(result).toContain('```mermaid');
			expect(result).toContain('erDiagram');
			expect(result).toContain('Alice');
			expect(result).toContain('display_name "Alice"');
		});

		it('given two-level tree, when formatAsMermaid called, then includes CEO and direct reports with relationships', () => {
			const alice = createEmployee({ displayName: 'Alice', title: 'CEO' });
			const bob = createEmployee({ displayName: 'Bob', title: 'VP Eng', manager: 'Alice' });
			const tree = createOrgNode(alice, [createOrgNode(bob)]);

			const result = formatAsMermaid(tree);

			expect(result).toContain('Alice');
			expect(result).toContain('Bob');
			expect(result).toContain('manages'); // relationship verb
		});

		it('given tree with includeTitle option, when formatAsMermaid called, then includes title in entity definition', () => {
			const alice = createEmployee({ displayName: 'Alice', title: 'Director' });
			const tree = createOrgNode(alice);

			const result = formatAsMermaid(tree, { includeTitle: true });

			expect(result).toContain('title "Director"');
		});

		it('given tree with title disabled, when formatAsMermaid called, then excludes title from entity definition', () => {
			const alice = createEmployee({ displayName: 'Alice', title: 'Director' });
			const tree = createOrgNode(alice);

			const result = formatAsMermaid(tree, { includeTitle: false });

			expect(result).not.toContain('title "Director"');
		});

		it('given tree with includeDepartment option, when formatAsMermaid called, then includes department in entity definition', () => {
			const alice = createEmployee({ displayName: 'Alice', department: 'Engineering' });
			const tree = createOrgNode(alice);

			const result = formatAsMermaid(tree, { includeDepartment: true });

			expect(result).toContain('department "Engineering"');
		});

		it('given tree with direct reports, when formatAsMermaid called, then creates team sections for each report', () => {
			const alice = createEmployee({ displayName: 'Alice', title: 'CEO' });
			const bob = createEmployee({ displayName: 'Bob', title: 'VP Eng', manager: 'Alice' });
			const carol = createEmployee({ displayName: 'Carol', title: 'Eng Manager', manager: 'Bob' });
			const tree = createOrgNode(alice, [createOrgNode(bob, [createOrgNode(carol)])]);

			const result = formatAsMermaid(tree);

			expect(result).toContain("### Bob's Team");
		});

		it('given tree with maxDepth limit, when formatAsMermaid called, then respects depth limit in each team diagram', () => {
			const alice = createEmployee({ displayName: 'Alice' });
			const bob = createEmployee({ displayName: 'Bob', manager: 'Alice' });
			const carol = createEmployee({ displayName: 'Carol', manager: 'Bob' });
			const david = createEmployee({ displayName: 'David', manager: 'Carol' });
			const tree = createOrgNode(alice, [createOrgNode(bob, [createOrgNode(carol, [createOrgNode(david)])])]);

			const result = formatAsMermaid(tree, { maxDepth: 1 });

			expect(result).toContain('Alice');
			expect(result).toContain('Bob');
			expect(result).toContain('Carol');
			expect(result).not.toContain('David');
		});

		it('given tree with breakdown teams option, when formatAsMermaid called, then creates overview and subteam sections', () => {
			const alice = createEmployee({ displayName: 'Alice', title: 'CEO' });
			const bob = createEmployee({ displayName: 'Bob', title: 'VP Eng', manager: 'Alice' });
			const carol = createEmployee({ displayName: 'Carol', title: 'Eng Manager', manager: 'Bob' });
			const david = createEmployee({ displayName: 'David', title: 'Engineer', manager: 'Carol' });
			const eve = createEmployee({ displayName: 'Eve', title: 'Senior Engineer', manager: 'David' });
			const tree = createOrgNode(alice, [
				createOrgNode(bob, [createOrgNode(carol, [createOrgNode(david, [createOrgNode(eve)])])]),
			]);

			const result = formatAsMermaid(tree, {}, ['Bob']);

			expect(result).toContain('#### Overview');
			expect(result).toContain("#### Carol's Subteam");
		});

		it('given single employee tree, when generateIndividualTeamFiles called, then returns map with executive leadership file', () => {
			const alice = createEmployee({ displayName: 'Alice', title: 'CEO' });
			const tree = createOrgNode(alice);

			const result = generateIndividualTeamFiles(tree);

			expect(result.has('executive-leadership.mermaid')).toBe(true);
			expect(result.get('executive-leadership.mermaid')).toContain('erDiagram');
			expect(result.get('executive-leadership.mermaid')).toContain('Alice');
		});

		it('given tree with reports, when generateIndividualTeamFiles called, then creates team files for each report', () => {
			const alice = createEmployee({ displayName: 'Alice', title: 'CEO' });
			const bob = createEmployee({ displayName: 'Bob', title: 'VP Eng', manager: 'Alice' });
			const carol = createEmployee({ displayName: 'Carol', title: 'Eng Manager', manager: 'Bob' });
			const tree = createOrgNode(alice, [createOrgNode(bob, [createOrgNode(carol)])]);

			const result = generateIndividualTeamFiles(tree);

			expect(result.has('executive-leadership.mermaid')).toBe(true);
			expect(result.has('team-bob.mermaid')).toBe(true);
		});
	});
});
