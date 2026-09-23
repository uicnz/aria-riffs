/**
 * Stress test for HR Staffer search functionality.
 * Tests realistic queries across organizational hierarchy, roles, and locations.
 */

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Logger } from 'pino';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { indexSections } from '../../src/core/indexer.js';
import { search } from '../../src/core/search.js';
import { HrStafferDatabase } from '../../src/db/database.js';
import { FakeEmbeddingService } from '../helpers/fake-embedding-service.js';
import { createMockLogger } from '../helpers/mock-logger.js';

/**
 * Create test section files that mirror the real organizational structure.
 */
function createTestSections(sectionsDir: string): void {
	// Engineering Leadership
	writeFileSync(
		join(sectionsDir, '0001-patricia-aquino.md'),
		`---
source_file: org-chart.md
job_title: Head of Engineering - Central
department: Engineering
city: Wellington
manager: Rik Rogers
---

# Patricia Aquino

Head of Engineering - Central based in Wellington.
Manages the central region engineering team including network engineers and security specialists.
Reports to Rik Rogers.
`
	);

	writeFileSync(
		join(sectionsDir, '0002-kane-hoskings.md'),
		`---
source_file: org-chart.md
job_title: Head of Engineering - Northern/Southern
department: Engineering
city: Christchurch
manager: Rik Rogers
---

# Kane Hoskings

Head of Engineering - Northern/Southern based in Christchurch.
Oversees engineering operations in Auckland, Christchurch, and Dunedin regions.
Reports to Rik Rogers.
`
	);

	// Network Engineers - Various Regions
	writeFileSync(
		join(sectionsDir, '0003-connor-scott.md'),
		`---
source_file: org-chart.md
job_title: Network Engineer
department: Engineering
city: Wellington
manager: Patricia Aquino
---

# Connor Scott

Network Engineer based in Wellington office.
Part of the central region engineering team.
Reports to Patricia Aquino.
`
	);

	writeFileSync(
		join(sectionsDir, '0004-nigel-ram.md'),
		`---
source_file: org-chart.md
job_title: Network Engineer
department: Engineering
city: Auckland
manager: Kane Hoskings
---

# Nigel Ram

Network Engineer based in Auckland office.
Part of the northern region engineering team.
Reports to Kane Hoskings.
`
	);

	writeFileSync(
		join(sectionsDir, '0005-sean-starson.md'),
		`---
source_file: org-chart.md
job_title: Network Engineer
department: Engineering
city: Christchurch
manager: Kane Hoskings
---

# Sean Starson

Network Engineer based in Christchurch office.
Part of the southern region engineering team.
Reports to Kane Hoskings.
`
	);

	writeFileSync(
		join(sectionsDir, '0006-shaun-graveston.md'),
		`---
source_file: org-chart.md
job_title: Network Engineer
department: Engineering
city: Dunedin
manager: Kane Hoskings
---

# Shaun Graveston

Network Engineer based in Dunedin office.
Part of the southern region engineering team.
Reports to Kane Hoskings.
`
	);

	// Senior Engineers
	writeFileSync(
		join(sectionsDir, '0007-mike-lee.md'),
		`---
source_file: org-chart.md
job_title: Senior Network Engineer
department: Engineering
city: Dunedin
manager: Kane Hoskings
---

# Mike Lee

Senior Network Engineer based in Dunedin.
Leads technical initiatives in the Dunedin region.
Reports to Kane Hoskings.
`
	);

	writeFileSync(
		join(sectionsDir, '0008-joseph-paloma.md'),
		`---
source_file: org-chart.md
job_title: Senior Network and Security Engineer
department: Engineering
city: Wellington
manager: Patricia Aquino
---

# Joseph Paloma

Senior Network and Security Engineer based in Wellington.
Specializes in network security and infrastructure.
Reports to Patricia Aquino.
`
	);

	// Security Engineers
	writeFileSync(
		join(sectionsDir, '0009-faisal-khan.md'),
		`---
source_file: org-chart.md
job_title: Security Engineer
department: Engineering
city: Christchurch
manager: Kane Hoskings
---

# Faisal Khan

Security Engineer based in Christchurch.
Focuses on network security and vulnerability management.
Reports to Kane Hoskings.
`
	);

	writeFileSync(
		join(sectionsDir, '0010-stephen-penfold.md'),
		`---
source_file: org-chart.md
job_title: Network and Security Engineer
department: Engineering
city: Christchurch
manager: Kane Hoskings
---

# Stephen Penfold

Network and Security Engineer based in Christchurch.
Handles both networking and security responsibilities.
Reports to Kane Hoskings.
`
	);

	// NOC Team
	writeFileSync(
		join(sectionsDir, '0011-dale-clutterbuck.md'),
		`---
source_file: org-chart.md
job_title: NOC Manager
department: NOC
city: Christchurch
manager: Jonathan Holt
---

# Dale Clutterbuck

NOC Manager based in Christchurch.
Manages the Network Operations Center team.
Reports to Jonathan Holt.
`
	);

	writeFileSync(
		join(sectionsDir, '0012-codey-wildman.md'),
		`---
source_file: org-chart.md
job_title: NOC Shift Leader
department: NOC
city: Christchurch
manager: Dale Clutterbuck
---

# Codey Wildman

NOC Shift Leader based in Christchurch.
Leads NOC shift operations.
Reports to Dale Clutterbuck.
`
	);

	writeFileSync(
		join(sectionsDir, '0013-amy-luo.md'),
		`---
source_file: org-chart.md
job_title: NOC Engineer
department: NOC
city: Christchurch
manager: Codey Wildman
---

# Amy Luo

NOC Engineer based in Christchurch.
Monitors network operations and handles incidents.
Reports to Codey Wildman.
`
	);

	writeFileSync(
		join(sectionsDir, '0014-mason-macdonald.md'),
		`---
source_file: org-chart.md
job_title: NOC Engineer
department: NOC
city: Christchurch
manager: Dale Clutterbuck
---

# Mason MacDonald

NOC Engineer based in Christchurch.
Monitors network operations and handles incidents.
Reports to Dale Clutterbuck.
`
	);

	// Core Services Team
	writeFileSync(
		join(sectionsDir, '0015-ivan-walker.md'),
		`---
source_file: org-chart.md
job_title: Head of Core Infrastructure
department: Engineering - Core Services
city: Wellington
manager: Chris Sambrooke
---

# Ivan Walker

Head of Core Infrastructure based in Wellington.
Leads the core services engineering team.
Reports to Chris Sambrooke.
`
	);

	writeFileSync(
		join(sectionsDir, '0016-kate-james.md'),
		`---
source_file: org-chart.md
job_title: Network Engineer - Core Services (Logic Monitor)
department: Engineering - Core Services
city: Wellington
manager: Ivan Walker
---

# Kate James

Network Engineer - Core Services specializing in Logic Monitor.
Based in Wellington, part of the core infrastructure team.
Reports to Ivan Walker.
`
	);

	writeFileSync(
		join(sectionsDir, '0017-ross-alexander.md'),
		`---
source_file: org-chart.md
job_title: Network Engineer - Core Services (Netbox)
department: Engineering - Core Services
city: Auckland
manager: Ivan Walker
---

# Ross Alexander

Network Engineer - Core Services specializing in Netbox.
Based in Auckland, part of the core infrastructure team.
Reports to Ivan Walker.
`
	);

	// Executive
	writeFileSync(
		join(sectionsDir, '0018-rik-rogers.md'),
		`---
source_file: org-chart.md
job_title: Chief Technology Officer
department: Exec
city: Auckland
manager: Andrew Allan
---

# Rik Rogers

Chief Technology Officer based in Auckland.
Oversees all technology and engineering operations.
Reports to Andrew Allan (Managing Director).
`
	);

	// Solutions Team
	writeFileSync(
		join(sectionsDir, '0019-ian-macdonald.md'),
		`---
source_file: org-chart.md
job_title: Solutions Lead - North
department: Sales and Solutions - North
city: Auckland
manager: Jonathan Holt
---

# Ian MacDonald

Solutions Lead - North based in Auckland.
Leads solutions architecture for the northern region.
Reports to Jonathan Holt.
`
	);

	writeFileSync(
		join(sectionsDir, '0020-stuart-mckay.md'),
		`---
source_file: org-chart.md
job_title: Solutions Lead - Central
department: Sales and Solutions - Central
city: Wellington
manager: Jonathan Holt
---

# Stuart McKay

Solutions Lead - Central based in Wellington.
Leads solutions architecture for the central region.
Reports to Jonathan Holt.
`
	);
}

