#!/usr/bin/env bun

interface PackageManifest {
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
	overrides?: Record<string, string>;
}

interface DependencyDeclaration {
	manifest: string;
	name: string;
	spec: string;
	version: string;
}

const CONCURRENCY = 16;

async function readManifest(path: string): Promise<PackageManifest> {
	return (await Bun.file(path).json()) as PackageManifest;
}

function parseVersion(spec: string): string | null {
	return spec.match(/^\^?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/)?.[1] ?? null;
}

const riffManifests = [...new Bun.Glob('riffs/*/*/package.json').scanSync('.')].sort();
const manifestPaths = ['package.json', ...riffManifests];
const declarations: DependencyDeclaration[] = [];
const violations: string[] = [];

for (const manifestPath of manifestPaths) {
	const manifest = await readManifest(manifestPath);
	const sections =
		manifestPath === 'package.json'
			? [manifest.dependencies ?? {}, manifest.devDependencies ?? {}, manifest.overrides ?? {}]
			: [manifest.dependencies ?? {}];

	for (const section of sections) {
		for (const [name, spec] of Object.entries(section)) {
			const version = parseVersion(spec);
			if (!version) {
				violations.push(`${manifestPath}: ${name} has unsupported dependency spec ${spec}`);
				continue;
			}
			declarations.push({ manifest: manifestPath, name, spec, version });
		}
	}
}

const riffVersions = new Map<string, Map<string, string[]>>();
for (const declaration of declarations.filter(item => item.manifest !== 'package.json')) {
	const versions = riffVersions.get(declaration.name) ?? new Map<string, string[]>();
	const manifests = versions.get(declaration.spec) ?? [];
	manifests.push(declaration.manifest);
	versions.set(declaration.spec, manifests);
	riffVersions.set(declaration.name, versions);
}

for (const [name, versions] of riffVersions) {
	if (versions.size < 2) continue;
	const detail = [...versions.entries()]
		.map(([version, manifests]) => `${version} in ${manifests.join(', ')}`)
		.join('; ');
	violations.push(`shared dependency drift for ${name}: ${detail}`);
}

const declarationsByName = new Map<string, DependencyDeclaration[]>();
for (const declaration of declarations) {
	const packageDeclarations = declarationsByName.get(declaration.name) ?? [];
	packageDeclarations.push(declaration);
	declarationsByName.set(declaration.name, packageDeclarations);
}

const packages = [...declarationsByName.entries()];
let cursor = 0;

async function worker(): Promise<void> {
	while (cursor < packages.length) {
		const [name, packageDeclarations] = packages[cursor++];
		const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}/latest`);
		if (!response.ok) {
			violations.push(`${name}: registry lookup failed with HTTP ${response.status}`);
			continue;
		}

		const metadata = (await response.json()) as { version?: unknown };
		if (typeof metadata.version !== 'string') {
			violations.push(`${name}: registry response has no latest version`);
			continue;
		}

		for (const declaration of packageDeclarations) {
			if (declaration.version !== metadata.version) {
				violations.push(
					`${declaration.manifest}: ${name} declares ${declaration.version}; npm latest is ${metadata.version}`
				);
			}
		}
	}
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker));

if (violations.length > 0) {
	for (const violation of violations.sort()) {
		console.error(`Dependency currency violation: ${violation}`);
	}
	process.exitCode = 1;
} else {
	console.log(
		`Dependency currency audit passed: ${declarationsByName.size} declared packages across ${riffManifests.length} standalone Riffs are current.`
	);
}
