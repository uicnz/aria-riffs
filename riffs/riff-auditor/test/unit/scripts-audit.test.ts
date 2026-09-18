import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { auditScripts } from '../../src/audits/scripts-audit.js';

const temporaryRoots: string[] = [];

function writePackage(scripts: Record<string, string>): { root: string; riff: string } {
	const root = mkdtempSync(resolve(tmpdir(), 'riff-auditor-scripts-'));
	const riff = 'sample-riff';
	const riffRoot = resolve(root, 'riffs', riff);
	mkdirSync(riffRoot, { recursive: true });
	writeFileSync(resolve(riffRoot, 'package.json'), JSON.stringify({ scripts }));
	temporaryRoots.push(root);
	return { root, riff };
}

afterEach(() => {
	for (const root of temporaryRoots.splice(0)) {
		rmSync(root, { recursive: true, force: true });
	}
});

describe('package-local Riff scripts audit', () => {
	it('accepts the canonical shared scripts', () => {
		const { root, riff } = writePackage({
			start: 'bun src/cli.ts',
			test: "vitest run --coverage --coverage.reportsDirectory=../../coverage/sample-riff --coverage.include='**/*.ts' test/",
			typecheck: 'tsc --noEmit -p tsconfig.json',
		});

		expect(auditScripts(riff, root)).toMatchObject({
			hasStartScript: true,
			hasTestScript: true,
			hasTypecheckScript: true,
			missingScripts: [],
			nonCanonicalScripts: [],
		});
	});

	it('reports missing and non-canonical shared scripts', () => {
		const { root, riff } = writePackage({
			start: 'node src/cli.ts',
			test: 'vitest run',
		});

		expect(auditScripts(riff, root)).toMatchObject({
			hasStartScript: true,
			hasTestScript: true,
			hasTypecheckScript: false,
			missingScripts: ['typecheck'],
			nonCanonicalScripts: [
				'start: expected "bun src/cli.ts", got "node src/cli.ts"',
				'test: expected "vitest run --coverage --coverage.reportsDirectory=../../coverage/sample-riff --coverage.include=\'**/*.ts\' test/", got "vitest run"',
			],
		});
	});
});