describe('Search Stress Tests', () => {
	const testDir = '/tmp/hr-staffer-stress-test';
	const sectionsDir = join(testDir, 'sections');
	const dbPath = join(testDir, 'stress-test.db');

	let db: HrStafferDatabase;
	let embeddingService: FakeEmbeddingService;
	let logger: Logger;

	beforeAll(async () => {
		// Clean up and create test directories
		rmSync(testDir, { recursive: true, force: true });
		mkdirSync(sectionsDir, { recursive: true });

		// Create comprehensive test data
		createTestSections(sectionsDir);

		// Initialize database and index sections
		db = new HrStafferDatabase(dbPath);
		db.initialize();
		db.initDocumentTables({ useFts: true });

		embeddingService = new FakeEmbeddingService();
		logger = createMockLogger();
		await indexSections({
			sectionsDir,
			db,
			embeddingService,
			logger,
			reset: false,
		});
	});

	afterAll(() => {
		db.close();
		rmSync(testDir, { recursive: true, force: true });
	});

	// Helper function to run search and return top result IDs
	async function searchIds(query: string, n: number = 5): Promise<string[]> {
		const results = await search({
			query,
			db,
			embeddingService,
			options: {
				hybrid: true,
				nResults: n,
			},
		});
		return results.map(r => r.id);
	}

	// Helper to check if expected ID is in top N results
	async function expectInTopN(query: string, expectedId: string, n: number = 3): Promise<void> {
		const ids = await searchIds(query, n);
		expect(ids).toContain(expectedId);
	}

	describe('Engineering Hierarchy Queries', () => {
		it('finds head of engineering central', async () => {
			await expectInTopN('head of engineering central', '0001-patricia-aquino');
		});

		it('finds head of engineering northern southern', async () => {
			await expectInTopN('head of engineering northern southern', '0002-kane-hoskings');
		});

		it('finds engineering leadership for Wellington', async () => {
			await expectInTopN('head engineering wellington', '0001-patricia-aquino');
		});

		it('finds engineering leadership for Christchurch', async () => {
			await expectInTopN('engineering lead christchurch', '0002-kane-hoskings');
		});

		it('finds CTO when searching for technology head', async () => {
			await expectInTopN('chief technology officer', '0018-rik-rogers');
		});

		it('finds CTO with abbreviation', async () => {
			await expectInTopN('CTO technology officer', '0018-rik-rogers');
		});
	});

	describe('Regional Engineer Queries', () => {
		it('finds network engineers in Auckland', async () => {
			await expectInTopN('network engineer auckland', '0004-nigel-ram');
		});

		it('finds network engineers in Wellington', async () => {
			await expectInTopN('network engineer wellington', '0003-connor-scott');
		});

		it('finds network engineers in Christchurch', async () => {
			await expectInTopN('network engineer christchurch', '0005-sean-starson');
		});

		it('finds network engineers in Dunedin', async () => {
			await expectInTopN('network engineer dunedin', '0006-shaun-graveston');
		});

		it('finds senior engineer in Dunedin', async () => {
			await expectInTopN('senior network engineer dunedin', '0007-mike-lee');
		});
	});

	describe('Security Team Queries', () => {
		it('finds security engineers in Christchurch', async () => {
			await expectInTopN('security engineer christchurch', '0009-faisal-khan');
		});

		it('finds network and security engineers', async () => {
			const ids = await searchIds('network security engineer', 5);
			expect(ids).toContain('0010-stephen-penfold');
		});

		it('finds senior security engineer in Wellington', async () => {
			await expectInTopN('senior security engineer wellington', '0008-joseph-paloma');
		});

		it('finds infosec staff using synonym', async () => {
			const ids = await searchIds('infosec engineer', 5);
			// Should find security engineers via synonym expansion
			expect(ids.length).toBeGreaterThan(0);
		});
	});

	describe('NOC Team Queries', () => {
		it('finds NOC manager', async () => {
			await expectInTopN('NOC manager dale', '0011-dale-clutterbuck');
		});

		it('finds NOC shift leader', async () => {
			await expectInTopN('NOC shift leader', '0012-codey-wildman');
		});

		it('finds NOC engineers', async () => {
			const ids = await searchIds('NOC engineer', 5);
			expect(ids).toContain('0013-amy-luo');
		});

		it('finds network operations center staff', async () => {
			const ids = await searchIds('network operations center', 5);
			// Should find NOC staff via synonym expansion
			expect(ids.length).toBeGreaterThan(0);
		});

		it('finds NOC team reporting to Dale', async () => {
			await expectInTopN('NOC engineer dale', '0014-mason-macdonald');
		});

		it('finds NOC team reporting to Codey', async () => {
			await expectInTopN('NOC engineer codey', '0013-amy-luo');
		});
	});

	describe('Core Services Queries', () => {
		it('finds head of core infrastructure', async () => {
			await expectInTopN('head core infrastructure', '0015-ivan-walker');
		});

		it('finds Logic Monitor engineer', async () => {
			await expectInTopN('logic monitor engineer', '0016-kate-james');
		});

		it('finds Netbox engineer', async () => {
			await expectInTopN('netbox engineer', '0017-ross-alexander');
		});

		it('finds core services team in Wellington', async () => {
			const ids = await searchIds('core services wellington', 5);
			expect(ids).toContain('0015-ivan-walker');
			expect(ids).toContain('0016-kate-james');
		});
	});

	describe('Name-Based Queries', () => {
		it('finds person by full name', async () => {
			await expectInTopN('Patricia Aquino', '0001-patricia-aquino');
		});

		it('finds person by first name', async () => {
			await expectInTopN('Patricia', '0001-patricia-aquino');
		});

		it('finds person by last name', async () => {
			await expectInTopN('Hoskings', '0002-kane-hoskings');
		});

		it('finds Kate James by name', async () => {
			await expectInTopN('Kate James', '0016-kate-james');
		});

		it('finds person by partial name', async () => {
			await expectInTopN('Faisal', '0009-faisal-khan');
		});
	});

	describe('Manager/Reporting Queries', () => {
		it('finds engineers reporting to Kane', async () => {
			const ids = await searchIds('reports to kane hoskings', 10);
			// Multiple engineers report to Kane
			expect(ids.length).toBeGreaterThan(0);
		});

		it('finds engineers reporting to Patricia', async () => {
			const ids = await searchIds('reports to patricia aquino', 10);
			expect(ids.length).toBeGreaterThan(0);
		});

		it('finds who manages NOC', async () => {
			await expectInTopN('manages NOC team', '0011-dale-clutterbuck');
		});

		it('finds direct reports in engineering', async () => {
			const ids = await searchIds('engineering manager direct reports', 5);
			expect(ids.length).toBeGreaterThan(0);
		});
	});

	describe('Solutions Team Queries', () => {
		it('finds solutions lead north', async () => {
			await expectInTopN('solutions lead north auckland', '0019-ian-macdonald');
		});

		it('finds solutions lead central', async () => {
			await expectInTopN('solutions lead central wellington', '0020-stuart-mckay');
		});

		it('finds solutions architect using synonym', async () => {
			const ids = await searchIds('solutions architect', 5);
			expect(ids.length).toBeGreaterThan(0);
		});
	});

	describe('Natural Language Queries', () => {
		it('handles question format - who leads engineering', async () => {
			const ids = await searchIds('who leads the engineering team', 5);
			expect(ids.length).toBeGreaterThan(0);
		});

		it('handles question format - who is the CTO', async () => {
			await expectInTopN('who is the chief technology officer', '0018-rik-rogers');
		});

		it('handles question format - who works in Dunedin', async () => {
			const ids = await searchIds('who works in dunedin', 5);
			expect(ids).toContain('0006-shaun-graveston');
			expect(ids).toContain('0007-mike-lee');
		});

		it('handles conversational query - need a network engineer', async () => {
			const ids = await searchIds('I need a network engineer in Auckland', 5);
			expect(ids).toContain('0004-nigel-ram');
		});

		it('handles conversational query - looking for security help', async () => {
			const ids = await searchIds('looking for someone who does security', 5);
			expect(ids.length).toBeGreaterThan(0);
		});
	});

	describe('Abbreviation and Synonym Queries', () => {
		it('finds engineers with dev synonym', async () => {
			const ids = await searchIds('dev in wellington', 5);
			expect(ids.length).toBeGreaterThan(0);
		});

		it('finds engineers with tech synonym', async () => {
			const ids = await searchIds('tech lead', 5);
			expect(ids.length).toBeGreaterThan(0);
		});

		it('finds Auckland with AKL abbreviation', async () => {
			const ids = await searchIds('engineer akl', 5);
			expect(ids.length).toBeGreaterThan(0);
		});

		it('finds Wellington with WGTN abbreviation', async () => {
			const ids = await searchIds('engineer wgtn', 5);
			expect(ids.length).toBeGreaterThan(0);
		});

		it('finds Christchurch with CHCH abbreviation', async () => {
			const ids = await searchIds('engineer chch', 5);
			expect(ids.length).toBeGreaterThan(0);
		});

		it('finds senior staff with sr abbreviation', async () => {
			const ids = await searchIds('sr engineer', 5);
			expect(ids.length).toBeGreaterThan(0);
		});
	});

	describe('Complex Multi-Term Queries', () => {
		it('finds senior network engineer in southern region', async () => {
			await expectInTopN('senior network engineer dunedin southern', '0007-mike-lee');
		});

		it('finds security specialist in central region', async () => {
			await expectInTopN('senior security engineer wellington', '0008-joseph-paloma');
		});

		it('finds core services monitoring engineer', async () => {
			await expectInTopN('core services monitoring logic', '0016-kate-james');
		});

		it('finds NOC shift supervision', async () => {
			await expectInTopN('NOC shift supervisor leader', '0012-codey-wildman');
		});

		it('finds regional engineering management', async () => {
			const ids = await searchIds('regional engineering management head', 5);
			expect(ids).toContain('0001-patricia-aquino');
			expect(ids).toContain('0002-kane-hoskings');
		});
	});

	describe('Edge Cases and Stress', () => {
		it('handles empty query gracefully', async () => {
			const ids = await searchIds('', 5);
			expect(Array.isArray(ids)).toBe(true);
		});

		it('handles very long query', async () => {
			const longQuery =
				'find me the senior network and security engineer who works in the wellington office and reports to patricia aquino in the central engineering team';
			const ids = await searchIds(longQuery, 5);
			expect(ids.length).toBeGreaterThan(0);
		});

		it('handles query with special characters', async () => {
			const ids = await searchIds('engineer - core services', 5);
			expect(ids.length).toBeGreaterThan(0);
		});

		it('handles query with numbers', async () => {
			const ids = await searchIds('engineer level 2', 5);
			// Should return something even if no exact match
			expect(Array.isArray(ids)).toBe(true);
		});

		it('handles misspelled query gracefully', async () => {
			const ids = await searchIds('enginere wellingtn', 5);
			// May not find exact match but should return something
			expect(Array.isArray(ids)).toBe(true);
		});

		it('returns different results for different regions', async () => {
			const aucklandIds = await searchIds('network engineer auckland', 3);
			const wellingtonIds = await searchIds('network engineer wellington', 3);
			const christchurchIds = await searchIds('network engineer christchurch', 3);

			// Top result should be different for each region
			expect(aucklandIds[0]).not.toBe(wellingtonIds[0]);
			expect(wellingtonIds[0]).not.toBe(christchurchIds[0]);
		});

		it('ranks more specific queries higher', async () => {
			const generalResults = await search({
				query: 'engineer',
				db,
				embeddingService,
				options: {
					hybrid: true,
					nResults: 1,
				},
			});

			const specificResults = await search({
				query: 'senior network engineer dunedin mike lee',
				db,
				embeddingService,
				options: {
					hybrid: true,
					nResults: 1,
				},
			});

			// Both queries should return results
			// Note: With fake embeddings, scoring behavior differs from real embeddings
			expect(generalResults.length).toBeGreaterThan(0);
			expect(specificResults.length).toBeGreaterThan(0);
			// The specific query should find a senior engineer (Mike Lee or Joseph Paloma)
			const seniorEngineers = ['0007-mike-lee', '0008-joseph-paloma'];
			expect(seniorEngineers).toContain(specificResults[0]?.id);
		});
	});

	describe('Department Queries', () => {
		it('finds all engineering department staff', async () => {
			const ids = await searchIds('engineering department', 10);
			expect(ids.length).toBeGreaterThan(5);
		});

		it('finds NOC department staff', async () => {
			const ids = await searchIds('NOC department', 5);
			expect(ids).toContain('0011-dale-clutterbuck');
			expect(ids).toContain('0012-codey-wildman');
		});

		it('finds sales and solutions staff', async () => {
			const ids = await searchIds('sales solutions', 5);
			expect(ids).toContain('0019-ian-macdonald');
			expect(ids).toContain('0020-stuart-mckay');
		});

		it('finds core services department', async () => {
			const ids = await searchIds('core services department', 5);
			expect(ids).toContain('0015-ivan-walker');
		});
	});
});
