/** Canonical Riff wiring audit. */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';

export const CANONICAL_RIFF_FILES = [
	'README.md',
	'config.yaml',
	'package.json',
	'tsconfig.json',
	'dist/cli.js',
	'src/cli.ts',
	'src/riff-prompt.ts',
	'src/lib/config.ts',
	'src/lib/load-dotenv.ts',
	'src/lib/logger.ts',
	'src/lib/schema.ts',
	'src/lib/types.ts',
	'test/integration/config.test.ts',
	'test/unit/config.test.ts',
] as const;

export const CANONICAL_PACKAGE_KEYS = [
	'name',
	'version',
	'description',
	'type',
	'packageManager',
	'engines',
	'main',
	'bin',
	'files',
	'scripts',
	'dependencies',
] as const;

export const CANONICAL_PACKAGE_FILES = ['dist/', 'src/', 'config.yaml'] as const;

export interface RiffWiringAuditResult {
	missingCanonicalFiles: string[];
	configExists: boolean;
	packageExists: boolean;
	packageJsonValid: boolean;
	cliExists: boolean;
	metadataName: string | null;
	metadataNameMatchesRiff: boolean;
	metadataDescription: string | null;
	packageName: string | null;
	packageNameMatchesRiff: boolean;
	packageDescription: string | null;
	metadataDescriptionMatchesPackage: boolean;
	packageKeysMatchCanonical: boolean;
	packageVersion: string | null;
	packageVersionMatchesWorkspace: boolean;
	packageTypeMatchesCanonical: boolean;
	packageMainMatchesCanonical: boolean;
	binNameMatchesRiff: boolean;
	binPathMatchesCanonical: boolean;
	packageFilesMatchCanonical: boolean;
}

function read(path: string): string | null {
	try {
		return readFileSync(path, 'utf8');
	} catch {
		return null;
	}
}

function metadata(configSource: string | null): { name: string | null; description: string | null } {
	const invalid = { name: null, description: null };
	if (!configSource) return invalid;
	try {
		const config = parseYaml(configSource) as Record<string, unknown> | null;
		const riffMetadata = config?.['aria-riff'];
		if (!riffMetadata || typeof riffMetadata !== 'object') return invalid;
		const record = riffMetadata as Record<string, unknown>;
		return {
			name: typeof record.name === 'string' && record.name.length > 0 ? record.name : null,
			description:
				typeof record.description === 'string' && record.description.length > 0 ? record.description : null,
		};
	} catch {
		return invalid;
	}
}

function packageContract(
	packageSource: string | null,
	riff: string,
	workspaceVersion: string | null
): {
	valid: boolean;
	name: string | null;
	description: string | null;
	keysMatchCanonical: boolean;
	version: string | null;
	versionMatchesWorkspace: boolean;
	typeMatchesCanonical: boolean;
	mainMatchesCanonical: boolean;
	binNameMatchesRiff: boolean;
	binPathMatchesCanonical: boolean;
	filesMatchCanonical: boolean;
} {
	const invalid = {
		valid: false,
		name: null,
		description: null,
		keysMatchCanonical: false,
		version: null,
		versionMatchesWorkspace: false,
		typeMatchesCanonical: false,
		mainMatchesCanonical: false,
		binNameMatchesRiff: false,
		binPathMatchesCanonical: false,
		filesMatchCanonical: false,
	};
	if (!packageSource) return invalid;
	try {
		const manifest = JSON.parse(packageSource) as Record<string, unknown>;
		const name = typeof manifest.name === 'string' ? manifest.name : null;
		const description = typeof manifest.description === 'string' ? manifest.description : null;
		const version = typeof manifest.version === 'string' ? manifest.version : null;
		const bin =
			manifest.bin && typeof manifest.bin === 'object' && !Array.isArray(manifest.bin)
				? (manifest.bin as Record<string, unknown>)
				: {};
		const files = Array.isArray(manifest.files) ? manifest.files : [];
		return {
			valid: true,
			name,
			description,
			keysMatchCanonical: JSON.stringify(Object.keys(manifest)) === JSON.stringify(CANONICAL_PACKAGE_KEYS),
			version,
			versionMatchesWorkspace: version !== null && version === workspaceVersion,
			typeMatchesCanonical: manifest.type === 'module',
			mainMatchesCanonical: manifest.main === 'dist/cli.js',
			binNameMatchesRiff: Object.keys(bin).length === 1 && riff in bin,
			binPathMatchesCanonical: bin[riff] === 'dist/cli.js',
			filesMatchCanonical: JSON.stringify(files) === JSON.stringify(CANONICAL_PACKAGE_FILES),
		};
	} catch {
		return invalid;
	}
}

function workspaceVersion(repoRoot: string): string | null {
	const source = read(resolve(repoRoot, 'package.json'));
	if (!source) return null;
	try {
		const manifest = JSON.parse(source) as { version?: unknown };
		return typeof manifest.version === 'string' ? manifest.version : null;
	} catch {
		return null;
	}
}

export function auditRiffWiring(riff: string, repoRoot: string): RiffWiringAuditResult {
	const riffDir = resolve(repoRoot, 'riffs', riff);
	const configPath = resolve(riffDir, 'config.yaml');
	const packagePath = resolve(riffDir, 'package.json');
	const cliPath = resolve(riffDir, 'src', 'cli.ts');
	const configSource = read(configPath);
	const packageSource = read(packagePath);
	const riffMetadata = metadata(configSource);
	const packageManifest = packageContract(packageSource, riff, workspaceVersion(repoRoot));
	return {
		missingCanonicalFiles: CANONICAL_RIFF_FILES.filter(path => !existsSync(resolve(riffDir, path))),
		configExists: existsSync(configPath),
		packageExists: existsSync(packagePath),
		packageJsonValid: packageManifest.valid,
		cliExists: existsSync(cliPath),
		metadataName: riffMetadata.name,
		metadataNameMatchesRiff: riffMetadata.name === riff,
		metadataDescription: riffMetadata.description,
		packageName: packageManifest.name,
		packageNameMatchesRiff: packageManifest.name === `@aria/${riff}`,
		packageDescription: packageManifest.description,
		metadataDescriptionMatchesPackage:
			riffMetadata.description !== null && riffMetadata.description === packageManifest.description,
		packageKeysMatchCanonical: packageManifest.keysMatchCanonical,
		packageVersion: packageManifest.version,
		packageVersionMatchesWorkspace: packageManifest.versionMatchesWorkspace,
		packageTypeMatchesCanonical: packageManifest.typeMatchesCanonical,
		packageMainMatchesCanonical: packageManifest.mainMatchesCanonical,
		binNameMatchesRiff: packageManifest.binNameMatchesRiff,
		binPathMatchesCanonical: packageManifest.binPathMatchesCanonical,
		packageFilesMatchCanonical: packageManifest.filesMatchCanonical,
	};
}
