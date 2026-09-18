import { describe, expect, it } from 'vitest';
import { shouldFailStrictAudit, shouldFailStrictCheck } from '../../src/cli.js';

describe('strict CLI status', () => {
	it('fails a repository audit when any Riff has issues', () => {
		expect(shouldFailStrictAudit({ hasIssues: ['example'], unhealthy: [] })).toBe(true);
	});

	it('fails a repository audit when any Riff is unhealthy', () => {
		expect(shouldFailStrictAudit({ hasIssues: [], unhealthy: ['example'] })).toBe(true);
	});

	it('passes a repository audit only when every Riff is healthy', () => {
		expect(shouldFailStrictAudit({ hasIssues: [], unhealthy: [] })).toBe(false);
	});

	it('fails a single-Riff check for both issues and unhealthy states', () => {
		expect(shouldFailStrictCheck({ status: 'healthy' })).toBe(false);
		expect(shouldFailStrictCheck({ status: 'issues' })).toBe(true);
		expect(shouldFailStrictCheck({ status: 'unhealthy' })).toBe(true);
	});
});
