import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { auditCli, auditCliHelp } from '../../src/audits/cli-audit.js';

const temporaryRoots: string[] = [];

function writeCli(source: string): string {
	const root = mkdtempSync(resolve(tmpdir(), 'riff-auditor-cli-'));
	const srcDir = resolve(root, 'riffs', '.curated', 'sample-riff', 'src');
	mkdirSync(srcDir, { recursive: true });
	writeFileSync(resolve(srcDir, 'cli.ts'), source);
	temporaryRoots.push(root);
	return root;
}

function writeExecutableCli(source: string): string {
	const root = mkdtempSync(resolve(tmpdir(), 'riff-auditor-cli-help-'));
	const srcDir = resolve(root, 'riffs', '.curated', 'sample-riff', 'src');
	mkdirSync(srcDir, { recursive: true });
	writeFileSync(resolve(srcDir, 'cli.ts'), source);
	temporaryRoots.push(root);
	return root;
}

afterEach(() => {
	for (const root of temporaryRoots.splice(0)) {
		rmSync(root, { recursive: true, force: true });
	}
});

describe('CLI scaffold audit', () => {
	it('accepts package-owned help metadata', () => {
		const root = writeCli(`
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import packageManifest from '../package.json' with { type: 'json' };
export function createProgram(): Command {
    const program = new Command();
    return program
        .name('sample-riff')
        .description(packageManifest.description)
        .version(packageManifest.version);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) createProgram().parse();
`);

		expect(auditCli('sample-riff', root)).toMatchObject({
			cliProgramNameMatchesRiff: true,
			cliImportsPackageManifest: true,
			cliUsesPackageDescription: true,
			cliUsesPackageVersion: true,
		});
	});

	it('rejects duplicated CLI help metadata', () => {
		const root = writeCli(`
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
export function createProgram(): Command {
    const program = new Command();
    return program.name('sample-riff').description('Stale description').version('1.0.0');
}
if (process.argv[1] === fileURLToPath(import.meta.url)) createProgram().parse();
`);

		expect(auditCli('sample-riff', root)).toMatchObject({
			cliProgramNameMatchesRiff: true,
			cliImportsPackageManifest: false,
			cliUsesPackageDescription: false,
			cliUsesPackageVersion: false,
		});
	});

	it('accepts a public help path that renders without startup errors', () => {
		const root = writeExecutableCli(`
process.stdout.write('Usage: sample-riff [options]\\n');
`);

		expect(auditCliHelp('sample-riff', root)).toMatchObject({
			cliHelpRenders: true,
			cliHelpExitCode: 0,
		});
	});

	it('rejects startup errors that intercept the public help path', () => {
		const root = writeExecutableCli(`
process.stderr.write('Error: configuration failed\\n');
process.stdout.write('Usage: sample-riff [options]\\n');
`);

		expect(auditCliHelp('sample-riff', root)).toMatchObject({
			cliHelpRenders: false,
			cliHelpExitCode: 0,
		});
	});
});
