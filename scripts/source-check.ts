import { existsSync, lstatSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';

const tiers = ['system', 'curated', 'experimental'] as const;
const riffNamePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const taxonomySegmentPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function object(value: unknown, label: string): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`);
	return value as Record<string, unknown>;
}

function validateSourceTaxonomy(sourcePath: string, riffIds: ReadonlySet<string>): void {
	const source = object(parseYaml(readFileSync(sourcePath, 'utf8')), 'source.yaml');
	if (source.schema !== 'aria.riff.source/v1') throw new Error('Invalid Riff Source schema.');
	if (source.sourceId !== 'aria-official' || source.authorityId !== 'aria-official') {
		throw new Error('Invalid Riff Source identity.');
	}
	const domain = object(source.domain, 'source.yaml domain');
	const assignments = object(source.assignments, 'source.yaml assignments');
	for (const [domainId, rawDomain] of Object.entries(domain)) {
		if (!taxonomySegmentPattern.test(domainId)) throw new Error(`Invalid Source domain ID: ${domainId}`);
		const domain = object(rawDomain, `Source domain ${domainId}`);
		const categories = object(domain.categories, `Source domain ${domainId} categories`);
		for (const categoryId of Object.keys(categories)) {
			if (!taxonomySegmentPattern.test(categoryId)) throw new Error(`Invalid Source category ID: ${categoryId}`);
		}
	}
	for (const [riffId, rawAssignment] of Object.entries(assignments)) {
		if (!riffNamePattern.test(riffId)) throw new Error(`Invalid assigned Riff ID: ${riffId}`);
		const assignment = object(rawAssignment, `Source assignment ${riffId}`);
		const domainId = assignment.domain;
		const categoryId = assignment.category;
		if (typeof domainId !== 'string' || typeof categoryId !== 'string') {
			throw new Error(`Source assignment must declare domain and category: ${riffId}`);
		}
		const domainDefinition = object(domain[domainId], `Source assignment domain ${domainId}`);
		const categories = object(domainDefinition.categories, `Source assignment domain ${domainId} categories`);
		if (!categories[categoryId])
			throw new Error(`Unknown Source category for ${riffId}: ${domainId}/${categoryId}`);
	}
	const assignmentIds = new Set(Object.keys(assignments));
	const missing = [...riffIds].filter(id => !assignmentIds.has(id)).sort();
	const unknown = [...assignmentIds].filter(id => !riffIds.has(id)).sort();
	if (missing.length > 0 || unknown.length > 0) {
		throw new Error(
			`Source taxonomy coverage mismatch. Missing: ${missing.join(', ') || 'none'}. Unknown: ${unknown.join(', ') || 'none'}.`
		);
	}
}

function riffName(root: string): string {
	const raw = readFileSync(path.join(root, 'RIFF.md'), 'utf8');
	const frontmatter = raw.match(/^---\s*\n([\s\S]*?)\n---(?:\s*\n|$)/);
	if (!frontmatter?.[1]) throw new Error(`RIFF.md has no YAML frontmatter: ${root}`);
	const parsed = parseYaml(frontmatter[1]) as { name?: unknown; description?: unknown };
	if (typeof parsed.name !== 'string' || !riffNamePattern.test(parsed.name)) {
		throw new Error(`RIFF.md has an invalid name: ${root}`);
	}
	if (typeof parsed.description !== 'string' || parsed.description.length === 0) {
		throw new Error(`RIFF.md has no description: ${root}`);
	}
	if (parsed.name !== path.basename(root)) {
		throw new Error(`RIFF.md name ${parsed.name} must equal its directory name: ${root}`);
	}
	return parsed.name;
}

function nestedRiffRoots(root: string): string[] {
	const output: string[] = [];
	const walk = (directory: string): void => {
		for (const entry of readdirSync(directory, { withFileTypes: true })) {
			if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue;
			const pathname = path.join(directory, entry.name);
			if (entry.isSymbolicLink()) throw new Error(`Riff Source contains a link: ${pathname}`);
			if (!entry.isDirectory()) continue;
			if (existsSync(path.join(pathname, 'RIFF.md'))) output.push(pathname);
			walk(pathname);
		}
	};
	walk(root);
	return output;
}

function validateSharedAssets(root: string): void {
	const walk = (directory: string): void => {
		for (const entry of readdirSync(directory, { withFileTypes: true })) {
			const pathname = path.join(directory, entry.name);
			if (entry.isSymbolicLink()) throw new Error(`Shared Source assets contain a link: ${pathname}`);
			if (entry.isDirectory()) walk(pathname);
			else if (!entry.isFile()) throw new Error(`Shared Source assets contain a non-regular file: ${pathname}`);
		}
	};
	walk(root);
}

const riffsRoot = path.resolve(process.argv[2] ?? 'riffs');
let releaseUnitCount = 0;
const roots = [];
const identities = new Set<string>();
for (const tier of tiers) {
	const tierRoot = path.join(riffsRoot, `.${tier}`);
	if (!existsSync(tierRoot)) {
		roots.push({ tier, present: false, releaseUnitCount: 0 });
		continue;
	}
	const stat = lstatSync(tierRoot);
	if (!stat.isDirectory() || stat.isSymbolicLink())
		throw new Error(`Tier root is not a regular directory: ${tierRoot}`);
	let tierUnits = 0;
	for (const entry of readdirSync(tierRoot, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
		if (entry.name.startsWith('.')) continue;
		const unitRoot = path.join(tierRoot, entry.name);
		if (entry.isSymbolicLink()) throw new Error(`Tier contains a link: ${unitRoot}`);
		if (!entry.isDirectory()) continue;
		if (entry.name === '_assets') {
			validateSharedAssets(unitRoot);
			continue;
		}
		if (!existsSync(path.join(unitRoot, 'RIFF.md'))) throw new Error(`Release unit has no RIFF.md: ${unitRoot}`);
		if (!existsSync(path.join(unitRoot, 'README.md')))
			throw new Error(`Release unit has no README.md: ${unitRoot}`);
		const identity = riffName(unitRoot);
		if (identities.has(identity)) throw new Error(`Riff identity occurs more than once: ${identity}`);
		identities.add(identity);
		const nested = nestedRiffRoots(unitRoot);
		if (nested.length > 0) throw new Error(`Release unit contains nested riffs: ${nested.join(', ')}`);
		tierUnits += 1;
	}
	releaseUnitCount += tierUnits;
	roots.push({ tier, present: true, releaseUnitCount: tierUnits });
}
validateSourceTaxonomy(path.join(riffsRoot, '..', 'source.yaml'), identities);
process.stdout.write(`${JSON.stringify({ roots, totals: { releaseUnitCount } }, null, 2)}\n`);
