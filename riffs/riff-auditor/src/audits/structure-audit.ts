/**
 * Structure audits - checks for required directories and empty directories
 */

import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { isDirectory } from './utils.js';

// =============================================================================
// TYPES
// =============================================================================

export interface StructureAuditOptions {
	allowGitkeepPlaceholders: boolean;
}

export interface StructureAuditResult {
	// Root documentation
	readmeExists: boolean;
	// Test directories
	testUnitDirExists: boolean;
	testUnitDirHasFiles: boolean;
	testIntegrationDirExists: boolean;
	testIntegrationDirHasFiles: boolean;
	// Source directories
	tuiDirExists: boolean;
	tuiDirHasFiles: boolean;
	coreDirExists: boolean;
	coreDirHasFiles: boolean;
	libDirExists: boolean;
	libDirHasFiles: boolean;
	auditsDirExists: boolean;
	auditsDirHasFiles: boolean;
	// Empty directories found
	emptyDirectories: string[];
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function directoryHasFiles(dirPath: string, allowGitkeep: boolean): boolean {
	if (!isDirectory(dirPath)) return false;
	try {
		const entries = readdirSync(dirPath, { withFileTypes: true });
		// Check if there are any files (not just subdirectories)
		// .gitkeep only counts as valid when allowGitkeepPlaceholders is true
		return entries.some(entry => {
			if (!entry.isFile()) return false;
			if (!allowGitkeep && entry.name === '.gitkeep') return false;
			return true;
		});
	} catch {
		return false;
	}
}

function directoryHasAnyContent(dirPath: string, allowGitkeep: boolean): boolean {
	if (!isDirectory(dirPath)) return false;
	try {
		const entries = readdirSync(dirPath);
		if (!allowGitkeep) {
			// Exclude .gitkeep when not allowed
			return entries.some(name => name !== '.gitkeep');
		}
		return entries.length > 0;
	} catch {
		return false;
	}
}

function findEmptyDirectories(basePath: string, relativePath = ''): string[] {
	const emptyDirs: string[] = [];
	const fullPath = relativePath ? resolve(basePath, relativePath) : basePath;

	if (!isDirectory(fullPath)) return emptyDirs;

	try {
		const entries = readdirSync(fullPath, { withFileTypes: true });

		if (entries.length === 0) {
			// This directory is empty
			emptyDirs.push(relativePath || '.');
		} else {
			// Check subdirectories recursively
			for (const entry of entries) {
				if (entry.isDirectory()) {
					const subPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
					emptyDirs.push(...findEmptyDirectories(basePath, subPath));
				}
			}
		}
	} catch {
		// Ignore errors
	}

	return emptyDirs;
}

// =============================================================================
// MAIN AUDIT FUNCTION
// =============================================================================

export function auditStructure(
	riff: string,
	repoRoot: string,
	options: StructureAuditOptions = { allowGitkeepPlaceholders: true }
): StructureAuditResult {
	const { allowGitkeepPlaceholders } = options;
	const riffDir = resolve(repoRoot, 'riffs', riff);
	const srcDir = resolve(riffDir, 'src');
	const testDir = resolve(riffDir, 'test');
	const readmeExists = existsSync(resolve(riffDir, 'README.md'));

	// Test directories
	const testUnitDir = resolve(testDir, 'unit');
	const testIntegrationDir = resolve(testDir, 'integration');

	// Source directories
	const tuiDir = resolve(srcDir, 'tui');
	const coreDir = resolve(srcDir, 'core');
	const libDir = resolve(srcDir, 'lib');
	const auditsDir = resolve(srcDir, 'audits');

	// Check test directories
	const testUnitDirExists = isDirectory(testUnitDir);
	const testUnitDirHasFiles = directoryHasFiles(testUnitDir, allowGitkeepPlaceholders);
	const testIntegrationDirExists = isDirectory(testIntegrationDir);
	const testIntegrationDirHasFiles = directoryHasFiles(testIntegrationDir, allowGitkeepPlaceholders);

	// Check source directories
	const tuiDirExists = isDirectory(tuiDir);
	const tuiDirHasFiles = directoryHasFiles(tuiDir, allowGitkeepPlaceholders);
	const coreDirExists = isDirectory(coreDir);
	const coreDirHasFiles = directoryHasAnyContent(coreDir, allowGitkeepPlaceholders);
	const libDirExists = isDirectory(libDir);
	const libDirHasFiles = directoryHasAnyContent(libDir, allowGitkeepPlaceholders);
	const auditsDirExists = isDirectory(auditsDir);
	const auditsDirHasFiles = directoryHasAnyContent(auditsDir, allowGitkeepPlaceholders);

	// Find all empty directories
	const emptyDirectories = findEmptyDirectories(riffDir);

	return {
		readmeExists,
		testUnitDirExists,
		testUnitDirHasFiles,
		testIntegrationDirExists,
		testIntegrationDirHasFiles,
		tuiDirExists,
		tuiDirHasFiles,
		coreDirExists,
		coreDirHasFiles,
		libDirExists,
		libDirHasFiles,
		auditsDirExists,
		auditsDirHasFiles,
		emptyDirectories,
	};
}
