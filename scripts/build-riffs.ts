#!/usr/bin/env bun

import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { buildRiff } from './build-riff.js';

const repositoryRoot = resolve(import.meta.dirname, '..');
const riffsDir = join(repositoryRoot, 'riffs');
const riffNames = readdirSync(riffsDir)
	.filter(name => !name.startsWith('.') && statSync(join(riffsDir, name)).isDirectory())
	.sort();

for (const riffName of riffNames) {
	await buildRiff(join(riffsDir, riffName));
	process.stdout.write(`Built ${riffName}\n`);
}

process.stdout.write(`Built ${riffNames.length} Riffs\n`);
