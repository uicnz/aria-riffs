/**
 * Aria Code Auditor Audit Engine - Core audit functionality
 */

import { existsSync, promises as fs } from 'node:fs';
import path from 'node:path';
import type { Logger } from 'pino';
import type { AuditOptions, AuditResults, DependencyInfo, OutdatedDependency } from '../lib/types.js';
import { runBunCommand } from './bun-cmd.js';

/**
 * Perform complete dependency audit
 */
export async function performAudit(_options: AuditOptions, logger: Logger): Promise<AuditResults> {
	const results: AuditResults = {
		timestamp: new Date().toISOString(),
		dependencies: {
			all: [],
			unused: [],
			outdated: [],
		},
		status: {
			success: true,
			allUsed: true,
			allUpdated: true,
		},
		exitCode: 0,
	};

	try {
		logger.info('Starting dependency audit');

		// Step 1: List all dependencies
		logger.debug('Listing all dependencies');
		const dependencies = await listAllDependencies(logger);
		results.dependencies.all = dependencies;
		logger.debug({ count: dependencies.length }, 'Dependencies found');

		// Step 2: Check for outdated dependencies
		logger.debug('Checking for outdated dependencies');
		const outdated = await findOutdatedDependencies(logger);
		results.dependencies.outdated = outdated;

		if (outdated.length > 0) {
			logger.warn({ count: outdated.length }, 'Outdated dependencies found');
			results.status.allUpdated = false;
		} else {
			logger.info('All dependencies up to date');
		}

		// Step 3: Check for unused dependencies
		logger.debug('Checking for unused dependencies');
		const unused = await findUnusedDependencies(logger);
		results.dependencies.unused = unused;

		if (unused.length > 0) {
			logger.warn({ count: unused.length, packages: unused }, 'Potentially unused dependencies');
			results.status.allUsed = false;
		} else {
			logger.info('All dependencies appear to be in use');
		}

		// Audit completed successfully - exit code 0 regardless of findings
		// Findings (outdated/unused) are results, not errors
		results.exitCode = 0;

		logger.info('Audit completed successfully');
	} catch (error) {
		logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Audit failed');
		results.status.success = false;
		results.exitCode = 4; // General error
	}

	return results;
}

/**
 * List all installed dependencies
 */
export async function listAllDependencies(logger: Logger): Promise<DependencyInfo[]> {
	try {
		logger.debug('Running bun pm ls --json');
		const result = await runBunCommand(['pm', 'ls', '--json']);

		if (!result.success) {
			throw new Error(`Failed to list dependencies: ${result.stderr}`);
		}

		// Parse bun pm ls output
		const listData = JSON.parse(result.stdout || '{}');
		const dependencies: DependencyInfo[] = [];

		interface NpmPackageInfo {
			version: string;
			path: string;
		}

		// Process production dependencies
		if (listData.dependencies) {
			for (const [name, info] of Object.entries(listData.dependencies as Record<string, NpmPackageInfo>)) {
				dependencies.push({
					name,
					current: info.version,
					type: 'production',
					location: info.path,
				});
			}
		}

		// Process dev dependencies
		if (listData.devDependencies) {
			for (const [name, info] of Object.entries(listData.devDependencies as Record<string, NpmPackageInfo>)) {
				dependencies.push({
					name,
					current: info.version,
					type: 'development',
					location: info.path,
				});
			}
		}

		logger.debug({ count: dependencies.length }, 'Listed dependencies from JSON');
		return dependencies;
	} catch (error) {
		// Fallback to text parsing if JSON fails
		logger.debug({ error }, 'JSON parsing failed, falling back to text parsing');
		return await listDependenciesFromText();
	}
}

/**
 * Fallback method to parse dependencies from text output
 */
async function listDependenciesFromText(): Promise<DependencyInfo[]> {
	const result = await runBunCommand(['pm', 'ls']);

	if (!result.success) {
		throw new Error(`Failed to list dependencies: ${result.stderr}`);
	}

	const dependencies: DependencyInfo[] = [];
	const lines = result.stdout.split('\n');

	for (const line of lines) {
		const match = line.match(/[├└]── ([^@\s]+)@([^\s]+)/);
		if (match) {
			dependencies.push({
				name: match[1],
				current: match[2],
				type: 'production', // Can't determine type from text output
			});
		}
	}

	return dependencies;
}

/**
 * Find outdated dependencies
 */
export async function findOutdatedDependencies(logger: Logger): Promise<OutdatedDependency[]> {
	try {
		logger.debug('Running bun outdated --json');
		const result = await runBunCommand(['outdated', '--json']);

		// npm outdated returns non-zero exit code when outdated packages are found
		if (result.stdout) {
			interface NpmOutdatedInfo {
				current: string;
				wanted: string;
				latest: string;
				type?: string;
				location?: string;
			}

			const outdatedData = JSON.parse(result.stdout);
			const outdated: OutdatedDependency[] = [];

			for (const [name, info] of Object.entries(outdatedData as Record<string, NpmOutdatedInfo>)) {
				const depType = info.type as 'production' | 'development' | 'peer' | 'optional' | undefined;
				outdated.push({
					name,
					current: info.current,
					wanted: info.wanted,
					latest: info.latest,
					type: depType || 'production',
					location: info.location,
				});
			}

			logger.debug({ count: outdated.length }, 'Found outdated dependencies from JSON');
			return outdated;
		}

		return [];
	} catch (error) {
		// Fallback to text parsing
		logger.debug({ error }, 'JSON parsing failed, falling back to text parsing');
		return findOutdatedFromText();
	}
}

