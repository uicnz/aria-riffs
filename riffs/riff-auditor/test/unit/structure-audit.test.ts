import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { auditStructure } from '../../src/audits/structure-audit.js';

const temporaryRoots: string[] = [];

function makeRiffRoot(): { root: string; riffDir: string } {
	const root = mkdtempSync(resolve(tmpdir(), 'riff-auditor-structure-'));
	const riffDir = resolve(root, 'riffs', 'sample-riff');
	mkdirSync(resolve(riffDir, 'src', 'core'), { recursive: true });
	mkdirSync(resolve(riffDir, 'src', 'lib'), { recursive: true });
	mkdirSync(resolve(riffDir, 'test', 'unit'), { recursive: true });
	mkdirSync(resolve(riffDir, 'test', 'integration'), { recursive: true });
	temporaryRoots.push(root);
	return { root, riffDir };
}

afterEach(() => {
	for (const root of temporaryRoots.splice(0)) {
		rmSync(root, { recursive: true, force: true });
	}
});

describe('Riff structure audit', () => {
	it('accepts the canonical README filename', () => {
		const { root, riffDir } = makeRiffRoot();
		writeFileSync(resolve(riffDir, 'README.md'), '# Sample Riff\n');

		expect(auditStructure('sample-riff', root).readmeExists).toBe(true);
	});

	it('reports a missing canonical README', () => {
		const { root } = makeRiffRoot();

		expect(auditStructure('sample-riff', root).readmeExists).toBe(false);
	});
});
