/**
 * Unit tests for paths-audit module
 */

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { auditPaths } from '../../src/audits/paths-audit.js';

const TEST_ROOT = resolve(tmpdir(), 'aria-paths-audit-test');

function writeRiffConfig(riff: string, content: string): void {
	const riffDir = resolve(TEST_ROOT, 'riffs', '.curated', riff);
	mkdirSync(riffDir, { recursive: true });
	writeFileSync(resolve(riffDir, 'config.yaml'), content, 'utf8');
}

function writeRiffFile(riff: string, relativePath: string, content: string): void {
	const filePath = resolve(TEST_ROOT, 'riffs', '.curated', riff, relativePath);
	mkdirSync(resolve(filePath, '..'), { recursive: true });
	writeFileSync(filePath, content, 'utf8');
}

describe('Paths Audit', () => {
	beforeEach(() => {
		mkdirSync(resolve(TEST_ROOT, 'riffs'), { recursive: true });
	});

	afterEach(() => {
		rmSync(TEST_ROOT, { recursive: true, force: true });
	});

	describe('given riff with nested paths structure', () => {
		it('when audited, then reports nested structure detected', () => {
			writeRiffConfig(
				'test-riff',
				`
test-riff:
    paths:
        input:
            dir: sources
        output:
            dir: .aria/exports/test-riff

logging:
    file: .aria/logs/test-riff.log
`
			);

			const result = auditPaths('test-riff', TEST_ROOT);

			expect(result.pathsHasNestedStructure).toBe(true);
			expect(result.pathsValidCategories).toBe(true);
			expect(result.pathsHasFlatKeys).toBe(false);
			expect(result.pathsFlatKeys).toEqual([]);
			expect(result.pathsInvalidCategories).toEqual([]);
			expect(result.pathsLoggingHasFile).toBe(true);
			expect(result.pathsLoggingFollowsConvention).toBe(true);
		});
	});

	describe('given riff with empty paths object', () => {
		it('when audited, then reports valid nested structure', () => {
			writeRiffConfig(
				'test-riff',
				`
test-riff:
    paths: {}

logging:
    file: .aria/logs/test-riff.log
`
			);

			const result = auditPaths('test-riff', TEST_ROOT);

			expect(result.pathsHasNestedStructure).toBe(true);
			expect(result.pathsValidCategories).toBe(true);
		});
	});

	describe('given riff with flat path keys', () => {
		it('when audited, then detects flat keys and no nested structure', () => {
			writeRiffConfig(
				'test-riff',
				`
test-riff:
    paths:
        inputDirectory: sources
        outputDirectory: .aria/exports/test-riff

logging:
    file: .aria/logs/test-riff.log
`
			);

			const result = auditPaths('test-riff', TEST_ROOT);

			expect(result.pathsHasNestedStructure).toBe(false);
			expect(result.pathsHasFlatKeys).toBe(true);
			expect(result.pathsFlatKeys).toContain('paths.inputDirectory');
			expect(result.pathsFlatKeys).toContain('paths.outputDirectory');
		});
	});

	describe('given riff with invalid path categories', () => {
		it('when audited, then flags invalid categories', () => {
			writeRiffConfig(
				'test-riff',
				`
test-riff:
    paths:
        input:
            dir: sources
        unknown:
            dir: somewhere

logging:
    file: .aria/logs/test-riff.log
`
			);

			const result = auditPaths('test-riff', TEST_ROOT);

			expect(result.pathsHasNestedStructure).toBe(true);
			expect(result.pathsValidCategories).toBe(false);
			expect(result.pathsInvalidCategories).toContain('unknown');
		});
	});

	describe('given riff with non-canonical cache-path references in source', () => {
		it('when audited, then flags methodology drift markers', () => {
			writeRiffConfig(
				'test-riff',
				`
test-riff:
    paths:
        database:
            dir: .aria/db/test-riff

logging:
    file: .aria/logs/test-riff.log
`
			);
			writeRiffFile(
				'test-riff',
				'src/lib/config.ts',
				`
export function applyEnvOverrides(): void {
	if (process.env['TEST_RIFF_CACHE_DIR']) {
		return;
	}
}

const pathRef = 'paths.cache';
`
			);

			const result = auditPaths('test-riff', TEST_ROOT);

			expect(result.pathsNonCanonicalCacheReferences).toContain('src/lib/config.ts: TEST_RIFF_CACHE_DIR');
			expect(result.pathsNonCanonicalCacheReferences).toContain('src/lib/config.ts: paths.cache');
		});
	});

	describe('given riff with missing logging file', () => {
		it('when audited, then reports missing logging file', () => {
			writeRiffConfig(
				'test-riff',
				`
test-riff:
    paths:
        input:
            dir: sources

logging:
    level: info
`
			);

			const result = auditPaths('test-riff', TEST_ROOT);

			expect(result.pathsLoggingHasFile).toBe(false);
			expect(result.pathsLoggingFollowsConvention).toBe(false);
		});
	});

	describe('given riff with non-standard logging path', () => {
		it('when audited, then reports convention violation', () => {
			writeRiffConfig(
				'test-riff',
				`
test-riff:
    paths:
        input:
            dir: sources

logging:
    file: /tmp/test-riff.log
`
			);

			const result = auditPaths('test-riff', TEST_ROOT);

			expect(result.pathsLoggingHasFile).toBe(true);
			expect(result.pathsLoggingFollowsConvention).toBe(false);
		});
	});

	describe('given riff with orphaned path-like keys as direct children', () => {
		it('when audited, then detects orphaned sections', () => {
			writeRiffConfig(
				'test-riff',
				`
test-riff:
    paths:
        input:
            dir: sources
    outputDirectory: .aria/exports/test-riff

logging:
    file: .aria/logs/test-riff.log
`
			);

			const result = auditPaths('test-riff', TEST_ROOT);

			expect(result.pathsOrphanedSections.length).toBeGreaterThan(0);
			expect(result.pathsOrphanedSections).toContain('test-riff.outputDirectory');
		});
	});

	describe('given riff with all four valid path categories', () => {
		it('when audited, then all categories are valid', () => {
			writeRiffConfig(
				'test-riff',
				`
test-riff:
    paths:
        input:
            dir: sources
        output:
            dir: .aria/exports/test-riff
        template:
            assets: assets
        database:
            file: .aria/db/test-riff/test-riff.sqlite

logging:
    file: .aria/logs/test-riff.log
`
			);

			const result = auditPaths('test-riff', TEST_ROOT);

			expect(result.pathsHasNestedStructure).toBe(true);
			expect(result.pathsValidCategories).toBe(true);
			expect(result.pathsInvalidCategories).toEqual([]);
		});
	});

	describe('given missing config file', () => {
		it('when audited, then returns safe defaults', () => {
			const result = auditPaths('nonexistent-riff', TEST_ROOT);

			expect(result.pathsHasNestedStructure).toBe(false);
			expect(result.pathsValidCategories).toBe(true);
			expect(result.pathsHasFlatKeys).toBe(false);
		});
	});
});
