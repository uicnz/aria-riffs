import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { auditRiffWiring } from '../../src/audits/wiring-audit.js';

function writeRiff(
	root: string,
	riff: string,
	input: { promptName?: string; packageName?: string; packageVersion?: string } = {}
): void {
	const riffRoot = join(root, 'riffs', '.curated', riff);
	mkdirSync(join(riffRoot, 'dist'), { recursive: true });
	mkdirSync(join(riffRoot, 'src', 'lib'), { recursive: true });
	mkdirSync(join(riffRoot, 'test', 'unit'), { recursive: true });
	mkdirSync(join(riffRoot, 'test', 'integration'), { recursive: true });
	writeFileSync(join(root, 'package.json'), JSON.stringify({ version: '0.2.0' }));
	writeFileSync(join(riffRoot, 'README.md'), '# Sample Riff\n');
	writeFileSync(
		join(riffRoot, 'config.yaml'),
		`aria-riff:\n    name: ${riff}\n    description: Sample Riff\n    category: utilities\n${riff}: {}\nlogging: {}\n`
	);
	writeFileSync(
		join(riffRoot, 'package.json'),
		JSON.stringify({
			name: input.packageName ?? `@aria/${riff}`,
			version: input.packageVersion ?? '0.2.0',
			description: 'Sample Riff',
			type: 'module',
			packageManager: 'bun@1.4.2',
			engines: { bun: '>=1.4.0', node: '>=26.0.0' },
			main: 'dist/cli.js',
			bin: { [riff]: 'dist/cli.js' },
			files: ['dist/', 'src/', 'config.yaml', 'README.md', 'RIFF.md'],
			scripts: {
				start: 'bun src/cli.ts',
				test: `vitest run --coverage --coverage.reportsDirectory=../../coverage/${riff} --coverage.include='**/*.ts' test/`,
				typecheck: 'tsc --noEmit -p tsconfig.json',
			},
			dependencies: {},
		})
	);
	writeFileSync(join(riffRoot, 'tsconfig.json'), '{}\n');
	writeFileSync(join(riffRoot, 'dist', 'cli.js'), 'console.log("sample");\n');
	writeFileSync(join(riffRoot, 'src', 'cli.ts'), 'export function createProgram() {}\n');
	writeFileSync(join(riffRoot, 'RIFF.md'), `---\nname: ${input.promptName ?? riff}\ndescription: Sample Riff\n---\n`);
	for (const file of ['config.ts', 'load-dotenv.ts', 'logger.ts', 'schema.ts', 'types.ts']) {
		writeFileSync(join(riffRoot, 'src', 'lib', file), 'export {};\n');
	}
	writeFileSync(join(riffRoot, 'test', 'unit', 'config.test.ts'), 'export {};\n');
	writeFileSync(join(riffRoot, 'test', 'integration', 'config.test.ts'), 'export {};\n');
}

describe('Riff wiring audit', () => {
	it('accepts one canonical Riff wiring contract', () => {
		const root = mkdtempSync(join(tmpdir(), 'aria-riff-wiring-'));
		writeRiff(root, 'sample-riff');

		expect(auditRiffWiring('sample-riff', root)).toMatchObject({
			missingCanonicalFiles: [],
			configExists: true,
			packageExists: true,
			packageJsonValid: true,
			cliExists: true,
			metadataNameMatchesRiff: true,
			metadataDescriptionMatchesPackage: true,
			packageNameMatchesRiff: true,
			packageKeysMatchCanonical: true,
			packageVersionMatchesWorkspace: true,
			packageTypeMatchesCanonical: true,
			packageMainMatchesCanonical: true,
			binNameMatchesRiff: true,
			binPathMatchesCanonical: true,
			packageFilesMatchCanonical: true,
		});
	});

	it('rejects mismatched Riff names', () => {
		const root = mkdtempSync(join(tmpdir(), 'aria-riff-wiring-'));
		writeRiff(root, 'sample-riff', { promptName: 'other-riff', packageName: '@aria/other-riff' });

		expect(auditRiffWiring('sample-riff', root)).toMatchObject({
			packageNameMatchesRiff: false,
		});
	});

	it('rejects package and file drift from the canonical scaffold', () => {
		const root = mkdtempSync(join(tmpdir(), 'aria-riff-wiring-'));
		writeRiff(root, 'sample-riff', { packageVersion: '0.1.0' });
		writeFileSync(
			join(root, 'riffs', '.curated', 'sample-riff', 'package.json'),
			JSON.stringify({
				name: '@aria/sample-riff',
				version: '0.1.0',
				description: 'Sample Riff',
				type: 'commonjs',
				packageManager: 'bun@1.4.2',
				engines: { bun: '>=1.4.0', node: '>=26.0.0' },
				main: 'src/cli.ts',
				bin: { 'sample-riff': 'src/cli.ts' },
				files: ['src/'],
				scripts: {
					start: 'bun src/cli.ts',
					test: "vitest run --coverage --coverage.reportsDirectory=../../coverage/sample-riff --coverage.include='**/*.ts' test/",
					typecheck: 'tsc --noEmit -p tsconfig.json',
				},
				dependencies: {},
			})
		);

		expect(auditRiffWiring('sample-riff', root)).toMatchObject({
			packageKeysMatchCanonical: true,
			packageVersionMatchesWorkspace: false,
			packageTypeMatchesCanonical: false,
			packageMainMatchesCanonical: false,
			binNameMatchesRiff: true,
			binPathMatchesCanonical: false,
			packageFilesMatchCanonical: false,
		});
	});
});
