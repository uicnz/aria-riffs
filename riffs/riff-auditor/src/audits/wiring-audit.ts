/** Canonical Riff wiring audit. */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';

export interface RiffWiringAuditResult {
	configExists: boolean;
	packageExists: boolean;
	cliExists: boolean;
	promptExists: boolean;
	metadataName: string | null;
	metadataNameMatchesRiff: boolean;
	packageName: string | null;
	packageNameMatchesRiff: boolean;
	binNameMatchesRiff: boolean;
	promptExportsRiffPrompt: boolean;
	promptName: string | null;
	promptNameMatchesRiff: boolean;
}

function read(path: string): string | null {
	try {
		return readFileSync(path, 'utf8');
	} catch {
		return null;
	}
}

function metadataName(configSource: string | null): string | null {
	if (!configSource) return null;
	try {
		const config = parseYaml(configSource) as Record<string, unknown> | null;
		const metadata = config?.['aria-riff'];
		if (!metadata || typeof metadata !== 'object') return null;
		const name = (metadata as Record<string, unknown>).name;
		return typeof name === 'string' && name.length > 0 ? name : null;
	} catch {
		return null;
	}
}

function packageContract(packageSource: string | null): {
	name: string | null;
	binNames: string[];
} {
	if (!packageSource) return { name: null, binNames: [] };
	try {
		const manifest = JSON.parse(packageSource) as { name?: unknown; bin?: unknown };
		const name = typeof manifest.name === 'string' ? manifest.name : null;
		const binNames =
			manifest.bin && typeof manifest.bin === 'object' && !Array.isArray(manifest.bin)
				? Object.keys(manifest.bin as Record<string, unknown>)
				: [];
		return { name, binNames };
	} catch {
		return { name: null, binNames: [] };
	}
}

function promptName(promptSource: string | null): string | null {
	if (!promptSource) return null;
	const match = /\bname\s*:\s*['"]([^'"]+)['"]/u.exec(promptSource);
	return match?.[1] ?? null;
}

export function auditRiffWiring(riff: string, repoRoot: string): RiffWiringAuditResult {
	const riffDir = resolve(repoRoot, 'riffs', riff);
	const configPath = resolve(riffDir, 'config.yaml');
	const packagePath = resolve(riffDir, 'package.json');
	const cliPath = resolve(riffDir, 'src', 'cli.ts');
	const promptPath = resolve(riffDir, 'src', 'riff-prompt.ts');
	const configSource = read(configPath);
	const packageSource = read(packagePath);
	const promptSource = read(promptPath);
	const metadata = metadataName(configSource);
	const packageManifest = packageContract(packageSource);
	const prompt = promptName(promptSource);
	return {
		configExists: existsSync(configPath),
		packageExists: existsSync(packagePath),
		cliExists: existsSync(cliPath),
		promptExists: existsSync(promptPath),
		metadataName: metadata,
		metadataNameMatchesRiff: metadata === riff,
		packageName: packageManifest.name,
		packageNameMatchesRiff: packageManifest.name === `@aria/${riff}`,
		binNameMatchesRiff: packageManifest.binNames.includes(riff),
		promptExportsRiffPrompt: promptSource ? /export\s+const\s+riffPrompt\s*=/u.test(promptSource) : false,
		promptName: prompt,
		promptNameMatchesRiff: prompt === riff,
	};
}
