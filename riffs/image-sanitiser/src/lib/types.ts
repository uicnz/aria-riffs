/**
 * TypeScript type definitions for image-sanitiser riff
 * Config types are defined in schema.ts via Zod inference
 */

export interface ProcessingResults {
	total_files: number;
	processed: number;
	failed: number;
	skipped: number;
	fixed: number;
	processing_time: number;
	errors: string[];
}

export interface DetectionResult {
	detectedExtension: string;
	detectedMimeType: string;
	confidence: 'high' | 'medium' | 'low';
	method: 'magic-bytes' | 'sharp-metadata' | 'fallback';
	originalExtension: string;
	needsRename: boolean;
}

export interface FileAnalysis {
	filePath: string;
	originalExtension: string;
	detectionResult: DetectionResult;
	proposedNewPath?: string;
	error?: string;
}

export class ImageSanitiserError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ImageSanitiserError';
	}
}

export class FileDetectionError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'FileDetectionError';
	}
}

export class FileOperationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'FileOperationError';
	}
}

export class UnsupportedImageFormat extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'UnsupportedImageFormat';
	}
}
