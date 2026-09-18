/**
 * Index file generator for RFP decomposed documents
 */

import path from 'node:path';
import { CATEGORY_DESCRIPTIONS, DEPARTMENT_DESCRIPTIONS } from '../lib/config.js';

// Load descriptions once at module load
import type { MatchedPair } from '../lib/types.js';
import { fileExists, readFile, toKebabCase, writeFile } from '../utils/utils.js';

/**
 * Get department-specific role explanation for a category
 */
function getDepartmentRoleExplanation(department: string, category: string): string {
	const explanations: Record<string, Record<string, string>> = {
		'core-services': {
			standard:
				'Core-services owns these because they represent our fundamental network protocols, routing standards, and technical specifications that remain consistent across all implementations.',
			hybrid: 'Core-services owns these because they involve our standard network designs that must be adapted to client-specific topology while maintaining our core protocols.',
			specific:
				'Core-services owns these because they require custom network architectures designed from scratch based on unique client infrastructure requirements.',
		},
		'operations-engineering-noc': {
			standard:
				'Operations-engineering-noc owns these because they represent our standardized monitoring procedures, incident response protocols, and maintenance schedules.',
			hybrid: 'Operations-engineering-noc owns these because they involve our operational procedures that must align with client-specific SLAs and support windows.',
			specific:
				'Operations-engineering-noc owns these because they require bespoke operational frameworks for unique client environments and requirements.',
		},
		'commercial-service-management': {
			standard:
				'Commercial-service-management owns these because they represent our standard commercial terms, service levels, and contractual frameworks.',
			hybrid: 'Commercial-service-management owns these because they involve our service models adapted to client-specific commercial arrangements.',
			specific:
				'Commercial-service-management owns these because they require custom commercial structures unique to each client relationship.',
		},
		'project-delivery': {
			standard:
				'Project-delivery owns these because they represent our proven project methodologies and delivery frameworks.',
			hybrid: 'Project-delivery owns these because they involve our standard methodologies adapted to client-specific timelines and milestones.',
			specific:
				'Project-delivery owns these because they require custom project approaches for unique client environments.',
		},
		'business-operations': {
			standard:
				'Business-operations owns these because they represent our established security policies, compliance standards, and operational procedures.',
			hybrid: 'Business-operations owns these because they involve our standard processes adapted to client-specific business requirements.',
			specific:
				'Business-operations owns these because they require custom operational solutions for unique client needs.',
		},
		'product-strategy': {
			standard:
				'Product-strategy owns these because they represent our standard product lifecycle and technology roadmap approaches.',
			hybrid: 'Product-strategy owns these because they involve our product strategies adapted to client-specific technology stacks.',
			specific:
				'Product-strategy owns these because they require custom product strategies for unique client technology ecosystems.',
		},
		'finance-hr': {
			standard:
				'Finance-hr owns these because they represent our standard financial and human resource policies.',
			hybrid: 'Finance-hr owns these because they involve our standard approaches adapted to client-specific requirements.',
			specific: 'Finance-hr owns these because they require custom solutions for unique client needs.',
		},
	};

	return (
		explanations[department]?.[category] ||
		`${department} owns these ${category} responses based on their domain expertise in this area.`
	);
}

/**
 * Generate all index files (README.md) for the output structure
 */
export async function generateIndexFiles(
	matchedPairs: MatchedPair[],
	outputDir: string,
	descriptionsDir: string
): Promise<void> {
	// Generate main index
	await generateMainIndex(matchedPairs, outputDir);

	// Get unique categories
	const categories = [...new Set(matchedPairs.map(p => p.Category).filter(Boolean))];

	// Generate category and department indexes
	for (const category of categories) {
		await generateCategoryIndex(category, matchedPairs, outputDir, descriptionsDir);

		// Get departments for this category
		const departments = [
			...new Set(
				matchedPairs
					.filter(p => p.Category === category)
					.map(p => p.Department)
					.filter(Boolean)
			),
		];

		for (const department of departments) {
			await generateDepartmentIndex(category, department, matchedPairs, outputDir, descriptionsDir);
		}
	}
}

/**
 * Generate the main index file
 */
