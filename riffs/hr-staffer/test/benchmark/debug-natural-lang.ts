#!/usr/bin/env bun

/**
 * Debug natural language query
 */

import { expandQuery } from '../../src/core/query-expansion.js';
import { search } from '../../src/core/search.js';
import { HrStafferDatabase } from '../../src/db/database.js';
import type { HrStafferEmbeddings } from '../../src/lib/schema.js';
import { createEmbeddingService } from '../../src/providers/embedding-client.js';

const DB_PATH = '.aria/db/hr-staffer/hr-staffer.db';

const EMBEDDING_CONFIG: HrStafferEmbeddings = {
	provider: 'openai',
	maxChars: 20000,
	batchSize: 64,
	openai: { apiKey: '', model: 'text-embedding-3-large', dimensions: 3072, timeout: 30 },
	gemini: {
		apiKey: '',
		model: 'text-embedding-004',
		dimensions: 768,
		timeout: 30,
		baseUrl: 'https://generativelanguage.googleapis.com/v1',
	},
	ollama: {
		endpoint: 'http://localhost:11434/',
		model: 'nomic-embed-text:latest',
		dimensions: 768,
		timeout: 60,
		keepAlive: 300,
	},
};

async function debug(): Promise<void> {
	const query = 'who manages the NOC team';

	console.log('=== DEBUG NATURAL LANGUAGE QUERY ===\n');
	console.log('Query:', query);
	console.log('Expanded:', expandQuery(query));
	console.log();

	const db = new HrStafferDatabase(DB_PATH);
	db.initialize();
	const embeddingService = createEmbeddingService(EMBEDDING_CONFIG);

	const results = await search({
		query,
		db,
		embeddingService,
		options: { hybrid: true, nResults: 15 },
	});

	console.log('Top 15 Results:\n');
	for (let i = 0; i < results.length; i++) {
		const r = results[i];
		if (!r) continue;
		const meta = r.metadata as Record<string, string>;
		const isDale = r.id.includes('dale-clutterbuck') ? ' <-- EXPECTED' : '';
		console.log(`#${i + 1}: ${r.id}${isDale}`);
		console.log(`    Title: ${meta['job_title']}`);
		console.log(
			`    Score: ${r.score.toFixed(4)} (sem: ${r.sem_score.toFixed(4)}, lex: ${r.lex_score.toFixed(4)}, field: ${r.field_score.toFixed(4)}, name: ${r.name_score.toFixed(4)})`
		);
		console.log();
	}

	db.close();
}

debug().catch(console.error);
