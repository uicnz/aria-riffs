/**
 * Type definitions for Aria Dir Differ riff
 */

/**
 * Logging configuration
 */
export interface LoggingConfig {
	level: string;
	verbose: boolean;
	file: string;
	maxFileSizeMb: number;
	maxFiles: number;
}

export interface DiffOptions {
	exclude?: string[];
	content?: boolean;
	summaryOnly?: boolean;
	color?: boolean;
}

export interface DiffItem {
	name1?: string;
	name2?: string;
	relativePath?: string;
	state: 'left' | 'right' | 'distinct' | 'equal';
	type1?: string;
	type2?: string;
}

export interface CompareResult {
	same: boolean;
	diffSet: DiffItem[];
	left: number;
	right: number;
	distinct: number;
	equal: number;
	dirs1?: number;
	dirs2?: number;
	files1?: number;
	files2?: number;
}

export interface DirectoryPaths {
	dir1: string;
	dir2: string;
}

export interface ValidationResult {
	valid: boolean;
	error?: string;
}

export interface ContentDifference {
	line: number;
	line1?: string | null;
	line2?: string | null;
	type: 'missing' | 'added' | 'changed';
}
