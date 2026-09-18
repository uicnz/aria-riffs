import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { parse as parseDotEnv } from 'dotenv';

function resolveHomeDirectory(): string {
	const envHome = (
		process.platform === 'win32'
			? process.env.USERPROFILE || process.env.HOME
			: process.env.HOME || process.env.USERPROFILE
	)?.trim();
	return envHome || homedir();
}

/**
 * Canonical Aria home. Change this constant in a fork to redirect Aria-owned state.
 */
export const ARIA_HOME = join(resolveHomeDirectory(), '.aria');

export function getAriaHome(): string {
	return ARIA_HOME;
}

const dotenvOwnedKeys = new Set<string>();
let loadedDotEnvCwd: string | undefined;

function readDotEnvValues(paths: string[]): Map<string, string> {
	const values = new Map<string, string>();
	for (const path of paths) {
		let parsed: Record<string, string>;
		try {
			parsed = parseDotEnv(readFileSync(path, 'utf8'));
		} catch {
			continue;
		}

		for (const [key, value] of Object.entries(parsed)) {
			if (!values.has(key)) values.set(key, value);
		}
	}
	return values;
}

function applyDotEnvValues(values: Map<string, string>): void {
	for (const ownedKey of [...dotenvOwnedKeys]) {
		const nextValue = values.get(ownedKey);
		if (typeof nextValue === 'string') {
			process.env[ownedKey] = nextValue;
		} else {
			delete process.env[ownedKey];
			dotenvOwnedKeys.delete(ownedKey);
		}
	}

	for (const [key, value] of values) {
		if (dotenvOwnedKeys.has(key) || typeof process.env[key] === 'string') continue;
		process.env[key] = value;
		dotenvOwnedKeys.add(key);
	}
}

/**
 * Load Aria environment files with the parent application's precedence:
 * process environment, project .aria/.env, then user ~/.aria/.env.
 */
export function loadDotEnv(cwd: string = process.cwd()): void {
	loadedDotEnvCwd = cwd;
	const paths: string[] = [];
	const projectEnv = resolve(cwd, '.aria', '.env');
	const userEnv = join(getAriaHome(), '.env');

	if (existsSync(projectEnv)) paths.push(projectEnv);
	if (existsSync(userEnv)) paths.push(userEnv);

	applyDotEnvValues(readDotEnvValues(paths));
}

export function refreshLoadedDotEnv(): void {
	if (loadedDotEnvCwd) loadDotEnv(loadedDotEnvCwd);
}

export function resetDotEnvStateForTests(): void {
	for (const key of dotenvOwnedKeys) delete process.env[key];
	dotenvOwnedKeys.clear();
	loadedDotEnvCwd = undefined;
}
