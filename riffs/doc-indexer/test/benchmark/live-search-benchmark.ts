#!/usr/bin/env bun

/**
 * Live search benchmark for doc-indexer
 *
 * Tests search quality across diverse query types using real production data.
 * Run: bun riffs/doc-indexer/test/benchmark/live-search-benchmark.ts
 */

import { pino } from 'pino';
import { DocIndexer } from '../../src/core/indexer.js';
import { SearchService } from '../../src/core/search.js';

const DB_PATH = '.aria/db/doc-indexer/vectors.sqlite';

interface BenchmarkQuery {
	type: string;
	query: string;
	expectedId?: string;
	expectedTitle?: string;
	expectedIdentifier?: string;
	description: string;
}

// Diverse query types for comprehensive testing
const BENCHMARK_QUERIES: BenchmarkQuery[] = [
	// Identifier lookups
	{
		type: 'IdentifierExact',
		query: 'MR27',
		expectedIdentifier: 'MR27',
		expectedTitle: 'Problem Management',
		description: 'Exact identifier lookup',
	},
	{
		type: 'IdentifierExact2',
		query: 'SR1',
		expectedIdentifier: 'SR1',
		expectedTitle: 'Secure Cloud Architecture',
		description: 'Security requirement lookup',
	},

	// Title/topic searches
	{
		type: 'TopicExact',
		query: 'Problem Management',
		expectedIdentifier: 'MR27',
		description: 'Exact topic search',
	},
	{
		type: 'TopicPartial',
		query: 'Incident Management',
		expectedIdentifier: 'MR26',
		description: 'Partial topic match',
	},

	// Technical term searches
	{
		type: 'TechnicalTerm',
		query: 'Zero Trust',
		expectedIdentifier: 'SR1',
		description: 'Technical security term',
	},
	{
		type: 'TechnicalTerm2',
		query: 'DDOS protection',
		expectedIdentifier: 'BR43',
		description: 'Security attack term',
	},

	// Abbreviation searches
	{
		type: 'Abbreviation',
		query: 'SLA',
		expectedIdentifier: 'MR16',
		description: 'Service Level Agreement search',
	},
	{
		type: 'Abbreviation2',
		query: 'SIEM',
		expectedIdentifier: 'SR1',
		description: 'Security information term',
	},

	// Department/category context
	{
		type: 'DepartmentTopic',
		query: 'NOC operations support',
		expectedIdentifier: 'MR19',
		description: 'Department + topic search',
	},
	{
		type: 'CategoryTopic',
		query: 'security architecture cloud',
		expectedIdentifier: 'SR1',
		description: 'Multi-term security search',
	},

	// Natural language queries
	{
		type: 'NaturalLang',
		query: 'how do you handle problem tickets',
		expectedIdentifier: 'MR27',
		description: 'Natural language question',
	},
	{
		type: 'NaturalLang2',
		query: 'what is the patching process',
		expectedIdentifier: 'MR9',
		description: 'Process inquiry',
	},

	// Content-specific searches
	{
		type: 'ContentSpecific',
		query: 'Meraki dashboard',
		expectedIdentifier: 'SR1',
		description: 'Product-specific search',
	},
	{
		type: 'ContentSpecific2',
		query: 'certificate management PKI',
		expectedIdentifier: 'MR13',
		description: 'Technical content search',
	},

	// Multi-term complex queries
	{
		type: 'MultiTerm',
		query: 'change management testing validation',
		expectedIdentifier: 'MR6',
		description: 'Multi-term process search',
	},
];

async function runBenchmark(): Promise<void> {
	const logger = pino({ level: 'silent' });

	console.log('Loading database...');
	const indexer = new DocIndexer(DB_PATH, logger, process.env['OPENAI_API_KEY']);
	indexer.connect();

	const searchService = new SearchService(indexer);

	// Get document count
	const db = indexer.getDb();
	const countResult = db.prepare('SELECT COUNT(*) as count FROM documents').get() as { count: number };
	console.log(`Database loaded: ${countResult.count} documents\n`);

	console.log('Running benchmark queries...\n');
	console.log('='.repeat(100));

	const results: Array<{
		type: string;
		query: string;
		expectedIdentifier?: string;
		rank: number;
		score: number;
		pass: boolean;
		gotId: string;
		gotIdentifier?: string;
		gotTitle?: string;
	}> = [];

	for (const benchmark of BENCHMARK_QUERIES) {
		const searchResults = await searchService.search(benchmark.query, 10, {
			hybrid: true,
			alpha: 0.3,
		});

		let rank = -1;
		let gotResult = searchResults[0];
		let pass = false;

		// Find expected result
		if (benchmark.expectedIdentifier) {
			for (let i = 0; i < searchResults.length; i++) {
				const r = searchResults[i];
				if (r?.metadata?.identifier === benchmark.expectedIdentifier) {
					rank = i + 1;
					gotResult = r;
					break;
				}
			}
			pass = rank >= 1 && rank <= 3;
		}

		const score = gotResult?.score ?? 0;
		const gotId = gotResult?.id ?? 'N/A';
		const gotIdentifier = gotResult?.metadata?.identifier;
		const gotTitle = gotResult?.metadata?.title?.slice(0, 50);

		const status = pass ? '[PASS]' : '[FAIL]';
		console.log(`${status} ${benchmark.type.padEnd(18)} | "${benchmark.query}"`);
		console.log(`       Expected: ${benchmark.expectedIdentifier ?? 'any'} (${benchmark.description})`);
		console.log(`       Got #1:   ${gotIdentifier ?? 'N/A'} - ${gotTitle ?? 'N/A'}`);
		console.log(`       Rank: ${rank} | Score: ${score.toFixed(4)}`);
		console.log('-'.repeat(100));

		results.push({
			type: benchmark.type,
			query: benchmark.query,
			expectedIdentifier: benchmark.expectedIdentifier,
			rank,
			score,
			pass,
			gotId,
			gotIdentifier,
			gotTitle,
		});
	}

	// Summary
	const passed = results.filter(r => r.pass).length;
	const total = results.length;
	const avgScore = results.reduce((sum, r) => sum + r.score, 0) / total;

	console.log(`\n${'='.repeat(100)}`);
	console.log('BENCHMARK SUMMARY');
	console.log('='.repeat(100));
	console.log(`Queries in Top 3: ${passed}/${total} (${((passed / total) * 100).toFixed(0)}%)`);
	console.log(`Average Score:    ${avgScore.toFixed(4)}`);
	console.log('='.repeat(100));

	// Table output
	console.log('\n| Type             | Query                          | Expected | Rank | Score  | Pass |');
	console.log('|------------------|--------------------------------|----------|------|--------|------|');
	for (const r of results) {
		const queryTrunc = r.query.length > 30 ? `${r.query.slice(0, 27)}...` : r.query.padEnd(30);
		const expected = (r.expectedIdentifier ?? 'any').padEnd(8);
		const rankStr = r.rank > 0 ? String(r.rank).padStart(4) : '  -1';
		const passStr = r.pass ? 'YES  ' : 'NO   ';
		console.log(
			`| ${r.type.padEnd(16)} | ${queryTrunc} | ${expected} | ${rankStr} | ${r.score.toFixed(4)} | ${passStr}|`
		);
	}

	indexer.close();
}

runBenchmark().catch(console.error);
