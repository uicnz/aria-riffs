import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { auditRiffWiring } from '../../src/audits/wiring-audit.js';

function writeRiff(root: string, riff: string, input: { promptName?: string; packageName?: string } = {}): void {
	const riffRoot = join(root, 'riffs', riff);
	mkdirSync(join(riffRoot, 'src'), { recursive: true });
	writeFileSync(
		join(riffRoot, 'config.yaml'),
		`aria-riff:\n    name: ${riff}\n    description: Test Riff\n    category: utilities\n${riff}: {}\nlogging: {}\n`
	);
	writeFileSync(
		join(riffRoot, 'package.json'),
		JSON.stringify({ name: input.packageName ?? `@aria/${riff}`, bin: { [riff]: 'dist/cli.js' } })
	);
	writeFileSync(join(riffRoot, 'src', 'cli.ts'), 'export function createProgram() {}\n');
	writeFileSync(
		join(riffRoot, 'src', 'riff-prompt.ts'),
		`export const riffPrompt = { name: '${input.promptName ?? riff}', examples: ['$RIFF run'] };\n`
	);
}

describe('Riff wiring audit', () => {
	it('accepts one canonical Riff wiring contract', () => {
		const root = mkdtempSync(join(tmpdir(), 'aria-riff-wiring-'));
		writeRiff(root, 'sample-riff');

		expect(auditRiffWiring('sample-riff', root)).toMatchObject({
			configExists: true,
			packageExists: true,
			cliExists: true,
			promptExists: true,
			metadataNameMatchesRiff: true,
			packageNameMatchesRiff: true,
			binNameMatchesRiff: true,
			promptExportsRiffPrompt: true,
			promptNameMatchesRiff: true,
		});
	});

	it('rejects mismatched Riff names', () => {
		const root = mkdtempSync(join(tmpdir(), 'aria-riff-wiring-'));
		writeRiff(root, 'sample-riff', { promptName: 'other-riff', packageName: '@aria/other-riff' });

		expect(auditRiffWiring('sample-riff', root)).toMatchObject({
			packageNameMatchesRiff: false,
			promptNameMatchesRiff: false,
		});
	});
});
