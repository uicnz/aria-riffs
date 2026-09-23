import type { Employee } from '../lib/types.js';

/**
 * Validation result containing any errors or warnings
 */
export interface ValidationResult {
	valid: boolean;
	errors: string[];
	warnings: string[];
}

/**
 * Validation options
 */
export interface ValidationOptions {
	requireUniqueNames?: boolean;
	requireUniqueEmails?: boolean;
	allowOrphans?: boolean;
	requireMobileNumbers?: boolean;
}

/**
 * Validate employee data structure and relationships
 */
export function validateEmployees(employees: Employee[], options: ValidationOptions = {}): ValidationResult {
	const {
		requireUniqueNames = true,
		requireUniqueEmails = true,
		allowOrphans = false,
		requireMobileNumbers = false,
	} = options;

	const errors: string[] = [];
	const warnings: string[] = [];

	if (employees.length === 0) {
		errors.push('No employees found in data');
		return { valid: false, errors, warnings };
	}

	// Check for root employee
	const rootEmployees = employees.filter(
		emp => emp.manager === 'No Manager' || emp.manager === '' || emp.manager.toLowerCase() === 'none'
	);

	if (rootEmployees.length === 0) {
		errors.push('No root employee found (no employee with "No Manager")');
	} else if (rootEmployees.length > 1) {
		errors.push(`Multiple root employees found: ${rootEmployees.map(e => e.displayName).join(', ')}`);
	}

	// Check for required fields
	employees.forEach((emp, index) => {
		if (!emp.displayName || emp.displayName.trim() === '') {
			errors.push(`Employee at index ${index} has no display name`);
		}
		if (!emp.email || emp.email.trim() === '') {
			errors.push(`Employee "${emp.displayName}" has no email address`);
		}
		if (!emp.title || emp.title.trim() === '') {
			warnings.push(`Employee "${emp.displayName}" has no title`);
		}
		if (!emp.department || emp.department.trim() === '') {
			warnings.push(`Employee "${emp.displayName}" has no department`);
		}
		if (requireMobileNumbers && (!emp.mobile || emp.mobile.trim() === '' || emp.mobile === 'Unlisted')) {
			warnings.push(`Employee "${emp.displayName}" has no mobile number`);
		}
	});

	// Check for duplicate display names
	if (requireUniqueNames) {
		const nameMap = new Map<string, number>();
		employees.forEach(emp => {
			const count = nameMap.get(emp.displayName) || 0;
			nameMap.set(emp.displayName, count + 1);
		});

		nameMap.forEach((count, name) => {
			if (count > 1) {
				errors.push(`Duplicate display name found: "${name}" (${count} occurrences)`);
			}
		});
	}

	// Check for duplicate email addresses
	if (requireUniqueEmails) {
		const emailMap = new Map<string, string[]>();
		employees.forEach(emp => {
			if (emp.email) {
				const names = emailMap.get(emp.email) || [];
				names.push(emp.displayName);
				emailMap.set(emp.email, names);
			}
		});

		emailMap.forEach((names, email) => {
			if (names.length > 1) {
				errors.push(`Duplicate email address "${email}" used by: ${names.join(', ')}`);
			}
		});
	}

	// Check for invalid manager references
	const employeeNames = new Set(employees.map(emp => emp.displayName));
	employees.forEach(emp => {
		if (
			emp.manager &&
			emp.manager !== 'No Manager' &&
			emp.manager !== '' &&
			emp.manager.toLowerCase() !== 'none' &&
			!employeeNames.has(emp.manager)
		) {
			errors.push(`Employee "${emp.displayName}" has invalid manager reference: "${emp.manager}"`);
		}
	});

	// Check for orphaned employees (employees not in any reporting chain)
	if (!allowOrphans && rootEmployees.length === 1) {
		const reachableNames = new Set<string>();
		const queue: Employee[] = [rootEmployees[0]];
		const processedObjects = new WeakSet<Employee>();

		while (queue.length > 0) {
			const current = queue.shift();
			if (!current) break;

			// Skip if we've already processed this exact object instance
			if (processedObjects.has(current)) continue;
			processedObjects.add(current);

			reachableNames.add(current.displayName);

			const directReports = employees.filter(emp => emp.manager === current.displayName);
			queue.push(...directReports);
		}

		employees.forEach(emp => {
			if (!reachableNames.has(emp.displayName)) {
				warnings.push(`Employee "${emp.displayName}" is not reachable from root (orphaned employee)`);
			}
		});
	}

	// Check for circular reporting relationships
	const employeeMap = new Map<string, Employee>();
	employees.forEach(emp => {
		employeeMap.set(emp.displayName, emp);
	});

	employees.forEach(emp => {
		const visited = new Set<string>();
		let current: Employee | undefined = emp;

		while (current?.manager && current.manager !== 'No Manager') {
			if (visited.has(current.displayName)) {
				errors.push(`Circular reporting relationship detected involving "${emp.displayName}"`);
				break;
			}

			visited.add(current.displayName);
			current = employeeMap.get(current.manager);
		}
	});

	return {
		valid: errors.length === 0,
		errors,
		warnings,
	};
}

/**
 * Validate email format (internal helper)
 */
function isValidEmail(email: string): boolean {
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	return emailRegex.test(email);
}

/**
 * Validate all email addresses in employee list
 */
export function validateEmails(employees: Employee[]): ValidationResult {
	const errors: string[] = [];
	const warnings: string[] = [];

	employees.forEach(emp => {
		if (emp.email && !isValidEmail(emp.email)) {
			errors.push(`Invalid email format for "${emp.displayName}": ${emp.email}`);
		}
	});

	return {
		valid: errors.length === 0,
		errors,
		warnings,
	};
}
