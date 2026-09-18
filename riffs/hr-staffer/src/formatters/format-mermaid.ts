import type { FormatOptions, OrgNode } from '../lib/types.js';

/**
 * Format org tree as multiple ERDs - one for each top-level branch
 * This creates vertical, readable diagrams instead of one horizontal mess
 */
export function formatAsMermaid(node: OrgNode, options: FormatOptions = {}, breakDownTeams: string[] = []): string {
	const { includeTitle = true, includeDepartment = false, maxDepth = Infinity } = options;

	const sections: string[] = [];

	// First, create a diagram showing the CEO and their direct reports
	sections.push('### Executive Leadership');
	sections.push('');
	sections.push('```mermaid');
	sections.push('erDiagram');

	const ceoId = getNodeId(node.employee.displayName);
	const ceoEmp = node.employee;

	// Define CEO entity
	const ceoEntity = generateEntityDefinition(ceoId, ceoEmp, includeTitle, includeDepartment);
	sections.push(...ceoEntity);

	// Define all direct report entities first
	for (const report of node.directReports) {
		const reportId = getNodeId(report.employee.displayName);
		const reportEmp = report.employee;

		const reportEntity = generateEntityDefinition(reportId, reportEmp, includeTitle, includeDepartment);
		sections.push(...reportEntity);
	}

	// Then add all relationships
	for (const report of node.directReports) {
		const reportId = getNodeId(report.employee.displayName);
		sections.push(`    ${ceoId} ||--o{ ${reportId} : manages`);
	}

	sections.push('```');
	sections.push('');

	// Now create separate diagrams for each C-level executive's team
	for (const report of node.directReports) {
		if (report.directReports.length > 0) {
			const shouldBreakDown = breakDownTeams.includes(report.employee.displayName);

			sections.push('---');
			sections.push('');
			sections.push(`### ${report.employee.displayName}'s Team`);
			sections.push('');

			if (shouldBreakDown) {
				// Show overview + subteams
				sections.push('#### Overview');
				sections.push('');
				sections.push('```mermaid');
				sections.push('erDiagram');

				const leaderId = getNodeId(report.employee.displayName);
				const leaderEmp = report.employee;

				// Define leader entity
				const leaderEntity = generateEntityDefinition(leaderId, leaderEmp, includeTitle, includeDepartment);
				sections.push(...leaderEntity);

				// Define direct reports
				for (const subReport of report.directReports) {
					const subReportId = getNodeId(subReport.employee.displayName);
					const subReportEmp = subReport.employee;

					const subReportEntity = generateEntityDefinition(
						subReportId,
						subReportEmp,
						includeTitle,
						includeDepartment
					);
					sections.push(...subReportEntity);

					// Add relationship
					sections.push(`    ${leaderId} ||--o{ ${subReportId} : manages`);
				}

				sections.push('```');
				sections.push('');

				// Now add each subteam
				for (const subReport of report.directReports) {
					if (subReport.directReports.length > 0) {
						sections.push('---');
						sections.push('');
						sections.push(`#### ${subReport.employee.displayName}'s Subteam`);
						sections.push('');
						sections.push('```mermaid');
						const subTeamDiagram = buildBranchERD(subReport, options, 1, maxDepth);
						sections.push(subTeamDiagram);
						sections.push('```');
						sections.push('');
					}
				}
			} else {
				// Show normal full team diagram
				sections.push('```mermaid');
				const branchDiagram = buildBranchERD(report, options, 1, maxDepth);
				sections.push(branchDiagram);
				sections.push('```');
				sections.push('');
			}
		}
	}

	return sections.join('\n');
}

/**
 * Generate a safe entity ID
 */
function getNodeId(displayName: string): string {
	return displayName.replace(/[^a-zA-Z0-9]/g, '_');
}

/**
 * Generate complete entity definition with all fields
 */
function generateEntityDefinition(
	nodeId: string,
	employee: {
		displayName: string;
		title: string;
		department: string;
		manager: string;
		email: string;
		mobile: string;
		streetAddress: string;
		city: string;
		country: string;
	},
	includeTitle: boolean,
	includeDepartment: boolean
): string[] {
	const lines: string[] = [];
	lines.push(`    ${nodeId} {`);
	lines.push(`        string display_name "${employee.displayName}"`);

	if (includeTitle) {
		lines.push(`        string title "${employee.title}"`);
	}

	if (includeDepartment) {
		lines.push(`        string department "${employee.department}"`);
	}

	// Always include manager for explicit reporting line
	lines.push(`        string manager "${employee.manager}"`);

	lines.push(`        string email "${employee.email}"`);
	lines.push(`        string mobile "${employee.mobile}"`);
	lines.push(`        string street_address "${employee.streetAddress}"`);
	lines.push(`        string city "${employee.city}"`);
	lines.push(`        string country "${employee.country}"`);
	lines.push(`    }`);

	return lines;
}

