/**
 * Type definitions for Aria Code Auditor riff
 */

export interface AuditOptions {
	json?: boolean;
	verbose?: boolean;
	outputDir?: string;
}

export interface UpdateOptions {
	dryRun?: boolean;
	selective?: boolean;
	devOnly?: boolean;
	skipTests?: boolean;
	backupDir?: string;
	testCommand?: string;
	packageManager?: string;
	json?: boolean;
}

export interface DependencyInfo {
	name: string;
	current?: string;
	wanted?: string;
	latest?: string;
	type: 'production' | 'development' | 'peer' | 'optional';
	location?: string;
}

export interface OutdatedDependency extends DependencyInfo {
	current: string;
	wanted: string;
	latest: string;
}

export interface AuditResults {
	timestamp: string;
	dependencies: {
		all: DependencyInfo[];
		unused: string[];
		outdated: OutdatedDependency[];
	};
	status: {
		success: boolean;
		allUsed: boolean;
		allUpdated: boolean;
	};
	exitCode: number; // 0: successful audit (regardless of findings), 1: audit process failed
}

export interface UpdateResults {
	timestamp: string;
	updates: {
		attempted: DependencyInfo[];
		successful: DependencyInfo[];
		failed: DependencyInfo[];
		rolledBack: DependencyInfo[];
	};
	backup: {
		created: boolean;
		path?: string;
		files: string[];
	};
	tests: {
		ranBefore: boolean;
		ranAfter: boolean;
		passedBefore?: boolean;
		passedAfter?: boolean;
	};
	status: {
		success: boolean;
		requiresRollback: boolean;
		completed: boolean;
	};
	exitCode: number;
}

export interface BunCommandResult {
	stdout: string;
	stderr: string;
	exitCode: number;
	success: boolean;
}

export interface BackupInfo {
	path: string;
	timestamp: string;
	files: string[];
	created: boolean;
}

export interface TestResult {
	command: string;
	success: boolean;
	output: string;
	exitCode: number;
	duration: number;
}

export interface Config {
	backupDir: string;
	testCommand: string;
	packageManager: string;
	outputDir: string;
}

// Re-export from schema.ts (single source of truth)
export type { LoggingConfig } from './schema.js';

export interface ValidationResult {
	valid: boolean;
	errors: string[];
	warnings: string[];
}
