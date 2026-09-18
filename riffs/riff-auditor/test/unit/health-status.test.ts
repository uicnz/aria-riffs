import { describe, expect, it } from 'vitest';
import { classifyHealthStatus } from '../../src/lib/health-status.js';

describe('Health Status', () => {
	it('given no issues, when classified, then returns healthy', () => {
		expect(classifyHealthStatus([])).toBe('healthy');
	});

	it('given a noncritical issue, when classified, then returns issues', () => {
		expect(classifyHealthStatus(['Pattern outlier: example'])).toBe('issues');
	});

	it('given a dependency contract issue, when classified, then returns unhealthy', () => {
		expect(classifyHealthStatus(['[Dependencies] packageManager is missing'])).toBe('unhealthy');
	});
});
