/**
 * Type definitions for Aria Image Alttext riff
 */

// Re-export config types from schema (single source of truth)
export type { LoggingConfig } from './schema.js';

export interface ProcessingOptions {
	verbose?: boolean;
	dryRun?: boolean;
}

export interface ProcessingResult {
	matchCount: number;
	success: boolean;
	filePath: string;
	changes: ImageReplacement[];
}

export interface ImageReplacement {
	imagePath: string;
	caption: string;
	lineNumber?: number;
}

export interface FileContent {
	original: string;
	processed: string;
	hasChanges: boolean;
}
