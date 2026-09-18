#!/usr/bin/env bun

import { existsSync, readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

const EXTERNAL_MODULES = [
	'sharp',
	'@img/sharp-darwin-arm64',
	'@img/sharp-darwin-x64',
	'@img/sharp-linux-x64',
	'@img/sharp-linux-arm64',
	'@img/sharp-win32-x64',
	'@img/sharp-libvips-darwin-arm64',
	'@img/sharp-libvips-darwin-x64',
	'@img/sharp-libvips-linux-x64',
	'@img/sharp-libvips-linux-arm64',
	'scribe.js-ocr',
] as const;

function readPackageName(riffDir: string): string {
	const packagePath = join(riffDir, 'package.json');
	const manifest = JSON.parse(readFileSync(packagePath, 'utf8')) as { name?: unknown };
	if (typeof manifest.name !== 'string' || manifest.name.length === 0) {
		throw new Error(`Riff package name is missing: ${packagePath}`);
	}
	return manifest.name;
}

export async function buildRiff(riffDir = process.cwd()): Promise<string> {
	const resolvedRiffDir = resolve(riffDir);
	const entrypoint = join(resolvedRiffDir, 'src', 'cli.ts');
	if (!existsSync(entrypoint)) {
		throw new Error(`Riff source entrypoint is missing: ${entrypoint}`);
	}

	const result = await Bun.build({
		entrypoints: [entrypoint],
		outdir: join(resolvedRiffDir, 'dist'),
		target: 'node',
		format: 'esm',
		minify: false,
		splitting: false,
		external: [...EXTERNAL_MODULES],
	});
	if (!result.success) {
		const diagnostics = result.logs.map(log => String(log)).join('\n');
		throw new Error(`Failed to build ${readPackageName(resolvedRiffDir)}${diagnostics ? `\n${diagnostics}` : ''}`);
	}

	const output = join(resolvedRiffDir, 'dist', 'cli.js');
	if (!existsSync(output)) throw new Error(`Riff distribution was not created: ${output}`);
	return output;
}

if (import.meta.main) {
	const output = await buildRiff();
	process.stdout.write(`Built ${basename(resolve(process.cwd()))}: ${output}\n`);
}
