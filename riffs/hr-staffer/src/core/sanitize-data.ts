import type { Employee } from '../lib/types.js';

/**
 * Sanitization options
 */
// TODO these options are not used outside of this module.
// Further, they are not passed to sanitizeEmployees from fullSanitization,
// so they are all set to true by default.
export interface SanitizationOptions {
	trimWhitespace?: boolean;
	normalizeManagerField?: boolean;
	removeQuotes?: boolean;
	normalizeLineBreaks?: boolean;
	escapeMermaidSpecialChars?: boolean;
}

/**
 * Sanitize a single employee record (internal helper)
 */
function sanitizeEmployee(employee: Employee, options: SanitizationOptions = {}): Employee {
	const {
		trimWhitespace = true,
		normalizeManagerField = true,
		removeQuotes = true,
		normalizeLineBreaks = true,
		escapeMermaidSpecialChars = true,
	} = options;

	let sanitized = { ...employee };

	if (trimWhitespace) {
		sanitized = {
			displayName: sanitized.displayName.trim(),
			firstName: sanitized.firstName.trim(),
			lastName: sanitized.lastName.trim(),
			email: sanitized.email.trim(),
			title: sanitized.title.trim(),
			department: sanitized.department.trim(),
			manager: sanitized.manager.trim(),
			mobile: sanitized.mobile.trim(),
			streetAddress: sanitized.streetAddress.trim(),
			city: sanitized.city.trim(),
			country: sanitized.country.trim(),
		};
	}

	if (removeQuotes) {
		sanitized.streetAddress = sanitized.streetAddress.replace(/^["']|["']$/g, '');
	}

	if (normalizeLineBreaks) {
		sanitized.streetAddress = sanitized.streetAddress.replace(/\r\n/g, '\n');
	}

	if (escapeMermaidSpecialChars) {
		// Replace ampersands with 'and' to avoid Mermaid syntax errors
		sanitized.title = sanitized.title.replace(/&/g, 'and');
		sanitized.department = sanitized.department.replace(/&/g, 'and');
	}

	if (normalizeManagerField) {
		// Normalize various ways of indicating "no manager"
		const noManagerVariants = ['no manager', 'none', 'n/a', 'na', '-', ''];

		if (noManagerVariants.includes(sanitized.manager.toLowerCase())) {
			sanitized.manager = 'No Manager';
		}
	}

	return sanitized;
}

/**
 * Sanitize an array of employee records (internal helper)
 */
function sanitizeEmployees(employees: Employee[], options: SanitizationOptions = {}): Employee[] {
	return employees.map(emp => sanitizeEmployee(emp, options));
}

/**
 * Normalize department names by removing extra spaces and standardizing case (internal helper)
 */
function normalizeDepartments(employees: Employee[]): Employee[] {
	return employees.map(emp => ({
		...emp,
		department: emp.department.replace(/\s+/g, ' ').trim(),
	}));
}

/**
 * Fix common manager name mismatches by attempting to match against existing employees (internal helper)
 */
function fixManagerReferences(employees: Employee[]): Employee[] {
	const employeeMap = new Map<string, string>();

	// Build a map of normalized names to actual display names
	employees.forEach(emp => {
		const normalized = emp.displayName.toLowerCase().replace(/\s+/g, '');
		employeeMap.set(normalized, emp.displayName);
	});

	return employees.map(emp => {
		if (!emp.manager || emp.manager === 'No Manager') {
			return emp;
		}

		// Check if manager exists exactly
		const managerExists = employees.some(e => e.displayName === emp.manager);
		if (managerExists) {
			return emp;
		}

		// Try to find a match with normalized names
		const normalizedManager = emp.manager.toLowerCase().replace(/\s+/g, '');
		const matchedName = employeeMap.get(normalizedManager);

		if (matchedName) {
			return {
				...emp,
				manager: matchedName,
			};
		}

		return emp;
	});
}

/**
 * Full sanitization pipeline with all cleaning operations
 */
export function fullSanitization(employees: Employee[]): Employee[] {
	let sanitized = sanitizeEmployees(employees);
	sanitized = normalizeDepartments(sanitized);
	sanitized = fixManagerReferences(sanitized);
	return sanitized;
}
