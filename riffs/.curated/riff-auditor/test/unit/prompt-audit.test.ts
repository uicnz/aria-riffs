import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { auditPrompt } from '../../src/audits/prompt-audit.js';

function writeDocument(root: string, riff: string, document: string): void {
	const riffDir = join(root, 'riffs', '.curated', riff);
	mkdirSync(riffDir, { recursive: true });
	writeFileSync(join(riffDir, 'RIFF.md'), document);
}

function canonicalDocument(riff: string, command = '$RIFF run'): string {
	return [
		'---',
		`name: ${riff}`,
		'description: Summary',
		'---',
		'',
		'# Sample Riff',
		'',
		'## Purpose',
		'',
		'Purpose',
		'',
		'## When to use',
		'',
		'- Scenario',
		'',
		'## Pipeline',
		'',
		'1. Step',
		'',
		'## Parameters',
		'',
		'| Name | Type | Required | Description |',
		'| --- | --- | --- | --- |',
		'| `--flag` | `flag` | no | Toggle |',
		'',
		'## Output',
		'',
		'Output',
		'',
		'## Constraints',
		'',
		'## Conventions',
		'',
		'- Convention',
		'',
		'## Examples',
		'',
		'### Example',
		'',
		'```sh',
		command,
		'```',
		'',
		'Outcome',
		'',
	].join('\n');
}

describe('Riff prompt audit', () => {
	it('accepts the exact canonical RIFF.md contract', async () => {
		const root = mkdtempSync(join(tmpdir(), 'aria-riff-prompt-'));
		writeDocument(root, 'sample-riff', canonicalDocument('sample-riff'));

		await expect(auditPrompt('sample-riff', root)).resolves.toMatchObject({
			promptExists: true,
			promptLoads: true,
			promptMatchesCanonicalSchema: true,
			promptNameMatchesRiff: true,
			promptExamplesUsePlaceholder: true,
		});
	});

	it('rejects document shape, name, and invocation divergence', async () => {
		const root = mkdtempSync(join(tmpdir(), 'aria-riff-prompt-'));
		writeDocument(root, 'sample-riff', canonicalDocument('other-riff', 'sample-riff run'));

		await expect(auditPrompt('sample-riff', root)).resolves.toMatchObject({
			promptMatchesCanonicalSchema: true,
			promptNameMatchesRiff: false,
			promptExamplesUsePlaceholder: false,
		});

		writeDocument(
			root,
			'invalid-riff',
			'---\nname: invalid-riff\ndescription: Summary\n---\n\n## Purpose\n\nOnly a purpose.\n'
		);
		const invalid = await auditPrompt('invalid-riff', root);
		expect(invalid.promptExists).toBe(true);
		expect(invalid.promptMatchesCanonicalSchema).toBe(false);
		expect(invalid.promptValidationIssues[0]).toContain('missing the section');

		const missing = await auditPrompt('absent-riff', root);
		expect(missing.promptExists).toBe(false);
		expect(missing.promptValidationIssues).toEqual(['RIFF.md not found']);
	});
});
