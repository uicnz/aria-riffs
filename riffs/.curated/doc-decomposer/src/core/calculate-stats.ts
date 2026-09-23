/**
 * Statistics generator for RFP decomposition
 */

import path from 'node:path';
import type { CategoryStats, DecomposeStats, DepartmentStats, LeaderStats, MatchedPair } from '../lib/types.js';
import { percentage, writeFile } from '../utils/utils.js';

/**
 * Generate statistics for the decomposition
 */
export function calculateStatistics(matchedPairs: MatchedPair[]): DecomposeStats {
	const totalPairs = matchedPairs.length;

	// Calculate category statistics
	const categoryMap = new Map<string, number>();
	for (const pair of matchedPairs) {
		if (pair.Category) {
			categoryMap.set(pair.Category, (categoryMap.get(pair.Category) || 0) + 1);
		}
	}

	const categories: CategoryStats[] = Array.from(categoryMap.entries()).map(([category, count]) => ({
		category,
		count,
		percentage: percentage(count, totalPairs),
	}));

	// Calculate department statistics
	const departmentMap = new Map<string, number>();
	for (const pair of matchedPairs) {
		if (pair.Department) {
			departmentMap.set(pair.Department, (departmentMap.get(pair.Department) || 0) + 1);
		}
	}

	const departments: DepartmentStats[] = Array.from(departmentMap.entries()).map(([department, count]) => ({
		department,
		count,
		percentage: percentage(count, totalPairs),
	}));

	// Calculate leader statistics
	const leaderMap = new Map<string, number>();
	for (const pair of matchedPairs) {
		if (pair.Leader) {
			leaderMap.set(pair.Leader, (leaderMap.get(pair.Leader) || 0) + 1);
		}
	}

	const leaders: LeaderStats[] = Array.from(leaderMap.entries()).map(([Leader, count]) => ({
		Leader,
		count,
		percentage: percentage(count, totalPairs),
	}));

	// Calculate customisation statistics
	const customCount = matchedPairs.filter(p => p.Customise).length;
	const standardCount = totalPairs - customCount;

	return {
		totalPairs,
		categories: categories.sort((a, b) => b.count - a.count),
		departments: departments.sort((a, b) => b.count - a.count),
		leaders: leaders.sort((a, b) => b.count - a.count),
		customCount,
		standardCount,
	};
}

/**
 * Generate statistics report file
 */
export async function generateStatisticsReport(matchedPairs: MatchedPair[], outputDir: string): Promise<void> {
	const stats = calculateStatistics(matchedPairs);

	const content = buildStatisticsContent(stats, matchedPairs);

	await writeFile(path.join(outputDir, 'STATISTICS.md'), content);
}

/**
 * Build the statistics report content
 */
function buildStatisticsContent(stats: DecomposeStats, matchedPairs: MatchedPair[]): string {
	const { totalPairs, categories, departments, leaders, customCount, standardCount } = stats;

	const customPercentage = percentage(customCount, totalPairs);
	const standardPercentage = percentage(standardCount, totalPairs);

	let content = `# RFP Decomposition Statistics

Generated: ${new Date().toISOString()}

## Overview

- **Total Request/Response Pairs**: ${totalPairs}
- **Categories**: ${categories.length}
- **Departments**: ${departments.length}
- **Department Leads**: ${leaders.length}
- **Requiring customisation**: ${customCount} (${customPercentage}%)
- **Standard Responses**: ${standardCount} (${standardPercentage}%)

## Categories Distribution

| Category | Count | Percentage |
|----------|-------|------------|
`;

	for (const cat of categories) {
		content += `| ${cat.category} | ${cat.count} | ${cat.percentage}% |\n`;
	}

	content += `
## Department Distribution

| Department | Count | Percentage |
|------------|-------|------------|
`;

	for (const dept of departments) {
		content += `| ${dept.department} | ${dept.count} | ${dept.percentage}% |\n`;
	}

	content += `
## Department Lead Workload

| Lead | Count | Percentage |
|------|-------|------------|
`;

	for (const lead of leaders) {
		content += `| ${lead.Leader} | ${lead.count} | ${lead.percentage}% |\n`;
	}

	content += `
## Response Type Analysis

### By customisation Requirement

- **Requires customisation**: ${customCount} responses (${customPercentage}%)
  - These responses need adaptation for each specific client
  - Includes both hybrid and specific categories

- **Standard Responses**: ${standardCount} responses (${standardPercentage}%)
  - These can be used verbatim across different clients
  - Minimal to no customisation required

### By Category Type

`;

	for (const cat of categories) {
		content += `#### ${cat.category} (${cat.count} responses)

- ${cat.category === 'standard' ? 'Fully reusable, copy-and-paste responses' : cat.category === 'hybrid' ? 'Mix of standard framework with client-specific details' : 'Completely customised for each client'}
- customisation Required: ${cat.category === 'standard' ? 'No' : 'Yes'}

`;
	}

	content += `## Priority Distribution

`;

	// Calculate priority distribution
	const priorityMap = new Map<string, number>();
	for (const pair of matchedPairs) {
		if (pair.Priority) {
			priorityMap.set(pair.Priority, (priorityMap.get(pair.Priority) || 0) + 1);
		}
	}

	if (priorityMap.size > 0) {
		content += `| Priority | Count | Percentage |
|----------|-------|------------|
`;

		for (const [priority, count] of priorityMap) {
			content += `| ${priority} | ${count} | ${percentage(count, totalPairs)}% |\n`;
		}
	} else {
		content += `Priority data not available in current statistics.
`;
	}

	return content;
}

/**
 * Generate a summary statistics object for logging
 */
export function getSummaryStats(stats: DecomposeStats): string {
	const lines = [
		`Total Pairs: ${stats.totalPairs}`,
		`Categories: ${stats.categories.map(c => `${c.category}(${c.count})`).join(', ')}`,
		`Departments: ${stats.departments.length}`,
		`Leaders: ${stats.leaders.length}`,
		`customisation Required: ${stats.customCount}/${stats.totalPairs}`,
	];

	return lines.join('\n');
}

/**
 * Validate statistics for completeness
 */
export function validateStatistics(
	stats: DecomposeStats,
	matchedPairs: MatchedPair[]
): { valid: boolean; warnings: string[] } {
	const warnings: string[] = [];

	// Check if all pairs are accounted for
	const categorizedCount = stats.categories.reduce((sum, cat) => sum + cat.count, 0);
	if (categorizedCount !== stats.totalPairs) {
		warnings.push(`Category count mismatch: ${categorizedCount} vs ${stats.totalPairs}`);
	}

	// Check for missing categories
	const pairsWithoutCategory = matchedPairs.filter(p => !p.Category).length;
	if (pairsWithoutCategory > 0) {
		warnings.push(`${pairsWithoutCategory} pairs missing category`);
	}

	// Check for missing departments
	const pairsWithoutDepartment = matchedPairs.filter(p => !p.Department).length;
	if (pairsWithoutDepartment > 0) {
		warnings.push(`${pairsWithoutDepartment} pairs missing department`);
	}

	// Check for missing leaders
	const pairsWithoutLeader = matchedPairs.filter(p => !p.Leader).length;
	if (pairsWithoutLeader > 0) {
		warnings.push(`${pairsWithoutLeader} pairs missing leader`);
	}

	// Check customisation consistency
	const actualCustomCount = matchedPairs.filter(p => p.Customise).length;
	if (actualCustomCount !== stats.customCount) {
		warnings.push(`Custom count mismatch: ${actualCustomCount} vs ${stats.customCount}`);
	}

	return {
		valid: warnings.length === 0,
		warnings,
	};
}
