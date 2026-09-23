/**
 * TypeScript type definitions for image-transcoder riff
 * Config types are defined in schema.ts via Zod inference
 */

// =============================================================================
// PROCESSING TYPES
// =============================================================================

export interface ProcessingResult {
	inputPath: string;
	outputPath: string;
	originalSize: number;
	finalSize: number;
	iterations: number;
	success: boolean;
	error?: string;
}

export interface BatchResult {
	totalFiles: number;
	processed: number;
	failed: number;
	skipped: number;
	results: ProcessingResult[];
}
