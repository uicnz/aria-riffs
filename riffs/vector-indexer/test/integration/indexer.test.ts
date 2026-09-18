/**
 * Integration tests for Indexer
 * These tests require Ollama and Qdrant to be running
 */

import pino from 'pino';
import { beforeAll, describe, expect, it } from 'vitest';
import { Indexer } from '../../src/core/indexer.js';
import { getDefaultConfig } from '../../src/lib/config.js';

describe.skip('Indexer Integration', () => {
	let indexer: Indexer;
	let logger: pino.Logger;
	const testCollection = `test-indexer-${Date.now()}`;

	beforeAll(() => {
		logger = pino({ level: 'silent' });
		const config = getDefaultConfig();
		indexer = new Indexer(config, logger);
	});

	it('should index a directory of markdown files', async () => {
		// Create test directory with markdown files
		// This is a placeholder - in real testing you'd create temp files

		const stats = await indexer.index({
			directory: 'test/fixtures',
			collection: testCollection,
		});

		expect(stats.documentsProcessed).toBeGreaterThan(0);
		expect(stats.chunksCreated).toBeGreaterThan(0);
		expect(stats.successRate).toBeGreaterThan(0);
	}, 60000);

	it('should handle errors gracefully', async () => {
		const stats = await indexer.index({
			directory: '/nonexistent/directory',
			collection: testCollection,
		});

		expect(stats.errors.length).toBeGreaterThan(0);
	});
});
