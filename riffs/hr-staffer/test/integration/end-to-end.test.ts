import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildOrgTree, countEmployees, getTreeDepth } from '../../src/core/build-tree.js';
import { parseCSV } from '../../src/core/parse-csv.js';
import { fullSanitization } from '../../src/core/sanitize-data.js';
import { validateEmails, validateEmployees } from '../../src/core/validate-employees.js';
import { formatAsMarkdown } from '../../src/formatters/format-markdown.js';
import { formatAsMermaid } from '../../src/formatters/format-mermaid.js';
import { formatAsText } from '../../src/formatters/format-text.js';

describe('end-to-end workflow', () => {
	const testDbDir = '/tmp/hr-staffer-e2e-test';
	const fixturePath = path.resolve('./riffs/hr-staffer/test/fixtures');

	beforeEach(() => {
		mkdirSync(testDbDir, { recursive: true });
	});

	afterEach(() => {
		try {
			rmSync(testDbDir, { recursive: true, force: true });
		} catch {
			// Cleanup failure is not critical
		}
	});

	describe('complete workflow', () => {
		it('given minimal CSV file, when processed through full pipeline, then produces valid organizational tree with all formats', () => {
			// Parse CSV
			const csvPath = path.join(fixturePath, 'minimal-org.csv');
			let employees = parseCSV(csvPath);

			expect(employees).toHaveLength(2);

			// Sanitize data
			employees = fullSanitization(employees);

			expect(employees).toHaveLength(2);

			// Validate structure
			const structureValidation = validateEmployees(employees);

			expect(structureValidation.valid).toBe(true);
			expect(structureValidation.errors).toHaveLength(0);

			// Validate emails
			const emailValidation = validateEmails(employees);

			expect(emailValidation.valid).toBe(true);
			expect(emailValidation.errors).toHaveLength(0);

			// Build tree
			const tree = buildOrgTree(employees);

			expect(tree.employee.displayName).toBe('Jane Doe');
			expect(tree.directReports).toHaveLength(1);

			// Verify tree metrics
			const depth = getTreeDepth(tree);
			const count = countEmployees(tree);

			expect(depth).toBe(1);
			expect(count).toBe(2);

			// Generate formats
			const textOutput = formatAsText(tree);
			const markdownOutput = formatAsMarkdown(tree);
			const mermaidOutput = formatAsMermaid(tree);

			expect(textOutput).toContain('Jane Doe');
			expect(markdownOutput).toContain('# Organization Chart');
			expect(mermaidOutput).toContain('erDiagram');
		});
	});
});
