import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Logger } from 'pino';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateOrgChart, runIndex } from '../../src/cli.js';
import { HrStafferDatabase } from '../../src/db/database.js';
import { FakeEmbeddingService } from '../helpers/fake-embedding-service.js';
import { createMockLogger } from '../helpers/mock-logger.js';

describe('generateOrgChart integration', () => {
	let testDir: string;
	let outputDir: string;
	let testDbDir: string;
	let logger: Logger;
	const fixturePath = path.resolve('./riffs/hr-staffer/test/fixtures');
	const testConfigPath = path.resolve('./riffs/hr-staffer/test/fixtures/config-test.yaml');

	beforeEach(() => {
		// Use unique directories per test to avoid parallel test interference
		const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
		testDir = `/tmp/hr-staffer-test-${uniqueId}`;
		outputDir = path.join(testDir, 'output');
		testDbDir = `/tmp/hr-staffer-test-db-${uniqueId}`;
		mkdirSync(outputDir, { recursive: true });
		mkdirSync(testDbDir, { recursive: true });
		logger = createMockLogger();
	});

	afterEach(() => {
		vi.restoreAllMocks();
		try {
			rmSync(testDir, { recursive: true, force: true });
		} catch {
			// Cleanup failure is not critical
		}
		try {
			rmSync(testDbDir, { recursive: true, force: true });
		} catch {
			// Cleanup failure is not critical
		}
	});

	describe('output generation', () => {
		it('given valid minimal CSV file, when generateOrgChart invoked without format flags, then generates all output formats', () => {
			const csvFile = path.join(fixturePath, 'minimal-org.csv');

			generateOrgChart(csvFile, { output: outputDir, config: testConfigPath }, logger);

			expect(existsSync(path.join(outputDir, 'org-chart.txt'))).toBe(true);
			expect(existsSync(path.join(outputDir, 'org-chart.md'))).toBe(true);
			expect(existsSync(path.join(outputDir, 'org-chart.mermaid'))).toBe(true);
		});

		it('given minimal CSV file, when generateOrgChart invoked with textOnly flag, then generates only text output', () => {
			const csvFile = path.join(fixturePath, 'minimal-org.csv');

			generateOrgChart(csvFile, { output: outputDir, textOnly: true, config: testConfigPath }, logger);

			expect(existsSync(path.join(outputDir, 'org-chart.txt'))).toBe(true);
			expect(existsSync(path.join(outputDir, 'org-chart.md'))).toBe(false);
			expect(existsSync(path.join(outputDir, 'org-chart.mermaid'))).toBe(false);
		});

		it('given minimal CSV file, when generateOrgChart invoked with markdownOnly flag, then generates only markdown output', () => {
			const csvFile = path.join(fixturePath, 'minimal-org.csv');

			generateOrgChart(csvFile, { output: outputDir, markdownOnly: true, config: testConfigPath }, logger);

			expect(existsSync(path.join(outputDir, 'org-chart.txt'))).toBe(false);
			expect(existsSync(path.join(outputDir, 'org-chart.md'))).toBe(true);
			expect(existsSync(path.join(outputDir, 'org-chart.mermaid'))).toBe(false);
		});

		it('given minimal CSV file, when generateOrgChart invoked with mermaidOnly flag, then generates only mermaid output with team files', () => {
			const csvFile = path.join(fixturePath, 'minimal-org.csv');

			generateOrgChart(csvFile, { output: outputDir, mermaidOnly: true, config: testConfigPath }, logger);

			expect(existsSync(path.join(outputDir, 'org-chart.txt'))).toBe(false);
			expect(existsSync(path.join(outputDir, 'org-chart.md'))).toBe(false);
			expect(existsSync(path.join(outputDir, 'org-chart.mermaid'))).toBe(true);
			expect(existsSync(path.join(outputDir, 'executive-leadership.mermaid'))).toBe(true);
		});

		it('given multi-level CSV file, when generateOrgChart invoked with title disabled, then output excludes job titles', () => {
			const csvFile = path.join(fixturePath, 'multi-level-org.csv');

			generateOrgChart(
				csvFile,
				{ output: outputDir, textOnly: true, title: false, config: testConfigPath },
				logger
			);

			const content = readFileSync(path.join(outputDir, 'org-chart.txt'), 'utf-8');

			expect(content).toContain('Alice Johnson');
			expect(content).not.toContain('(CEO)');
			expect(content).not.toContain('(VP Engineering)');
		});

		it('given multi-level CSV file, when generateOrgChart invoked with includeEmail flag, then output includes email addresses', () => {
			const csvFile = path.join(fixturePath, 'multi-level-org.csv');

			generateOrgChart(
				csvFile,
				{ output: outputDir, textOnly: true, includeEmail: true, config: testConfigPath },
				logger
			);

			const content = readFileSync(path.join(outputDir, 'org-chart.txt'), 'utf-8');

			expect(content).toContain('alice@example.com');
			expect(content).toContain('bob@example.com');
		});

		it('given minimal CSV file, when generateOrgChart invoked with maxDepth 1, then output respects depth limit', () => {
			const csvFile = path.join(fixturePath, 'minimal-org.csv');

			generateOrgChart(
				csvFile,
				{ output: outputDir, textOnly: true, maxDepth: 1, config: testConfigPath },
				logger
			);

			const content = readFileSync(path.join(outputDir, 'org-chart.txt'), 'utf-8');

			expect(content).toContain('Jane Doe');
			expect(content).toContain('John Smith');
		});

		it('given multi-level CSV file, when generateOrgChart invoked with markdown, then generates markdown with organizational structure', () => {
			const csvFile = path.join(fixturePath, 'multi-level-org.csv');

			generateOrgChart(csvFile, { output: outputDir, markdownOnly: true, config: testConfigPath }, logger);

			const content = readFileSync(path.join(outputDir, 'org-chart.md'), 'utf-8');

			expect(content).toContain('# Organization Chart');
			expect(content).toContain('## Alice Johnson');
			expect(content).toContain('### Bob Williams');
			expect(content).toContain('### Carol Davis');
		});

		it('given multi-level CSV file, when generateOrgChart invoked with mermaid, then generates ERD diagrams with relationships', () => {
			const csvFile = path.join(fixturePath, 'multi-level-org.csv');

			generateOrgChart(csvFile, { output: outputDir, mermaidOnly: true, config: testConfigPath }, logger);

			const content = readFileSync(path.join(outputDir, 'org-chart.mermaid'), 'utf-8');

			expect(content).toContain('```mermaid');
			expect(content).toContain('erDiagram');
			expect(content).toContain('Alice Johnson');
			expect(content).toContain('Bob Williams');
		});

		it('given invalid CSV file, when generateOrgChart invoked, then throws error', () => {
			const csvFile = path.join(fixturePath, 'invalid-headers.csv');

			expect(() => {
				generateOrgChart(csvFile, { output: outputDir, config: testConfigPath }, logger);
			}).toThrow();
		});
	});
});

