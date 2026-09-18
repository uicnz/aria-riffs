/**
 * Type definitions for image OCR riff
 */

export interface ProcessingResults {
	total_files: number;
	processed: number;
	failed: number;
	skipped: number;
	processing_time: number;
	errors: string[];
}

export interface OcrResult {
	text: string;
	confidence?: number;
}

export interface FileResult {
	inputPath: string;
	outputPath: string;
	extractedText: string;
	success: boolean;
	error?: string;
}

// Custom error classes
export class ImageOcrError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ImageOcrError';
	}
}

export class OcrProcessingError extends ImageOcrError {
	constructor(message: string) {
		super(message);
		this.name = 'OcrProcessingError';
	}
}

export class FileOperationError extends ImageOcrError {
	constructor(message: string) {
		super(message);
		this.name = 'FileOperationError';
	}
}

export class UnsupportedFileFormat extends ImageOcrError {
	constructor(message: string) {
		super(message);
		this.name = 'UnsupportedFileFormat';
	}
}
