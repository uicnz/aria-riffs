#!/usr/bin/env bun

/**
 * Live benchmark against real HR Staffer database.
 * Run directly: bun riffs/.curated/hr-staffer/test/benchmark/live-search-benchmark.ts
 */

import { search } from '../../src/core/search.js';
import { HrStafferDatabase } from '../../src/db/database.js';
import type { HrStafferEmbeddings } from '../../src/lib/schema.js';
import { createEmbeddingService } from '../../src/providers/embedding-client.js';

const DB_PATH = '.aria/db/hr-staffer/hr-staffer.db';

const EMBEDDING_CONFIG: HrStafferEmbeddings = {
	provider: 'openai',
	maxChars: 20000,
	batchSize: 64,
	openai: {
		apiKey: '',
		model: 'text-embedding-3-large',
		dimensions: 3072,
		timeout: 30,
	},
	gemini: {
		apiKey: '',
		model: 'gemini-embedding-2',
		dimensions: 768,
		timeout: 30,
		baseUrl: 'https://generativelanguage.googleapis.com/v1',
	},
	ollama: {
		endpoint: 'http://localhost:11434/',
		model: 'embeddinggemma:latest',
		dimensions: 768,
		timeout: 60,
		keepAlive: 300,
	},
};

interface QueryTest {
	query: string;
	type: string;
	expectedId: string; // Expected person's ID prefix (e.g., "0029-jonathan")
	expectedName: string; // For display
}

// 10 diverse queries against REAL data
const TEST_QUERIES: QueryTest[] = [
	// Q1: Exact title - CTO
	{
		query: 'Chief Technology Officer',
		type: 'ExactTitle',
		expectedId: '0029-jonathan-holt',
		expectedName: 'Jonathan Holt',
	},
	// Q2: Abbreviation - CTO
	{
		query: 'CTO',
		type: 'Abbreviation',
		expectedId: '0029-jonathan-holt',
		expectedName: 'Jonathan Holt',
	},
	// Q3: Person name search
	{
		query: 'Dale Clutterbuck',
		type: 'PersonName',
		expectedId: '0058-dale-clutterbuck',
		expectedName: 'Dale Clutterbuck',
	},
	// Q4: Location + role - Shaun Graveston is "Network Engineer" in Dunedin (exact match)
	{
		query: 'Network Engineer Dunedin',
		type: 'Location+Role',
		expectedId: '0099-shaun-graveston',
		expectedName: 'Shaun Graveston (Network Engineer Dunedin)',
	},
	// Q5: Department/team search
	{
		query: 'NOC Manager',
		type: 'TeamRole',
		expectedId: '0058-dale-clutterbuck',
		expectedName: 'Dale Clutterbuck',
	},
	// Q6: Multi-term specific
	{
		query: 'Senior Network Engineer Wellington',
		type: 'MultiTerm',
		expectedId: '0083-paul-bancroft',
		expectedName: 'Paul Bancroft',
	},
	// Q7: Partial match - any NOC engineer
	{
		query: 'NOC Engineer Christchurch',
		type: 'PartialMatch',
		expectedId: '0060-amanpreet', // Any NOC engineer in Christchurch
		expectedName: 'Any NOC Engineer in Christchurch',
	},
	// Q8: CIO/CISO search
	{
		query: 'CIO',
		type: 'Abbreviation2',
		expectedId: '0015-falko-weber',
		expectedName: 'Falko Weber',
	},
	// Q9: Synonym search - developer should find engineers
	{
		query: 'developer Wellington',
		type: 'Synonym',
		expectedId: '0019-puneeth', // Senior .NET Developer Wellington
		expectedName: 'Puneeth Anandaraj (.NET Developer)',
	},
	// Q10: Natural language
	{
		query: 'who manages the NOC team',
		type: 'NaturalLang',
		expectedId: '0058-dale-clutterbuck',
		expectedName: 'Dale Clutterbuck',
	},
];

