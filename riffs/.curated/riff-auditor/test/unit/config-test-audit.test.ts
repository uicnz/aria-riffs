import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { auditConfigTest } from '../../src/audits/config-test-audit.js';

const temporaryRoots: string[] = [];

function makeRiffRoot(): string {
	const root = mkdtempSync(resolve(tmpdir(), 'riff-auditor-fixtures-'));
	temporaryRoots.push(root);
	return root;
}

afterEach(() => {
	for (const root of temporaryRoots.splice(0)) {
		rmSync(root, { recursive: true, force: true });
	}
});

describe('config fixture naming audit', () => {
	it('accepts config.yaml in scenario directories', () => {
		const root = makeRiffRoot();
		const fixtures = resolve(root, 'riffs', '.curated', 'sample-riff', 'test', 'fixtures');
		mkdirSync(resolve(fixtures, 'valid'), { recursive: true });
		mkdirSync(resolve(fixtures, 'invalid'), { recursive: true });
		writeFileSync(resolve(fixtures, 'valid', 'config.yaml'), 'sample-riff: {}\n');
		writeFileSync(resolve(fixtures, 'invalid', 'config.yaml'), 'sample-riff: []\n');

		expect(auditConfigTest('sample-riff', root).nonCanonicalFixtureConfigPaths).toEqual([]);
	});

	it('reports YAML fixture configs with non-canonical basenames', () => {
		const root = makeRiffRoot();
		const fixtures = resolve(root, 'riffs', '.curated', 'sample-riff', 'test', 'fixtures');
		mkdirSync(resolve(fixtures, 'gemini'), { recursive: true });
		writeFileSync(resolve(fixtures, 'valid-config.yaml'), 'sample-riff: {}\n');
		writeFileSync(resolve(fixtures, 'gemini', 'config-gemini.yml'), 'sample-riff: {}\n');

		expect(auditConfigTest('sample-riff', root).nonCanonicalFixtureConfigPaths).toEqual([
			'test/fixtures/gemini/config-gemini.yml',
			'test/fixtures/valid-config.yaml',
		]);
	});
});