/**
 * Generate a sanitized filename from a display name and type
 * @param displayName - Employee display name (e.g., "John Smith")
 * @param type - File type: "team", "subteam", "overview", or "executive-leadership"
 * @returns Sanitized filename (e.g., "team-john-smith.mermaid")
 */
function generateMermaidFilename(displayName: string, type: string): string {
	// Convert to lowercase, replace spaces and special chars with dashes
	const sanitized = displayName
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, ''); // Remove leading/trailing dashes

	return `${type}-${sanitized}.mermaid`;
}

/**
 * Build a single ERD for a branch of the organization
 */
function buildBranchERD(rootNode: OrgNode, options: FormatOptions, currentDepth: number, maxDepth: number): string {
	const { includeTitle = true, includeDepartment = false } = options;

	const entities: string[] = [];
	const relationships: string[] = [];
	const processedNodes = new Set<string>();

	function collectNodesAndRelationships(node: OrgNode, depth: number): void {
		if (depth > maxDepth) {
			return;
		}

		const nodeId = getNodeId(node.employee.displayName);
		const emp = node.employee;

		// Define entity with structured fields only once
		if (!processedNodes.has(nodeId)) {
			processedNodes.add(nodeId);

			const entityLines = generateEntityDefinition(nodeId, emp, includeTitle, includeDepartment);
			entities.push(entityLines.join('\n'));
		}

		// Collect relationships
		for (const report of node.directReports) {
			const reportId = getNodeId(report.employee.displayName);
			relationships.push(`    ${nodeId} ||--o{ ${reportId} : manages`);
			collectNodesAndRelationships(report, depth + 1);
		}
	}

	collectNodesAndRelationships(rootNode, currentDepth);

	// Build final diagram: header, then all entities, then all relationships
	const lines: string[] = ['erDiagram'];
	lines.push(...entities);
	lines.push(...relationships);

	return lines.join('\n');
}

/**
 * Generate individual mermaid files for each team
 * Returns a map of filename -> pure mermaid content
 */
export function generateIndividualTeamFiles(
	node: OrgNode,
	options: FormatOptions = {},
	breakDownTeams: string[] = []
): Map<string, string> {
	const { includeTitle = true, includeDepartment = false, maxDepth = Infinity } = options;

	const files = new Map<string, string>();

	// Generate executive leadership file
	const ceoLines: string[] = ['erDiagram'];
	const ceoId = getNodeId(node.employee.displayName);
	const ceoEmp = node.employee;

	// Define CEO entity
	const ceoEntity = generateEntityDefinition(ceoId, ceoEmp, includeTitle, includeDepartment);
	ceoLines.push(...ceoEntity);

	// Define all direct report entities
	for (const report of node.directReports) {
		const reportId = getNodeId(report.employee.displayName);
		const reportEmp = report.employee;

		const reportEntity = generateEntityDefinition(reportId, reportEmp, includeTitle, includeDepartment);
		ceoLines.push(...reportEntity);
	}

	// Add relationships
	for (const report of node.directReports) {
		const reportId = getNodeId(report.employee.displayName);
		ceoLines.push(`    ${ceoId} ||--o{ ${reportId} : manages`);
	}

	files.set('executive-leadership.mermaid', ceoLines.join('\n'));

	// Generate individual team files
	for (const report of node.directReports) {
		if (report.directReports.length > 0) {
			const shouldBreakDown = breakDownTeams.includes(report.employee.displayName);

			if (shouldBreakDown) {
				// Generate overview file (just this leader + their direct reports)
				const overviewLines: string[] = ['erDiagram'];
				const leaderId = getNodeId(report.employee.displayName);
				const leaderEmp = report.employee;

				// Define leader entity
				const leaderEntity = generateEntityDefinition(leaderId, leaderEmp, includeTitle, includeDepartment);
				overviewLines.push(...leaderEntity);

				// Define direct reports
				for (const subReport of report.directReports) {
					const subReportId = getNodeId(subReport.employee.displayName);
					const subReportEmp = subReport.employee;

					const subReportEntity = generateEntityDefinition(
						subReportId,
						subReportEmp,
						includeTitle,
						includeDepartment
					);
					overviewLines.push(...subReportEntity);

					// Add relationship
					overviewLines.push(`    ${leaderId} ||--o{ ${subReportId} : manages`);
				}

				const overviewFilename = generateMermaidFilename(report.employee.displayName, 'overview');
				files.set(overviewFilename, overviewLines.join('\n'));

				// Generate individual files for each sub-team
				for (const subReport of report.directReports) {
					if (subReport.directReports.length > 0) {
						const subTeamDiagram = buildBranchERD(subReport, options, 1, maxDepth);
						const subFilename = generateMermaidFilename(subReport.employee.displayName, 'subteam');
						files.set(subFilename, subTeamDiagram);
					}
				}
			} else {
				// Generate normal team file
				const teamDiagram = buildBranchERD(report, options, 1, maxDepth);
				const filename = generateMermaidFilename(report.employee.displayName, 'team');
				files.set(filename, teamDiagram);
			}
		}
	}

	return files;
}
