/**
 * Integration tests for RiffAuditor core functionality
 * Tests the complete audit flow against actual riffs in the repository
 */

import { describe, expect, it } from 'vitest';
import { RiffAuditor } from '../../src/core/riff-auditor.js';
import { loadConfig } from '../../src/lib/config.js';
import { createLogger } from '../../src/lib/logger.js';

describe('RiffAuditor Integration', () => {
	describe('Full audit flow', () => {
		it('given actual repository, when runHealthCheck called, then returns valid summary', async () => {
			// Given: Actual repository with riffs and configs
			const config = loadConfig();
			const logger = createLogger({ level: 'error', verbose: false });
			const auditor = new RiffAuditor(config['riff-auditor'], logger);

			// When: Running health check
			const summary = await auditor.runHealthCheck();

			// Then: Should return valid summary structure
			expect(summary.riffsTotal).toBeGreaterThan(0);
			expect(Array.isArray(summary.healthy)).toBe(true);
			expect(Array.isArray(summary.hasIssues)).toBe(true);
			expect(Array.isArray(summary.unhealthy)).toBe(true);
			expect(Array.isArray(summary.details)).toBe(true);
			expect(summary.details.length).toBe(summary.riffsTotal);
		});

		it('given actual repository, when auditRiff called for known riff, then returns riff health', async () => {
			// Given: Actual repository with doc-converter riff
			const config = loadConfig();
			const logger = createLogger({ level: 'error', verbose: false });
			const auditor = new RiffAuditor(config['riff-auditor'], logger);

			// When: Auditing a known riff
			const health = await auditor.auditRiff('doc-converter');

			// Then: Should return valid health structure
			expect(health.riff).toBe('doc-converter');
			expect(typeof health.configExists).toBe('boolean');
			expect(typeof health.schemaExists).toBe('boolean');
			expect(typeof health.configLoaderExists).toBe('boolean');
			expect(typeof health.loggerExists).toBe('boolean');
			expect(typeof health.loggerIsStandaloneSafe).toBe('boolean');
			expect(typeof health.cliExists).toBe('boolean');
			expect(typeof health.testDirExists).toBe('boolean');
			expect(Array.isArray(health.issues)).toBe(true);
			expect(['healthy', 'issues', 'unhealthy']).toContain(health.status);
		});

		it('given actual repository, when summary computed, then riff counts are consistent', async () => {
			// Given: Actual repository
			const config = loadConfig();
			const logger = createLogger({ level: 'error', verbose: false });
			const auditor = new RiffAuditor(config['riff-auditor'], logger);

			// When: Running health check
			const summary = await auditor.runHealthCheck();

			// Then: Counts should be consistent
			const totalCategorized = summary.healthy.length + summary.hasIssues.length + summary.unhealthy.length;
			expect(totalCategorized).toBe(summary.riffsTotal);
		});
	});

	describe('Validation audit', () => {
		it('given riff with config, when audited, then validation status is set', async () => {
			// Given: Riff with config file
			const config = loadConfig();
			const logger = createLogger({ level: 'error', verbose: false });
			const auditor = new RiffAuditor(config['riff-auditor'], logger);

			// When: Auditing a riff
			const health = await auditor.auditRiff('doc-converter');

			// Then: the co-located canonical config must actually validate
			expect(health.validationStatus).toBe('ok');
			expect(health.validationIssues).toEqual([]);
		});
	});

	describe('Logger audit', () => {
		it('given corrected standalone loggers, when health check runs, then no riff is flagged for hostile transport targets', async () => {
			const config = loadConfig();
			const logger = createLogger({ level: 'error', verbose: false });
			const auditor = new RiffAuditor(config['riff-auditor'], logger);

			const summary = await auditor.runHealthCheck();
			const flagged = summary.details.filter(detail =>
				detail.issues.some(issue => issue.includes('canonical standalone logger scaffold'))
			);

			expect(flagged).toEqual([]);
		});
	});

	describe('Console boundary audit', () => {
		it('given repository riffs, when health check runs, then no automated riff tests or shipped runtime files violate the console boundary', async () => {
			const config = loadConfig();
			const logger = createLogger({ level: 'error', verbose: false });
			const auditor = new RiffAuditor(config['riff-auditor'], logger);

			const summary = await auditor.runHealthCheck();
			const flagged = summary.details.filter(detail =>
				detail.issues.some(issue => issue.includes('Console boundary violations found'))
			);

			expect(flagged).toEqual([]);
		});
	});

	describe('Bun runtime audit', () => {
		it('given shipped riffs, when health check runs, then no riff is allowed to drift away from Bun runtime semantics', async () => {
			const config = loadConfig();
			const logger = createLogger({ level: 'error', verbose: false });
			const auditor = new RiffAuditor(config['riff-auditor'], logger);

			const summary = await auditor.runHealthCheck();

			for (const detail of summary.details) {
				expect(detail.hasNonBunShebang).toBe(false);
				expect(detail.nonBunShebangFiles).toEqual([]);
				expect(detail.hasNonBunRuntimeInvocations).toBe(false);
				expect(detail.nonBunRuntimeInvocations).toEqual([]);
			}
		});
	});
});