async function generateMainIndex(matchedPairs: MatchedPair[], outputDir: string): Promise<void> {
	const categories = [...new Set(matchedPairs.map(p => p.Category).filter(Boolean))];

	let content = `# RFP Response Documents

This repository contains RFP responses decomposed into individual request/response pairs, organized by reusability pattern (category) and domain expertise (department).

**Purpose**: Each response is isolated to prevent context overload when accessing specific information. For searching across all responses, use doc-indexer vectorized search: \`bun run doc-indexer:search "<query>"\`

**Navigation Structure**:
- **Category** = Reusability pattern (standard/hybrid/specific)
- **Department** = Domain expertise owner
- **Individual files** = Single request/response pairs with full metadata

## Categories

`;

	for (const category of categories.sort()) {
		const categoryPairs = matchedPairs.filter(p => p.Category === category);
		const departmentCount = new Set(categoryPairs.map(p => p.Department)).size;

		content += `### [${category}](${category}/README.md)

- ${categoryPairs.length} responses across ${departmentCount} departments

`;
	}

	content += `## Statistics

- Total Responses: ${matchedPairs.length}
- Categories: ${categories.length}
- Departments: ${new Set(matchedPairs.map(p => p.Department).filter(Boolean)).size}

## How to Navigate This Repository

1. **By known identifier**: If you know the ID (e.g., BR1, MR2), navigate directly via category → department → file
2. **By reusability need**: Start with category (standard = verbatim policy, hybrid = adapt values, specific = full custom)
3. **By department**: Browse responses owned by specific departments (core-services, operations-engineering-noc, etc.)
4. **By search**: Use doc-indexer for semantic search across all responses: \`bun run doc-indexer:search "<your query>"\`

## Understanding the Schema

- **standard**: Established policies that never change in substance (only minor phrasing for natural flow)
- **hybrid**: Template responses where structure stays but values (names, dates, quantities) change
- **specific**: Fully custom responses unique to each client's environment
`;

	await writeFile(path.join(outputDir, 'README.md'), content);
}

/**
 * Generate a category index file
 */
async function generateCategoryIndex(
	category: string,
	matchedPairs: MatchedPair[],
	outputDir: string,
	descriptionsDir: string
): Promise<void> {
	const categoryPairs = matchedPairs.filter(p => p.Category === category);
	const departments = [...new Set(categoryPairs.map(p => p.Department).filter(Boolean))];

	const description = await getCategoryDescription(category, descriptionsDir);

	let content = `# ${category} Category

[← Back to Main Index](../README.md)

${description}

## Departments

`;

	for (const department of departments.sort()) {
		const deptPairs = categoryPairs.filter(p => p.Department === department);

		content += `### [${department}](${department}/README.md)

- ${deptPairs.length} responses
- Lead: ${[...new Set(deptPairs.map(p => p.Leader).filter(Boolean))].join(', ')}

`;
	}

	content += `## Summary

This category contains ${categoryPairs.length} responses that ${category === 'standard' ? 'can be used verbatim across clients' : category === 'hybrid' ? 'combine standard elements with client-specific details' : 'require complete customisation for each client'}.
`;

	await writeFile(path.join(outputDir, category, 'README.md'), content);
}

/**
 * Generate a department index file
 */
async function generateDepartmentIndex(
	category: string,
	department: string,
	matchedPairs: MatchedPair[],
	outputDir: string,
	descriptionsDir: string
): Promise<void> {
	const departmentPairs = matchedPairs.filter(p => p.Category === category && p.Department === department);

	const description = await getDepartmentDescription(department, descriptionsDir);

	let content = `# ${department} Department - ${category} Responses

[← Back to ${category} Category Index](../README.md)

${description}

## Why ${department} Owns These ${category} Responses

${getDepartmentRoleExplanation(department, category)}

## Request/Response Pairs

`;

	// Sort pairs by identifier
	const sortedPairs = [...departmentPairs].sort((a, b) =>
		a.Identifier.localeCompare(b.Identifier, undefined, { numeric: true })
	);

	for (const pair of sortedPairs) {
		const fileNameBase = toKebabCase(pair.Description || pair.Title);
		const fileName = `${pair.Identifier}-${fileNameBase}.md`;

		// Use concise format: "ID: Description" or "ID: Title" if no description
		const displayTitle = `${pair.Identifier}: ${pair.Description || pair.Title}`;

		content += `- [${displayTitle}](${fileName})\n`;
	}

	content += `

## Statistics

- Total Responses: ${departmentPairs.length}
- Requiring customisation: ${departmentPairs.filter(p => p.Customise).length}
- Standard Responses: ${departmentPairs.filter(p => !p.Customise).length}

## Department Lead

${[...new Set(departmentPairs.map(p => p.Leader).filter(Boolean))].join(', ')}
`;

	await writeFile(path.join(outputDir, category, department, 'README.md'), content);
}

/**
 * Get category description from file or default
 */
async function getCategoryDescription(category: string, descriptionsDir: string): Promise<string> {
	const descFile = path.join(descriptionsDir, `${category}-category.md`);

	if (await fileExists(descFile)) {
		try {
			return await readFile(descFile);
		} catch {
			// Fall back to default
		}
	}

	return CATEGORY_DESCRIPTIONS[category] || `This category contains ${category} responses.`;
}

/**
 * Get department description from file or default
 */
async function getDepartmentDescription(department: string, descriptionsDir: string): Promise<string> {
	const descFile = path.join(descriptionsDir, `${department}-department.md`);

	if (await fileExists(descFile)) {
		try {
			return await readFile(descFile);
		} catch {
			// Fall back to default
		}
	}

	return (
		DEPARTMENT_DESCRIPTIONS[department] || `The ${department} department handles various aspects of RFP responses.`
	);
}
