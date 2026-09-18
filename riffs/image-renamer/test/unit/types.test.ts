import { describe, expect, it } from 'vitest';
import {
	ConfigError,
	FileOperationError,
	ImageCorrupted,
	ImageRenameError,
	LlmConnectionError,
	WatcherError,
} from '../../src/lib/types.js';

describe('imagerenamer Types', () => {
	describe('Error Classes', () => {
		it('should create ImageRenameError with correct name and message', () => {
			const error = new ImageRenameError('rename failed');
			expect(error.name).toBe('ImageRenameError');
			expect(error.message).toBe('rename failed');
			expect(error instanceof Error).toBe(true);
		});

		it('should create LlmConnectionError with correct name and message', () => {
			const error = new LlmConnectionError('connection failed');
			expect(error.name).toBe('LlmConnectionError');
			expect(error.message).toBe('connection failed');
			expect(error instanceof Error).toBe(true);
		});

		it('should create FileOperationError with correct name and message', () => {
			const error = new FileOperationError('file operation failed');
			expect(error.name).toBe('FileOperationError');
			expect(error.message).toBe('file operation failed');
			expect(error instanceof Error).toBe(true);
		});

		it('should create ImageCorrupted with correct name and message', () => {
			const error = new ImageCorrupted('image corrupted');
			expect(error.name).toBe('ImageCorrupted');
			expect(error.message).toBe('image corrupted');
			expect(error instanceof Error).toBe(true);
		});

		it('should create WatcherError with correct name and message', () => {
			const error = new WatcherError('watcher error');
			expect(error.name).toBe('WatcherError');
			expect(error.message).toBe('watcher error');
			expect(error instanceof Error).toBe(true);
		});

		it('should create ConfigError with correct name and message', () => {
			const error = new ConfigError('config error');
			expect(error.name).toBe('ConfigError');
			expect(error.message).toBe('config error');
			expect(error instanceof Error).toBe(true);
		});
	});
});
