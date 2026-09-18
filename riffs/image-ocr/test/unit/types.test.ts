import { describe, expect, it } from 'vitest';
import { FileOperationError, ImageOcrError, OcrProcessingError, UnsupportedFileFormat } from '../../src/lib/types.js';

describe('ImageOCR Types', () => {
	describe('ImageOcrError', () => {
		it('should create error with correct name and message', () => {
			const error = new ImageOcrError('Test error');
			expect(error.name).toBe('ImageOcrError');
			expect(error.message).toBe('Test error');
			expect(error).toBeInstanceOf(Error);
		});
	});

	describe('OcrProcessingError', () => {
		it('should create error with correct name and message', () => {
			const error = new OcrProcessingError('OCR failed');
			expect(error.name).toBe('OcrProcessingError');
			expect(error.message).toBe('OCR failed');
			expect(error).toBeInstanceOf(ImageOcrError);
			expect(error).toBeInstanceOf(Error);
		});
	});

	describe('FileOperationError', () => {
		it('should create error with correct name and message', () => {
			const error = new FileOperationError('File not found');
			expect(error.name).toBe('FileOperationError');
			expect(error.message).toBe('File not found');
			expect(error).toBeInstanceOf(ImageOcrError);
			expect(error).toBeInstanceOf(Error);
		});
	});

	describe('UnsupportedFileFormat', () => {
		it('should create error with correct name and message', () => {
			const error = new UnsupportedFileFormat('Invalid format');
			expect(error.name).toBe('UnsupportedFileFormat');
			expect(error.message).toBe('Invalid format');
			expect(error).toBeInstanceOf(ImageOcrError);
			expect(error).toBeInstanceOf(Error);
		});
	});
});
