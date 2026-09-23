import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { auditSource } from '../../src/audits/source-audit.js';

const TEST_ROOT = resolve(tmpdir(), 'aria-source-audit-test');

function writeRiffFile(riff: string, relativePath: string, content: string): void {
	const filePath = resolve(TEST_ROOT, 'riffs', '.curated', riff, relativePath);
	mkdirSync(resolve(filePath, '..'), { recursive: true });
	writeFileSync(filePath, content, 'utf8');
}

describe('Source Audit', () => {
	beforeEach(() => {
		mkdirSync(resolve(TEST_ROOT, 'riffs'), { recursive: true });
	});

	afterEach(() => {
		rmSync(TEST_ROOT, { recursive: true, force: true });
	});

	it('given direct console call in shipped runtime source, when audited, then flags console boundary violation', () => {
		writeRiffFile(
			'test-riff',
			'src/core/example.ts',
			`
export function run(): void {
	console.log('bad');
}
`
		);
		writeRiffFile(
			'test-riff',
			'src/lib/types.ts',
			`
export type Example = {
	value: string;
};
`
		);

		const result = auditSource('test-riff', TEST_ROOT);

		expect(result.hasDirectConsoleUsage).toBe(true);
		expect(result.directConsoleUsage).toContain('src/core/example.ts:3:2 console.log(...)');
	});

	it('given console spy in automated test, when audited, then flags console boundary violation', () => {
		writeRiffFile(
			'test-riff',
			'test/unit/example.test.ts',
			`
import { describe, it, vi } from 'vitest';

describe('example', () => {
	it('spies on console', () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
	});
});
`
		);
		writeRiffFile(
			'test-riff',
			'src/lib/types.ts',
			`
export type Example = {
	value: string;
};
`
		);

		const result = auditSource('test-riff', TEST_ROOT);

		expect(result.hasDirectConsoleUsage).toBe(true);
		expect(result.directConsoleUsage).toContain(`test/unit/example.test.ts:6:3 spyOn(console, 'warn')`);
	});

	it('given console tokens inside string fixtures, when audited, then ignores string content', () => {
		writeRiffFile(
			'test-riff',
			'test/unit/example.test.ts',
			`
const suffix = 'only';
const fixture = \`fixture \${suffix}
function demo() {
	console.log("fixture only");
}
\`;

export { fixture };
`
		);
		writeRiffFile(
			'test-riff',
			'src/lib/types.ts',
			`
export type Example = {
	value: string;
};
`
		);

		const result = auditSource('test-riff', TEST_ROOT);

		expect(result.hasDirectConsoleUsage).toBe(false);
		expect(result.directConsoleUsage).toEqual([]);
	});

	it('given a bare hash in a regular expression, when audited, then scanner advances without reporting console usage', () => {
		writeRiffFile('test-riff', 'src/core/example.ts', `export const headingPattern = /^#\\s+.*$/;\n`);
		writeRiffFile('test-riff', 'src/lib/types.ts', `export interface Example {\n\tvalue: string;\n}\n`);

		const result = auditSource('test-riff', TEST_ROOT);

		expect(result.hasDirectConsoleUsage).toBe(false);
		expect(result.directConsoleUsage).toEqual([]);
	});
});