/**
 * Fallback method to parse outdated dependencies from text output
 */
async function findOutdatedFromText(): Promise<OutdatedDependency[]> {
	const result = await runBunCommand(['outdated']);
	const outdated: OutdatedDependency[] = [];

	if (!result.stdout) {
		return outdated;
	}

	const lines = result.stdout.split('\n').slice(1); // Skip header

	for (const line of lines) {
		if (line.trim()) {
			const parts = line.trim().split(/\s+/);
			if (parts.length >= 4) {
				outdated.push({
					name: parts[0],
					current: parts[1],
					wanted: parts[2],
					latest: parts[3],
					type: 'production', // Can't determine type from text output
				});
			}
		}
	}

	return outdated;
}

/**
 * Find potentially unused dependencies
 */
export async function findUnusedDependencies(logger: Logger): Promise<string[]> {
	try {
		// Get package.json to find all declared dependencies
		const packagePath = path.join(process.cwd(), 'package.json');
		if (!existsSync(packagePath)) {
			throw new Error('package.json not found');
		}

		const packageContent = await fs.readFile(packagePath, 'utf8');
		const packageJson = JSON.parse(packageContent);

		const allDependencies = [
			...Object.keys(packageJson.dependencies || {}),
			...Object.keys(packageJson.devDependencies || {}),
		];

		if (allDependencies.length === 0) {
			logger.debug('No dependencies found in package.json');
			return [];
		}

		logger.debug({ count: allDependencies.length }, 'Checking dependencies for usage');

		// Search for usage in source files
		const unusedDependencies = [];

		for (const depName of allDependencies) {
			const isUsed = await isDependencyUsed(depName, logger);
			if (!isUsed) {
				unusedDependencies.push(depName);
			}
		}

		logger.debug({ count: unusedDependencies.length }, 'Found potentially unused dependencies');
		return unusedDependencies;
	} catch (error) {
		logger.warn(
			{ error: error instanceof Error ? error.message : 'Unknown error' },
			'Could not check for unused dependencies'
		);
		return [];
	}
}

/**
 * Check if a dependency is used in the codebase
 */
async function isDependencyUsed(depName: string, logger: Logger): Promise<boolean> {
	const searchDirs = ['src', 'lib', 'dist', 'index.js', 'server.js', 'app.js'];
	const extensions = ['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs'];

	try {
		// Common import patterns to search for
		const patterns = [
			`require('${depName}')`,
			`require("${depName}")`,
			`from '${depName}'`,
			`from "${depName}"`,
			`import '${depName}'`,
			`import "${depName}"`,
			`import(${depName})`,
			`@import '${depName}'`,
			`@import "${depName}"`,
		];

		// Search in package.json scripts
		const packagePath = path.join(process.cwd(), 'package.json');
		const packageContent = await fs.readFile(packagePath, 'utf8');

		for (const pattern of patterns) {
			if (packageContent.includes(pattern) || packageContent.includes(depName)) {
				return true;
			}
		}

		// Search in source files
		for (const searchDir of searchDirs) {
			const dirPath = path.join(process.cwd(), searchDir);
			if (existsSync(dirPath)) {
				const isUsedInDir = await searchInDirectory(dirPath, patterns, extensions);
				if (isUsedInDir) {
					return true;
				}
			}
		}

		// Check root level common files
		const rootFiles = ['index.js', 'index.ts', 'app.js', 'server.js', 'main.js'];
		for (const fileName of rootFiles) {
			const filePath = path.join(process.cwd(), fileName);
			if (existsSync(filePath)) {
				const content = await fs.readFile(filePath, 'utf8');
				for (const pattern of patterns) {
					if (content.includes(pattern)) {
						return true;
					}
				}
			}
		}

		return false;
	} catch (error) {
		// If we can't determine usage, assume it's used to be safe
		logger.warn(
			{ dependency: depName, error: error instanceof Error ? error.message : 'Unknown error' },
			'Could not verify dependency usage'
		);
		return true;
	}
}

/**
 * Search for patterns in directory recursively
 */
async function searchInDirectory(dirPath: string, patterns: string[], extensions: string[]): Promise<boolean> {
	try {
		const entries = await fs.readdir(dirPath, { withFileTypes: true });

		for (const entry of entries) {
			const entryPath = path.join(dirPath, entry.name);

			if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
				const found = await searchInDirectory(entryPath, patterns, extensions);
				if (found) return true;
			} else if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {
				const content = await fs.readFile(entryPath, 'utf8');
				for (const pattern of patterns) {
					if (content.includes(pattern)) {
						return true;
					}
				}
			}
		}

		return false;
	} catch {
		return false;
	}
}

/**
 * Extract dependency names from npm list output
 */
export function extractDependencyNames(output: string): string[] {
	const dependencies: string[] = [];
	const lines = output.split('\n');

	for (const line of lines) {
		const match = line.match(/[├└]── ([^@\s]+)/);
		if (match) {
			dependencies.push(match[1]);
		}
	}

	return dependencies;
}
