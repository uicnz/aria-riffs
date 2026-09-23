import { describe, expect, it } from 'vitest';
import { validateEmployees } from '../../src/core/validate-employees.js';

describe('validate-employees-single', () => {
	it('given empty employee list, when validateEmployees called, then returns error', () => {
		const result = validateEmployees([]);
		expect(result.valid).toBe(false);
		expect(result.errors).toContain('No employees found in data');
	});
});
