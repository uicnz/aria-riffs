/**
 * Unit tests for FileScanner
 */

import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pino from 'pino';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FileScanner } from '../../src/core/file-scanner.js';

describe('FileScanner', () => {
	let scanner: FileScanner;
	let logger: pino.Logger;
	let testDir: string;

	beforeEach(async () => {
		logger = pino({ level: 'silent' });
		scanner = new FileScanner(logger);

		// Create temporary test directory
		testDir = join(tmpdir(), `vector-indexer-test-${Date.now()}`);
		await mkdir(testDir, { recursive: true });
	});

	afterEach(async () => {
		// Cleanup test directory
		try {
			await rm(testDir, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
	});

	describe('scan', () => {
		it('should find markdown files', async () => {
			await writeFile(join(testDir, 'test.md'), '# Test');
			await writeFile(join(testDir, 'other.txt'), 'Text');

			const files = await scanner.scan(testDir, {
				patterns: ['**/*.md'],
				ignore: [],
			});

			expect(files).toHaveLength(1);
			expect(files[0].path).toContain('test.md');
		});

		it('should read file content', async () => {
			const content = '# Test Content\n\nBody text.';
			await writeFile(join(testDir, 'doc.md'), content);

			const files = await scanner.scan(testDir, {
				patterns: ['**/*.md'],
				ignore: [],
			});

			expect(files[0].content).toBe(content);
		});

		it('should respect ignore patterns', async () => {
			await mkdir(join(testDir, 'node_modules'), { recursive: true });
			await writeFile(join(testDir, 'test.md'), '# Test');
			await writeFile(join(testDir, 'node_modules', 'ignored.md'), '# Ignored');

			const files = await scanner.scan(testDir, {
				patterns: ['**/*.md'],
				ignore: ['**/node_modules/**'],
			});

			expect(files).toHaveLength(1);
			expect(files[0].path).toContain('test.md');
		});

		it('should skip files larger than maxFileSize', async () => {
			const smallContent = '# Small';
			const largeContent = 'X'.repeat(2000);

			await writeFile(join(testDir, 'small.md'), smallContent);
			await writeFile(join(testDir, 'large.md'), largeContent);

			const files = await scanner.scan(testDir, {
				patterns: ['**/*.md'],
				ignore: [],
				maxFileSize: 1000,
			});

			expect(files).toHaveLength(1);
			expect(files[0].path).toContain('small.md');
		});

		it('should include file metadata', async () => {
			await writeFile(join(testDir, 'test.md'), '# Test');

			const files = await scanner.scan(testDir, {
				patterns: ['**/*.md'],
				ignore: [],
			});

			expect(files[0].size).toBeGreaterThan(0);
			expect(files[0].modifiedAt).toBeInstanceOf(Date);
			expect(files[0].relativePath).toBeTruthy();
		});

		it('should handle multiple file patterns', async () => {
			await writeFile(join(testDir, 'doc.md'), '# Markdown');
			await writeFile(join(testDir, 'note.txt'), 'Text file');

			const files = await scanner.scan(testDir, {
				patterns: ['**/*.md', '**/*.txt'],
				ignore: [],
			});

			expect(files).toHaveLength(2);
		});
	});

	describe('getFileStats', () => {
		it('should get file size and modification time', async () => {
			const filePath = join(testDir, 'test.md');
			await writeFile(filePath, '# Test');

			const stats = await scanner.getFileStats(filePath);

			expect(stats.size).toBeGreaterThan(0);
			expect(stats.modifiedAt).toBeInstanceOf(Date);
		});
	});
});