describe('runIndex integration', () => {
	let testDir: string;
	let sectionsDir: string;
	let dbPath: string;
	let logger: Logger;

	beforeEach(() => {
		// Use unique directories per test to avoid parallel test interference
		const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
		testDir = `/tmp/hr-staffer-index-cli-test-${uniqueId}`;
		sectionsDir = path.join(testDir, 'sections');
		dbPath = path.join(testDir, 'test.db');
		mkdirSync(sectionsDir, { recursive: true });
		logger = createMockLogger();
	});

	afterEach(() => {
		vi.restoreAllMocks();
		try {
			rmSync(testDir, { recursive: true, force: true });
		} catch {
			// Cleanup failure is not critical
		}
	});

	// Helper to create test section files
	function createSectionFile(filename: string, content: string): void {
		writeFileSync(path.join(sectionsDir, filename), content);
	}

	it('given directory with 3 section files, when runIndex called with sectionsDir, then documents indexed in database', async () => {
		// Create test section files
		createSectionFile('0000-alice.md', '# Alice\n\nAlice is an engineer.');
		createSectionFile('0001-bob.md', '# Bob\n\nBob is a manager.');
		createSectionFile('0002-carol.md', '# Carol\n\nCarol is a designer.');

		// Create fake embedding service
		const embeddingService = new FakeEmbeddingService();

		// Run index command
		await runIndex({
			sectionsDir,
			dbPath,
			embeddingService,
			logger,
		});

		// Verify documents were indexed
		const db = new HrStafferDatabase(dbPath);
		db.initialize();
		try {
			expect(db.getDocumentCount()).toBe(3);
			expect(db.getDocument('0000-alice')).toBeDefined();
			expect(db.getDocument('0001-bob')).toBeDefined();
			expect(db.getDocument('0002-carol')).toBeDefined();
		} finally {
			db.close();
		}
	});

	it('given existing documents, when runIndex called with reset=true, then old documents cleared and only new documents present', async () => {
		// First, create and index some existing documents
		const db = new HrStafferDatabase(dbPath);
		db.initialize();
		db.initDocumentTables({ useFts: true });
		const embedding = new Float32Array([0.1, 0.2, 0.3]);
		db.insertDocument('old-doc-1', 'Old content 1', embedding, {});
		db.insertDocument('old-doc-2', 'Old content 2', embedding, {});
		expect(db.getDocumentCount()).toBe(2);
		db.close();

		// Create new section files
		createSectionFile('0000-new.md', '# New\n\nNew content here.');

		// Run index with reset=true
		const embeddingService = new FakeEmbeddingService();
		await runIndex({
			sectionsDir,
			dbPath,
			embeddingService,
			logger,
			reset: true,
		});

		// Verify old documents cleared, only new document present
		const dbAfter = new HrStafferDatabase(dbPath);
		dbAfter.initialize();
		try {
			expect(dbAfter.getDocumentCount()).toBe(1);
			expect(dbAfter.getDocument('old-doc-1')).toBeUndefined();
			expect(dbAfter.getDocument('old-doc-2')).toBeUndefined();
			expect(dbAfter.getDocument('0000-new')).toBeDefined();
		} finally {
			dbAfter.close();
		}
	});

	it('given section files, when runIndex called, then logger reports indexed document count', async () => {
		// Create section files
		createSectionFile('0000-alice.md', '# Alice\n\nAlice content.');
		createSectionFile('0001-bob.md', '# Bob\n\nBob content.');

		const embeddingService = new FakeEmbeddingService();
		await runIndex({
			sectionsDir,
			dbPath,
			embeddingService,
			logger,
		});

		// Verify logger received document count
		expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ documentCount: 2 }), expect.any(String));
	});
});
