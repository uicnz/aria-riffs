import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HrStafferDatabase } from '../../src/db/database.js';
import type { Employee } from '../../src/lib/types.js';

describe('database integration', () => {
	let testDbDir: string;
	let testDbPath: string;
	let db: HrStafferDatabase;

	const createEmployee = (overrides: Partial<Employee> = {}): Employee => ({
		displayName: 'John Doe',
		firstName: 'John',
		lastName: 'Doe',
		email: 'john@example.com',
		title: 'Engineer',
		department: 'Engineering',
		manager: 'No Manager',
		mobile: '+1-555-0000',
		streetAddress: '123 Main St',
		city: 'San Francisco',
		country: 'USA',
		...overrides,
	});

	beforeEach(() => {
		// Use unique directory per test to avoid parallel test interference
		const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
		testDbDir = `/tmp/hr-staffer-test-db-${uniqueId}`;
		testDbPath = path.join(testDbDir, 'test.db');
		mkdirSync(testDbDir, { recursive: true });
	});

	afterEach(() => {
		try {
			db?.close();
			rmSync(testDbDir, { recursive: true, force: true });
		} catch {
			// Cleanup failure is not critical
		}
	});

	describe('HrStafferDatabase', () => {
		it('given initialized database, when upsertEmployees called, then stores employees and allows retrieval', () => {
			const db = new HrStafferDatabase(testDbPath);
			db.initialize();

			const employees = [
				createEmployee({
					displayName: 'Alice',
					email: 'alice@example.com',
					manager: 'No Manager',
				}),
				createEmployee({
					displayName: 'Bob',
					email: 'bob@example.com',
					manager: 'Alice',
				}),
				createEmployee({
					displayName: 'Carol',
					email: 'carol@example.com',
					manager: 'Bob',
				}),
			];

			db.upsertEmployees(employees);

			const loaded = db.loadEmployees();

			expect(loaded).toHaveLength(3);
			expect(loaded[0].displayName).toBe('Alice');
			expect(loaded[1].displayName).toBe('Bob');
			expect(loaded[2].displayName).toBe('Carol');

			db.close();
		});
	});

	describe('Document tables', () => {
		it('given database path in /tmp, when initDocumentTables called, then documents table exists with correct schema', () => {
			db = new HrStafferDatabase(testDbPath);
			db.initialize();
			db.initDocumentTables();

			// Query sqlite_master to verify table exists
			const tableInfo = db.getTableInfo('documents');

			expect(tableInfo).toBeDefined();
			expect(tableInfo.some(col => col.name === 'id' && col.type === 'TEXT')).toBe(true);
			expect(tableInfo.some(col => col.name === 'content' && col.type === 'TEXT')).toBe(true);
			expect(tableInfo.some(col => col.name === 'embedding' && col.type === 'BLOB')).toBe(true);
			expect(tableInfo.some(col => col.name === 'metadata_json' && col.type === 'TEXT')).toBe(true);
		});

		it('given useFts=true, when initDocumentTables called, then documents_fts virtual table exists', () => {
			db = new HrStafferDatabase(testDbPath);
			db.initialize();
			db.initDocumentTables({ useFts: true });

			// Check if FTS table exists in sqlite_master
			const ftsExists = db.tableExists('documents_fts');

			expect(ftsExists).toBe(true);
		});

		it('given connected database, when document inserted, then document retrievable by id', () => {
			db = new HrStafferDatabase(testDbPath);
			db.initialize();
			db.initDocumentTables();

			const embedding = new Float32Array([0.1, 0.2, 0.3]);
			const metadata = { title: 'Test Doc', source_path: '/test.md' };

			db.insertDocument('doc-001', 'Test content', embedding, metadata);

			const doc = db.getDocument('doc-001');

			expect(doc).toBeDefined();
			expect(doc?.id).toBe('doc-001');
			expect(doc?.content).toBe('Test content');
		});

		it('given connected database, when 3 documents inserted, then all 3 documents retrievable', () => {
			db = new HrStafferDatabase(testDbPath);
			db.initialize();
			db.initDocumentTables();

			const embedding = new Float32Array([0.1, 0.2, 0.3]);

			db.insertDocument('doc-001', 'Content one', embedding, { title: 'Doc 1' });
			db.insertDocument('doc-002', 'Content two', embedding, { title: 'Doc 2' });
			db.insertDocument('doc-003', 'Content three', embedding, { title: 'Doc 3' });

			const count = db.getDocumentCount();

			expect(count).toBe(3);
			expect(db.getDocument('doc-001')).toBeDefined();
			expect(db.getDocument('doc-002')).toBeDefined();
			expect(db.getDocument('doc-003')).toBeDefined();
		});

		it('given database with FTS enabled and document with "Andrew Allan", when FTS search for "Andrew", then returns matching document', () => {
			db = new HrStafferDatabase(testDbPath);
			db.initialize();
			db.initDocumentTables({ useFts: true });

			const embedding = new Float32Array([0.1, 0.2, 0.3]);

			db.insertDocument('doc-001', 'Andrew Allan is a software engineer', embedding, {});
			db.insertDocumentFts('doc-001', 'Andrew Allan is a software engineer');

			const results = db.searchFts('Andrew');

			expect(results).toHaveLength(1);
			expect(results[0].id).toBe('doc-001');
		});

		it('given database with 3 documents, when resetDocuments called, then document count is 0', () => {
			db = new HrStafferDatabase(testDbPath);
			db.initialize();
			db.initDocumentTables();

			const embedding = new Float32Array([0.1, 0.2, 0.3]);

			db.insertDocument('doc-001', 'Content one', embedding, {});
			db.insertDocument('doc-002', 'Content two', embedding, {});
			db.insertDocument('doc-003', 'Content three', embedding, {});

			expect(db.getDocumentCount()).toBe(3);

			db.resetDocuments();

			expect(db.getDocumentCount()).toBe(0);
		});

		it('given database with documents and FTS, when resetDocuments called, then tables still exist but empty', () => {
			db = new HrStafferDatabase(testDbPath);
			db.initialize();
			db.initDocumentTables({ useFts: true });

			const embedding = new Float32Array([0.1, 0.2, 0.3]);

			db.insertDocument('doc-001', 'Test content', embedding, {});
			db.insertDocumentFts('doc-001', 'Test content');

			db.resetDocuments();

			// Tables should still exist
			expect(db.tableExists('documents')).toBe(true);
			expect(db.tableExists('documents_fts')).toBe(true);

			// But should be empty
			expect(db.getDocumentCount()).toBe(0);

			// And we can still insert new documents
			db.insertDocument('doc-002', 'New content', embedding, {});
			expect(db.getDocumentCount()).toBe(1);
		});
	});
});
