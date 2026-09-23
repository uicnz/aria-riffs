#!/usr/bin/env bun

import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { buildRiff } from './build-riff.js';

const RIFF_SOURCE_TIERS = ['system', 'curated', 'experimental'] as const;

const repositoryRoot = resolve(import.meta.dirname, '..');
const riffsDir = join(repositoryRoot, 'riffs');
const riffDirs = RIFF_SOURCE_TIERS.flatMap(tier => {
	const tierDir = join(riffsDir, `.${tier}`);
	if (!existsSync(tierDir)) return [];
	return readdirSync(tierDir)
		.filter(name => !name.startsWith('.') && !name.startsWith('_') && statSync(join(tierDir, name)).isDirectory())
		.sort()
		.map(name => ({ name, path: join(tierDir, name) }));
});

for (const riff of riffDirs) {
	await buildRiff(riff.path);
	process.stdout.write(`Built ${riff.name}\n`);
}

process.stdout.write(`Built ${riffDirs.length} Riffs\n`);
