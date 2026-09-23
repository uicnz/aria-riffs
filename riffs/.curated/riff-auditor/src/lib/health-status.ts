import type { RiffHealthStatus } from './types.js';

const UNHEALTHY_MARKERS = [
	'Missing',
	'not using',
	'[Validation]',
	'[Dependencies]',
	'canonical standalone logger scaffold',
	'Console boundary violations found',
	'Chalk usage found',
	'Non-Bun shebang found',
	'Non-Bun runtime invocation found',
] as const;

export function classifyHealthStatus(issues: string[]): RiffHealthStatus {
	if (issues.length === 0) return 'healthy';
	return issues.some(issue => UNHEALTHY_MARKERS.some(marker => issue.includes(marker))) ? 'unhealthy' : 'issues';
}