interface BenchmarkResult {
	query: string;
	type: string;
	expectedName: string;
	actualTop: string;
	actualTitle: string;
	expectedRank: number;
	topScore: number;
	expectedScore: number;
	passed: boolean;
}

async function runBenchmark(): Promise<void> {
	console.log('Loading database...');
	const db = new HrStafferDatabase(DB_PATH);
	db.initialize();

	const docCount = db.getDocumentCount();
	console.log(`Database loaded: ${docCount} documents\n`);

	// Check if we have embeddings
	const apiKey = process.env['OPENAI_API_KEY'];
	if (!apiKey) {
		console.error('ERROR: OPENAI_API_KEY not set. Cannot run live benchmark.');
		process.exit(1);
	}

	const embeddingService = createEmbeddingService(EMBEDDING_CONFIG);

	const results: BenchmarkResult[] = [];

	console.log('Running benchmark queries...\n');
	console.log('='.repeat(100));

	for (const test of TEST_QUERIES) {
		const searchResults = await search({
			query: test.query,
			db,
			embeddingService,
			options: {
				hybrid: true,
				nResults: 10,
			},
		});

		const topResult = searchResults[0];
		const expectedIndex = searchResults.findIndex(r =>
			r.id.startsWith(test.expectedId.split('-').slice(0, 2).join('-'))
		);
		const expectedResult = searchResults[expectedIndex];

		// For Q7, any NOC Engineer in Christchurch counts as success
		let passed: boolean;
		if (test.type === 'PartialMatch') {
			const topMeta = topResult?.metadata as Record<string, string> | undefined;
			passed =
				(topMeta?.['job_title']?.includes('NOC Engineer') ?? false) && topMeta?.['city'] === 'Christchurch';
		} else {
			passed = expectedIndex >= 0 && expectedIndex < 3;
		}

		const topMeta = topResult?.metadata as Record<string, string> | undefined;

		const result: BenchmarkResult = {
			query: test.query,
			type: test.type,
			expectedName: test.expectedName,
			actualTop: topResult?.id ?? 'none',
			actualTitle: topMeta?.['job_title'] ?? 'unknown',
			expectedRank: expectedIndex >= 0 ? expectedIndex + 1 : -1,
			topScore: topResult?.score ?? 0,
			expectedScore: expectedResult?.score ?? 0,
			passed,
		};

		results.push(result);

		// Print each result
		const status = result.passed ? '[PASS]' : '[FAIL]';
		console.log(`${status} ${test.type.padEnd(14)} | "${test.query}"`);
		console.log(`       Expected: ${test.expectedName}`);
		console.log(`       Got #1:   ${topResult?.id} (${topMeta?.['job_title']})`);
		console.log(`       Rank: ${result.expectedRank} | Score: ${result.expectedScore.toFixed(4)}`);
		console.log('-'.repeat(100));
	}

	// Summary
	const passed = results.filter(r => r.passed).length;
	const total = results.length;
	const avgScore = results.reduce((sum, r) => sum + r.expectedScore, 0) / total;

	console.log(`\n${'='.repeat(100)}`);
	console.log('BENCHMARK SUMMARY');
	console.log('='.repeat(100));
	console.log(`Queries in Top 3: ${passed}/${total} (${((passed / total) * 100).toFixed(0)}%)`);
	console.log(`Average Score:    ${avgScore.toFixed(4)}`);
	console.log('='.repeat(100));

	// Detailed table
	console.log('\n| Type           | Query                          | Expected Rank | Score  | Pass |');
	console.log('|----------------|--------------------------------|---------------|--------|------|');
	for (const r of results) {
		const shortQuery = r.query.length > 30 ? `${r.query.slice(0, 27)}...` : r.query;
		const passStr = r.passed ? 'YES' : 'NO';
		console.log(
			`| ${r.type.padEnd(14)} | ${shortQuery.padEnd(30)} | ${String(r.expectedRank).padEnd(13)} | ${r.expectedScore.toFixed(4)} | ${passStr.padEnd(4)} |`
		);
	}

	db.close();
}

runBenchmark().catch(console.error);
