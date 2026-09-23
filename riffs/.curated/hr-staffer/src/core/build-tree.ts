import type { Employee, OrgNode } from '../lib/types.js';

/**
 * Find the root employee (the one with no manager)
 */
function findRoot(employees: Employee[]): Employee {
	const roots = employees.filter(
		emp => emp.manager === 'No Manager' || emp.manager === '' || emp.manager.toLowerCase() === 'none'
	);

	if (roots.length === 0) {
		throw new Error('No root employee found (no employee with "No Manager")');
	}

	if (roots.length > 1) {
		throw new Error(`Multiple root employees found: ${roots.map(r => r.displayName).join(', ')}`);
	}

	return roots[0];
}

/**
 * Build organizational tree from flat list of employees
 */
export function buildOrgTree(employees: Employee[]): OrgNode {
	const root = findRoot(employees);

	/**
	 * Recursively build the tree for a given employee
	 */
	function buildNode(employee: Employee): OrgNode {
		// Find all direct reports for this employee
		const directReports = employees
			.filter(emp => emp.manager === employee.displayName)
			.map(emp => buildNode(emp))
			.sort((a, b) => a.employee.displayName.localeCompare(b.employee.displayName));

		return {
			employee,
			directReports,
		};
	}

	return buildNode(root);
}

/**
 * Calculate the maximum depth of the org tree
 */
export function getTreeDepth(node: OrgNode, currentDepth = 0): number {
	if (node.directReports.length === 0) {
		return currentDepth;
	}

	const childDepths = node.directReports.map(child => getTreeDepth(child, currentDepth + 1));

	return Math.max(...childDepths);
}

/**
 * Count total number of employees in the tree
 */
export function countEmployees(node: OrgNode): number {
	return 1 + node.directReports.reduce((sum, child) => sum + countEmployees(child), 0);
}
