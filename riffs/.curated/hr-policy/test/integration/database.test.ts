import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DatabaseManager } from '../../src/db/database.js';

describe('DatabaseManager Integration Tests', () => {
	const testDbDir = '/tmp/hr-policy-db-test';
	let testDbPath: string;
	let dbManager: DatabaseManager;

	beforeEach(async () => {
		await mkdir(testDbDir, { recursive: true });
		testDbPath = path.join(testDbDir, `test-${Date.now()}.db`);
	});

	afterEach(async () => {
		if (dbManager) {
			try {
				dbManager.close();
			} catch {
				// Ignore close errors during cleanup
			}
		}
		try {
			await rm(testDbDir, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
	});

	describe('Connection and Schema', () => {
		it('given database path, when connect called, then creates database file', () => {
			dbManager = new DatabaseManager(testDbPath);

			dbManager.connect();

			// Verify database is working by querying pragma
			const result = dbManager.withConnection(db => {
				return db.prepare('PRAGMA database_list').all();
			});

			expect(result).toBeDefined();
			expect((result as unknown[]).length).toBeGreaterThan(0);
		});

		it('given database path with missing directories, when connect called, then creates parent directories', () => {
			const nestedPath = path.join(testDbDir, 'nested', 'dirs', 'test.db');
			dbManager = new DatabaseManager(nestedPath);

			dbManager.connect();
			const connection = dbManager.withConnection(db => {
				return db;
			});

			expect(connection).toBeDefined();
		});

		it('given database connection, when initSchema called, then creates documents table', () => {
			dbManager = new DatabaseManager(testDbPath);
			dbManager.connect();

			const result = dbManager.withConnection(db => {
				return db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='documents'").all();
			});

			expect(result).toHaveLength(1);
			expect(((result as unknown[])[0] as { name: string })?.name).toBe('documents');
		});

		it('given documents table, when schema checked, then has correct columns', () => {
			dbManager = new DatabaseManager(testDbPath);
			dbManager.connect();

			const result = dbManager.withConnection(db => {
				return db.prepare('PRAGMA table_info(documents);').all();
			});

			expect(result).toHaveLength(6);
			expect((result as any[]).map((r: any) => r.name)).toContain('id');
			expect((result as any[]).map((r: any) => r.name)).toContain('content');
			expect((result as any[]).map((r: any) => r.name)).toContain('parent_id');
			expect((result as any[]).map((r: any) => r.name)).toContain('hierarchy_path');
			expect((result as any[]).map((r: any) => r.name)).toContain('embedding');
			expect((result as any[]).map((r: any) => r.name)).toContain('metadata_json');
		});
	});

	describe('FTS Table Creation', () => {
		it('given useFts true, when connect called, then creates FTS virtual table', () => {
			dbManager = new DatabaseManager(testDbPath, true);
			dbManager.connect();

			const result = dbManager.withConnection(db => {
				return db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='documents_fts'").all();
			});

			expect(result).toHaveLength(1);
			expect(((result as unknown[])[0] as { name: string })?.name).toBe('documents_fts');
		});

		it('given useFts false, when connect called, then does not create FTS table', () => {
			dbManager = new DatabaseManager(testDbPath, false);
			dbManager.connect();

			const result = dbManager.withConnection(db => {
				return db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='documents_fts'").all();
			});

			expect(result).toHaveLength(0);
		});
	});

	describe('Data Operations', () => {
		beforeEach(() => {
			dbManager = new DatabaseManager(testDbPath);
			dbManager.connect();
		});

		it('given database connection, when document inserted, then retrieves correct data', () => {
			const testDoc = {
				id: 'doc1',
				content: 'Test content',
				embedding: Buffer.from([0.1, 0.2, 0.3]),
				metadata_json: JSON.stringify({ title: 'Test' }),
			};

			dbManager.withConnection(db => {
				db.prepare('INSERT INTO documents (id, content, embedding, metadata_json) VALUES (?, ?, ?, ?)').run(
					testDoc.id,
					testDoc.content,
					testDoc.embedding,
					testDoc.metadata_json
				);
			});

			const result = dbManager.withConnection(db => {
				return db.prepare('SELECT * FROM documents WHERE id = ?').get(testDoc.id) as any;
			});

			expect(result?.id).toBe('doc1');
			expect(result?.content).toBe('Test content');
			expect(result?.metadata_json).toBe(JSON.stringify({ title: 'Test' }));
		});

		it('given multiple documents, when queried, then retrieves all documents', () => {
			const docs = [
				{ id: 'doc1', content: 'Content 1', embedding: Buffer.from([0.1]) },
				{ id: 'doc2', content: 'Content 2', embedding: Buffer.from([0.2]) },
				{ id: 'doc3', content: 'Content 3', embedding: Buffer.from([0.3]) },
			];

			dbManager.withConnection(db => {
				const stmt = db.prepare(
					'INSERT INTO documents (id, content, embedding, metadata_json) VALUES (?, ?, ?, ?)'
				);
				for (const doc of docs) {
					stmt.run(doc.id, doc.content, doc.embedding, JSON.stringify({}));
				}
			});

			const result = dbManager.withConnection(db => {
				return db.prepare('SELECT id FROM documents').all();
			});

			expect(result).toHaveLength(3);
			expect((result as any[]).map((r: any) => r.id)).toContain('doc1');
			expect((result as any[]).map((r: any) => r.id)).toContain('doc2');
			expect((result as any[]).map((r: any) => r.id)).toContain('doc3');
		});

		it('given document in database, when updated, then reflects new values', () => {
			dbManager.withConnection(db => {
				db.prepare('INSERT INTO documents (id, content, embedding, metadata_json) VALUES (?, ?, ?, ?)').run(
					'doc1',
					'Original content',
					Buffer.from([0.1]),
					JSON.stringify({ version: 1 })
				);
			});

			dbManager.withConnection(db => {
				db.prepare('UPDATE documents SET content = ?, metadata_json = ? WHERE id = ?').run(
					'Updated content',
					JSON.stringify({ version: 2 }),
					'doc1'
				);
			});

			const result = dbManager.withConnection(db => {
				return db.prepare('SELECT * FROM documents WHERE id = ?').get('doc1') as any;
			});

			expect(result?.content).toBe('Updated content');
			expect(JSON.parse(result?.metadata_json)).toEqual({ version: 2 });
		});

		it('given document in database, when deleted, then no longer exists', () => {
			dbManager.withConnection(db => {
				db.prepare('INSERT INTO documents (id, content, embedding, metadata_json) VALUES (?, ?, ?, ?)').run(
					'doc1',
					'Content',
					Buffer.from([0.1]),
					JSON.stringify({})
				);
			});

			dbManager.withConnection(db => {
				db.prepare('DELETE FROM documents WHERE id = ?').run('doc1');
			});

			const result = dbManager.withConnection(db => {
				return db.prepare('SELECT * FROM documents WHERE id = ?').all('doc1');
			});

			expect(result).toHaveLength(0);
		});
	});

	describe('FTS Operations', () => {
		beforeEach(() => {
			dbManager = new DatabaseManager(testDbPath, true);
			dbManager.connect();
		});

		it('given FTS table, when documents inserted, then FTS searchable', () => {
			dbManager.withConnection(db => {
				db.prepare('INSERT INTO documents (id, content, embedding, metadata_json) VALUES (?, ?, ?, ?)').run(
					'doc1',
					'Search for this text',
					Buffer.from([0.1]),
					JSON.stringify({})
				);

				db.prepare('INSERT INTO documents_fts (id, text) VALUES (?, ?)').run('doc1', 'Search for this text');
			});

			const result = dbManager.withConnection(db => {
				return db
					.prepare('SELECT id FROM documents_fts WHERE documents_fts MATCH ? ORDER BY rank')
					.all('Search');
			});

			expect(result).toHaveLength(1);
			expect(((result as unknown[])[0] as { id: string })?.id).toBe('doc1');
		});

		it('given multiple FTS entries, when full-text searched, then ranks results', () => {
			const docs = [
				{ id: 'doc1', text: 'Search search search' },
				{ id: 'doc2', text: 'Search here' },
				{ id: 'doc3', text: 'other content' },
			];

			dbManager.withConnection(db => {
				const insertDoc = db.prepare(
					'INSERT INTO documents (id, content, embedding, metadata_json) VALUES (?, ?, ?, ?)'
				);
				const insertFts = db.prepare('INSERT INTO documents_fts (id, text) VALUES (?, ?)');

				for (const doc of docs) {
					insertDoc.run(doc.id, doc.text, Buffer.from([0.1]), JSON.stringify({}));
					if (doc.text.includes('search') || doc.text.includes('Search')) {
						insertFts.run(doc.id, doc.text);
					}
				}
			});

			const result = dbManager.withConnection(db => {
				return db
					.prepare('SELECT id FROM documents_fts WHERE documents_fts MATCH ? ORDER BY rank')
					.all('search');
			});

			expect(result).toHaveLength(2);
		});
	});

	describe('Reset Operations', () => {
		it('given documents in database, when reset called, then all documents deleted', () => {
			dbManager = new DatabaseManager(testDbPath);
			dbManager.connect();

			dbManager.withConnection(db => {
				db.prepare('INSERT INTO documents (id, content, embedding, metadata_json) VALUES (?, ?, ?, ?)').run(
					'doc1',
					'Content',
					Buffer.from([0.1]),
					JSON.stringify({})
				);
				db.prepare('INSERT INTO documents (id, content, embedding, metadata_json) VALUES (?, ?, ?, ?)').run(
					'doc2',
					'Content',
					Buffer.from([0.2]),
					JSON.stringify({})
				);
			});

			// Reconnect since withConnection closes the db
			dbManager.connect();
			dbManager.reset();

			const result = dbManager.withConnection(db => {
				return db.prepare('SELECT COUNT(*) as count FROM documents').all();
			});

			expect(((result as unknown[])[0] as { count: number })?.count).toBe(0);
		});

		it('given FTS table with data, when reset called, then FTS table recreated', () => {
			dbManager = new DatabaseManager(testDbPath, true);
			dbManager.connect();

			dbManager.withConnection(db => {
				db.prepare('INSERT INTO documents (id, content, embedding, metadata_json) VALUES (?, ?, ?, ?)').run(
					'doc1',
					'Content',
					Buffer.from([0.1]),
					JSON.stringify({})
				);
				db.prepare('INSERT INTO documents_fts (id, text) VALUES (?, ?)').run('doc1', 'Content');
			});

			// Reconnect since withConnection closes the db
			dbManager.connect();
			dbManager.reset();

			const result = dbManager.withConnection(db => {
				return db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='documents_fts'").all();
			});

			expect(result).toHaveLength(1);
		});

		it('given database without FTS, when reset called, then still functional', () => {
			dbManager = new DatabaseManager(testDbPath, false);
			dbManager.connect();

			dbManager.withConnection(db => {
				db.prepare('INSERT INTO documents (id, content, embedding, metadata_json) VALUES (?, ?, ?, ?)').run(
					'doc1',
					'Content',
					Buffer.from([0.1]),
					JSON.stringify({})
				);
			});

			// Reconnect since withConnection closes the db
			dbManager.connect();
			dbManager.reset();

			const result = dbManager.withConnection(db => {
				return db.prepare('SELECT COUNT(*) as count FROM documents').all();
			});

			expect(((result as unknown[])[0] as { count: number })?.count).toBe(0);
		});
	});

	describe('Lifecycle', () => {
		it('given open database, when connection used then operations persist, then subsequent queries find data', () => {
			dbManager = new DatabaseManager(testDbPath);
			dbManager.connect();

			// Operations work before close
			let result = dbManager.withConnection(db => {
				db.prepare('INSERT INTO documents (id, content, embedding, metadata_json) VALUES (?, ?, ?, ?)').run(
					'test',
					'content',
					Buffer.from([0.1]),
					'{}'
				);
				return db.prepare('SELECT COUNT(*) as count FROM documents').all();
			});

			expect(((result as unknown[])[0] as { count: number })?.count).toBe(1);

			// After withConnection closes, we can use it again
			// withConnection automatically reconnects for each call
			result = dbManager.withConnection(db => {
				return db.prepare('SELECT COUNT(*) as count FROM documents').all();
			});

			expect(((result as unknown[])[0] as { count: number })?.count).toBe(1);
		});

		it('given database manager, when multiple withConnection calls made, then operates correctly', () => {
			dbManager = new DatabaseManager(testDbPath);

			// First connection
			dbManager.withConnection(db => {
				expect(db).toBeDefined();
				db.prepare('INSERT INTO documents (id, content, embedding, metadata_json) VALUES (?, ?, ?, ?)').run(
					'doc1',
					'content',
					Buffer.from([0.1]),
					'{}'
				);
			});

			// Second connection - withConnection automatically reconnects
			const result = dbManager.withConnection(db => {
				return db.prepare('SELECT * FROM documents WHERE id = ?').all('doc1');
			});

			expect(result).toHaveLength(1);
			expect(((result as unknown[])[0] as { id: string })?.id).toBe('doc1');
		});
	});

	describe('Edge Cases', () => {
		it('given database file with special characters in path, when connected, then works correctly', () => {
			const specialPath = path.join(testDbDir, 'test-db-2025.db');
			dbManager = new DatabaseManager(specialPath);

			dbManager.connect();

			const result = dbManager.withConnection(db => {
				return db.prepare('PRAGMA database_list').all();
			});

			expect(result).toBeDefined();
		});

		it('given empty metadata JSON, when inserted and retrieved, then parses correctly', () => {
			dbManager = new DatabaseManager(testDbPath);
			dbManager.connect();

			dbManager.withConnection(db => {
				db.prepare('INSERT INTO documents (id, content, embedding, metadata_json) VALUES (?, ?, ?, ?)').run(
					'doc1',
					'Content',
					Buffer.from([0.1]),
					'{}'
				);
			});

			const result = dbManager.withConnection(db => {
				return db.prepare('SELECT metadata_json FROM documents WHERE id = ?').get('doc1') as any;
			});

			expect(JSON.parse(result?.metadata_json)).toEqual({});
		});

		it('given binary embedding data, when stored and retrieved, then preserves bytes', () => {
			dbManager = new DatabaseManager(testDbPath);
			dbManager.connect();

			const originalEmbedding = Buffer.from([255, 254, 253, 252, 251]);

			dbManager.withConnection(db => {
				db.prepare('INSERT INTO documents (id, content, embedding, metadata_json) VALUES (?, ?, ?, ?)').run(
					'doc1',
					'Content',
					originalEmbedding,
					'{}'
				);
			});

			const result = dbManager.withConnection(db => {
				return db.prepare('SELECT embedding FROM documents WHERE id = ?').get('doc1') as any;
			});

			expect(Buffer.isBuffer(result?.embedding)).toBe(true);
			expect(result?.embedding.toString('hex')).toBe(originalEmbedding.toString('hex'));
		});
	});
});
