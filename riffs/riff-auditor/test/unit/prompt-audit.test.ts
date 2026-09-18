import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { auditPrompt } from '../../src/audits/prompt-audit.js';

function writePrompt(root: string, riff: string, prompt: string): void {
	const src = join(root, 'riffs', riff, 'src');
	mkdirSync(src, { recursive: true });
	writeFileSync(join(src, 'riff-prompt.ts'), prompt);
}

function canonicalPrompt(riff: string, command = '$RIFF run'): string {
	return `export const riffPrompt = {
        name: '${riff}',
        summary: 'Summary',
        purpose: 'Purpose',
        whenToUse: ['Scenario'],
        pipeline: ['Step'],
        parameters: [],
        output: 'Output',
        constraints: [],
        conventions: [],
        examples: [{ description: 'Example', command: '${command}', outcome: 'Outcome' }],
    };\n`;
}

describe('Riff prompt audit', () => {
	it('accepts the exact canonical Aria Riff prompt contract', async () => {
		const root = mkdtempSync(join(tmpdir(), 'aria-riff-prompt-'));
		writePrompt(root, 'sample-riff', canonicalPrompt('sample-riff'));

		await expect(auditPrompt('sample-riff', root)).resolves.toMatchObject({
			promptExists: true,
			promptLoads: true,
			promptMatchesCanonicalSchema: true,
			promptNameMatchesRiff: true,
			promptExamplesUsePlaceholder: true,
		});
	});

	it('rejects prompt shape, name, and invocation divergence', async () => {
		const root = mkdtempSync(join(tmpdir(), 'aria-riff-prompt-'));
		writePrompt(root, 'sample-riff', canonicalPrompt('other-riff', 'sample-riff run'));

		await expect(auditPrompt('sample-riff', root)).resolves.toMatchObject({
			promptMatchesCanonicalSchema: true,
			promptNameMatchesRiff: false,
			promptExamplesUsePlaceholder: false,
		});

		writePrompt(root, 'invalid-riff', "export const riffPrompt = { name: 'invalid-riff' };\n");
		const invalid = await auditPrompt('invalid-riff', root);
		expect(invalid.promptMatchesCanonicalSchema).toBe(false);
		expect(invalid.promptValidationIssues).not.toHaveLength(0);
	});
});
