import { describe, expect, it } from 'vitest';
import { ConfigError } from '../../src/lib/config.js';
import {
	DatabaseError,
	FilePermissionError,
	ImageProcessorError,
	LlmConnectionError,
	MetadataWriteError,
	UnsupportedImageFormat,
} from '../../src/lib/types.js';

describe('ImageMeta Types', () => {
	describe('Error Classes', () => {
		it('given error message, when ImageProcessorError created, then should have correct name and message', () => {
			const error = new ImageProcessorError('test message');
			expect(error.name).toBe('ImageProcessorError');
			expect(error.message).toBe('test message');
			expect(error instanceof Error).toBe(true);
		});

		it('given error message, when LlmConnectionError created, then should have correct name and message', () => {
			const error = new LlmConnectionError('connection failed');
			expect(error.name).toBe('LlmConnectionError');
			expect(error.message).toBe('connection failed');
			expect(error instanceof Error).toBe(true);
		});

		it('given error message, when DatabaseError created, then should have correct name and message', () => {
			const error = new DatabaseError('database error');
			expect(error.name).toBe('DatabaseError');
			expect(error.message).toBe('database error');
			expect(error instanceof Error).toBe(true);
		});

		it('given error message, when MetadataWriteError created, then should have correct name and message', () => {
			const error = new MetadataWriteError('metadata write failed');
			expect(error.name).toBe('MetadataWriteError');
			expect(error.message).toBe('metadata write failed');
			expect(error instanceof Error).toBe(true);
		});

		it('given error message, when FilePermissionError created, then should have correct name and message', () => {
			const error = new FilePermissionError('permission denied');
			expect(error.name).toBe('FilePermissionError');
			expect(error.message).toBe('permission denied');
			expect(error instanceof Error).toBe(true);
		});

		it('given error message, when UnsupportedImageFormat created, then should have correct name and message', () => {
			const error = new UnsupportedImageFormat('unsupported format');
			expect(error.name).toBe('UnsupportedImageFormat');
			expect(error.message).toBe('unsupported format');
			expect(error instanceof Error).toBe(true);
		});

		it('given error message, when ConfigError created, then should have correct name and message', () => {
			const error = new ConfigError('config error');
			expect(error.name).toBe('ConfigError');
			expect(error.message).toBe('config error');
			expect(error instanceof Error).toBe(true);
		});
	});
});
