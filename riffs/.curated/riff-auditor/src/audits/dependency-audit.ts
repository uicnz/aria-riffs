/**
 * Package dependency audit - enforces standalone Bun package identity,
 * dependency parity, and current direct dependency releases for each Riff.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { collectModuleSpecifiers } from './typescript-scanner.js';
import { listFilesRecursive, listRiffDirs, riffRoot } from './utils.js';

interface PackageManifest {
	dependencies?: Record<string, string>;
	engines?: Record<string, string>;
	packageManager?: string;
}

export interface DependencyAuditResult {
	packagePath?: string;
	packageExists: boolean;
	packageJsonValid: boolean;
	packageManager: string | null;
	packageManagerMatchesCanonical: boolean;
	bunEngine: string | null;
	bunEngineMatchesCanonical: boolean;
	nodeEngine: string | null;
	nodeEngineMatchesCanonical: boolean;
	dependencyNames: string[];
	sourceDependencies: string[];
	dependenciesSorted: boolean;
	invalidDependencySpecs: string[];
	sharedDependencyVersionMismatches: string[];
	undeclaredSourceDependencies: string[];
	unusedDeclaredDependencies: string[];
	hasCanonicalDependencies: boolean;
}

function readManifest(path: string): PackageManifest | null {
	try {
		return JSON.parse(readFileSync(path, 'utf8')) as PackageManifest;
	} catch {
		return null;
	}
}

function findSharedVersionMismatches(dependencies: Record<string, string>, repoRoot: string): string[] {
	const versionsByDependency = new Map<string, Set<string>>();
	const riffsDir = resolve(repoRoot, 'riffs');

	if (!existsSync(riffsDir)) return [];
	for (const riff of listRiffDirs(riffsDir)) {
		const manifest = readManifest(resolve(riffRoot(repoRoot, riff), 'package.json'));
		for (const [name, version] of Object.entries(manifest?.dependencies ?? {})) {
			if (!(name in dependencies)) continue;
			const versions = versionsByDependency.get(name) ?? new Set<string>();
			versions.add(version);
			versionsByDependency.set(name, versions);
		}
	}

	return [...versionsByDependency.entries()]
		.filter(([, versions]) => versions.size > 1)
		.map(([name, versions]) => `${name}: ${[...versions].sort().join(', ')}`)
		.sort();
}

function packageNameFromSpecifier(specifier: string): string {
	return specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0];
}

function collectSourceDependencies(riff: string, repoRoot: string): string[] {
	const srcRoot = resolve(riffRoot(repoRoot, riff), 'src');
	if (!existsSync(srcRoot)) return [];

	const dependencies = new Set<string>();
	for (const path of listFilesRecursive(srcRoot).filter(file => /\.(?:ts|tsx)$/.test(file))) {
		const source = readFileSync(path, 'utf8');
		for (const specifier of collectModuleSpecifiers(source)) {
			if (
				specifier.startsWith('.') ||
				specifier.startsWith('node:') ||
				specifier.startsWith('bun:') ||
				specifier.startsWith('#')
			) {
				continue;
			}
			dependencies.add(packageNameFromSpecifier(specifier));
		}
	}

	return [...dependencies].sort();
}

export function auditDependencies(riff: string, repoRoot: string): DependencyAuditResult {
	const packagePath = resolve(riffRoot(repoRoot, riff), 'package.json');
	const emptyResult: DependencyAuditResult = {
		packagePath: undefined,
		packageExists: false,
		packageJsonValid: false,
		packageManager: null,
		packageManagerMatchesCanonical: false,
		bunEngine: null,
		bunEngineMatchesCanonical: false,
		nodeEngine: null,
		nodeEngineMatchesCanonical: false,
		dependencyNames: [],
		sourceDependencies: [],
		dependenciesSorted: false,
		invalidDependencySpecs: [],
		sharedDependencyVersionMismatches: [],
		undeclaredSourceDependencies: [],
		unusedDeclaredDependencies: [],
		hasCanonicalDependencies: false,
	};

	if (!existsSync(packagePath)) return emptyResult;

	const manifest = readManifest(packagePath);
	const rootManifest = readManifest(resolve(repoRoot, 'package.json'));
	if (!manifest || !rootManifest) {
		return { ...emptyResult, packagePath, packageExists: true };
	}

	const dependencies = manifest.dependencies ?? {};
	const dependencyNames = Object.keys(dependencies);
	const sortedDependencyNames = [...dependencyNames].sort((left, right) => left.localeCompare(right));
	const dependenciesSorted = dependencyNames.every((name, index) => name === sortedDependencyNames[index]);
	const invalidDependencySpecs: string[] = [];

	for (const [name, spec] of Object.entries(dependencies)) {
		const match = spec.match(/^\^(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/);
		if (!match) {
			invalidDependencySpecs.push(`${name}: ${spec}`);
		}
	}

	const sharedDependencyVersionMismatches = findSharedVersionMismatches(dependencies, repoRoot);
	const sourceDependencies = collectSourceDependencies(riff, repoRoot);
	const undeclaredSourceDependencies = sourceDependencies.filter(name => !(name in dependencies));
	const unusedDeclaredDependencies = dependencyNames.filter(name => !sourceDependencies.includes(name));
	const packageManager = manifest.packageManager ?? null;
	const bunEngine = manifest.engines?.bun ?? null;
	const nodeEngine = manifest.engines?.node ?? null;
	const packageManagerMatchesCanonical = packageManager === rootManifest.packageManager;
	const bunEngineMatchesCanonical = bunEngine === rootManifest.engines?.bun;
	const nodeEngineMatchesCanonical = nodeEngine === rootManifest.engines?.node;

	return {
		packagePath,
		packageExists: true,
		packageJsonValid: true,
		packageManager,
		packageManagerMatchesCanonical,
		bunEngine,
		bunEngineMatchesCanonical,
		nodeEngine,
		nodeEngineMatchesCanonical,
		dependencyNames,
		sourceDependencies,
		dependenciesSorted,
		invalidDependencySpecs: invalidDependencySpecs.sort(),
		sharedDependencyVersionMismatches,
		undeclaredSourceDependencies,
		unusedDeclaredDependencies,
		hasCanonicalDependencies:
			packageManagerMatchesCanonical &&
			bunEngineMatchesCanonical &&
			nodeEngineMatchesCanonical &&
			dependenciesSorted &&
			invalidDependencySpecs.length === 0 &&
			sharedDependencyVersionMismatches.length === 0 &&
			undeclaredSourceDependencies.length === 0 &&
			unusedDeclaredDependencies.length === 0,
	};
}
