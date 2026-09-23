/** Canonical `RIFF.md` reader: frontmatter identity, then the fixed guidance sections an Agent reads before invoking. */

import { parse as parseYaml } from 'yaml';

export const RIFF_DOCUMENT_FILENAME = 'RIFF.md';

export interface RiffDocumentParameter {
	name: string;
	type: string;
	required: boolean;
	description: string;
}

export interface RiffDocumentExample {
	description: string;
	command: string;
	outcome: string;
}

export interface RiffDocument {
	name: string;
	summary: string;
	purpose: string;
	whenToUse: string[];
	pipeline: string[];
	parameters: RiffDocumentParameter[];
	output: string;
	constraints: string[];
	conventions: string[];
	examples: RiffDocumentExample[];
}

const SECTION_TITLES = {
	purpose: 'Purpose',
	whenToUse: 'When to use',
	pipeline: 'Pipeline',
	parameters: 'Parameters',
	output: 'Output',
	constraints: 'Constraints',
	conventions: 'Conventions',
	examples: 'Examples',
} as const;

const PARAMETER_TABLE_HEADER = '| Name | Type | Required | Description |';
const EXAMPLE_FENCE = '```sh';

export class RiffDocumentError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'RiffDocumentError';
	}
}

function fail(message: string): never {
	throw new RiffDocumentError(message);
}

function splitCells(row: string): string[] {
	const trimmed = row.trim();
	if (!trimmed.startsWith('|') || !trimmed.endsWith('|'))
		fail(`Parameter row must start and end with a pipe: ${row}`);
	const body = trimmed.slice(1, -1);
	const cells: string[] = [];
	let current = '';
	for (let index = 0; index < body.length; index += 1) {
		const char = body[index];
		if (char === '\\' && index + 1 < body.length) {
			current += body[index + 1];
			index += 1;
			continue;
		}
		if (char === '|') {
			cells.push(current.trim());
			current = '';
			continue;
		}
		current += char;
	}
	cells.push(current.trim());
	return cells;
}

function parseFrontmatter(markdown: string): { name: string; description: string; body: string } {
	const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/u);
	if (!match) fail('RIFF.md must open with YAML frontmatter.');
	const parsed: unknown = parseYaml(match[1]);
	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) fail('RIFF.md frontmatter must be a mapping.');
	const { name, description } = parsed as Record<string, unknown>;
	if (typeof name !== 'string' || name.length === 0) fail('RIFF.md frontmatter must declare name.');
	if (typeof description !== 'string' || description.length === 0) {
		fail('RIFF.md frontmatter must declare description.');
	}
	return { name, description, body: match[2] };
}

function splitSections(body: string): Map<string, string[]> {
	const sections = new Map<string, string[]>();
	let current: string[] | null = null;
	for (const rawLine of body.split(/\r?\n/u)) {
		const line = rawLine.trimEnd();
		if (line.startsWith('## ')) {
			const title = line.slice(3).trim();
			if (sections.has(title)) fail(`RIFF.md repeats the section ${title}.`);
			current = [];
			sections.set(title, current);
			continue;
		}
		if (current) current.push(line);
	}
	const known = new Set<string>(Object.values(SECTION_TITLES));
	for (const title of sections.keys()) {
		if (!known.has(title)) fail(`RIFF.md has an unknown section: ${title}.`);
	}
	for (const title of known) {
		if (!sections.has(title)) fail(`RIFF.md is missing the section ${title}.`);
	}
	return sections;
}

function paragraph(title: string, lines: readonly string[]): string {
	const paragraphs: string[] = [];
	let current: string[] = [];
	for (const line of lines) {
		if (line.trim().length === 0) {
			if (current.length > 0) paragraphs.push(current.join(' '));
			current = [];
			continue;
		}
		current.push(line.trim());
	}
	if (current.length > 0) paragraphs.push(current.join(' '));
	if (paragraphs.length === 0) fail(`RIFF.md section ${title} must contain text.`);
	return paragraphs.join('\n\n');
}

function bullets(title: string, lines: readonly string[]): string[] {
	return lines
		.filter(line => line.trim().length > 0)
		.map(line => {
			const match = line.match(/^- (.+)$/u);
			if (!match) fail(`RIFF.md section ${title} accepts only "- " bullet lines: ${line}`);
			return match[1].trim();
		});
}

function ordered(title: string, lines: readonly string[]): string[] {
	return lines
		.filter(line => line.trim().length > 0)
		.map((line, index) => {
			const match = line.match(/^(\d+)\. (.+)$/u);
			if (!match) fail(`RIFF.md section ${title} accepts only numbered lines: ${line}`);
			if (Number(match[1]) !== index + 1) fail(`RIFF.md section ${title} must number its steps from 1 in order.`);
			return match[2].trim();
		});
}

function parameters(lines: readonly string[]): RiffDocumentParameter[] {
	const rows = lines.filter(line => line.trim().length > 0);
	if (
		rows.length < 2 ||
		rows[0].trim() !== PARAMETER_TABLE_HEADER ||
		!/^\|(?:\s*-+\s*\|){4}$/u.test(rows[1].trim())
	) {
		fail(`RIFF.md Parameters must open with the table header ${PARAMETER_TABLE_HEADER}.`);
	}
	return rows.slice(2).map(row => {
		const cells = splitCells(row);
		if (cells.length !== 4) fail(`RIFF.md parameter row must have four cells: ${row}`);
		const [name, type, required, description] = cells;
		const code = /^`([^`]+)`$/u;
		const nameMatch = name.match(code);
		const typeMatch = type.match(code);
		if (!nameMatch || !typeMatch) fail(`RIFF.md parameter name and type must be inline code: ${row}`);
		if (required !== 'yes' && required !== 'no') fail(`RIFF.md parameter Required must be yes or no: ${row}`);
		return { name: nameMatch[1], type: typeMatch[1], required: required === 'yes', description };
	});
}

function examples(lines: readonly string[]): RiffDocumentExample[] {
	const output: RiffDocumentExample[] = [];
	let index = 0;
	const skipBlank = (): void => {
		while (index < lines.length && lines[index].trim().length === 0) index += 1;
	};
	skipBlank();
	while (index < lines.length) {
		const heading = lines[index].match(/^### (.+)$/u);
		if (!heading) fail(`RIFF.md Examples accepts only "### " example headings: ${lines[index]}`);
		const description = heading[1].trim();
		index += 1;
		skipBlank();
		if (lines[index]?.trim() !== EXAMPLE_FENCE)
			fail(`RIFF.md example ${description} must open a ${EXAMPLE_FENCE} block.`);
		index += 1;
		const command: string[] = [];
		while (index < lines.length && lines[index].trim() !== '```') {
			command.push(lines[index]);
			index += 1;
		}
		if (index >= lines.length) fail(`RIFF.md example ${description} does not close its code block.`);
		index += 1;
		const outcome: string[] = [];
		while (index < lines.length && !lines[index].startsWith('### ')) {
			outcome.push(lines[index]);
			index += 1;
		}
		output.push({
			description,
			command: command.join('\n').trim(),
			outcome: paragraph(`Examples: ${description}`, outcome),
		});
		skipBlank();
	}
	return output;
}

/** Read one `RIFF.md` into its structured form, refusing any document that departs from the contract. */
export function parseRiffDocument(markdown: string): RiffDocument {
	const { name, description, body } = parseFrontmatter(markdown);
	const sections = splitSections(body);
	const read = (title: string): string[] => sections.get(title) ?? [];
	return {
		name,
		summary: description,
		purpose: paragraph(SECTION_TITLES.purpose, read(SECTION_TITLES.purpose)),
		whenToUse: bullets(SECTION_TITLES.whenToUse, read(SECTION_TITLES.whenToUse)),
		pipeline: ordered(SECTION_TITLES.pipeline, read(SECTION_TITLES.pipeline)),
		parameters: parameters(read(SECTION_TITLES.parameters)),
		output: paragraph(SECTION_TITLES.output, read(SECTION_TITLES.output)),
		constraints: bullets(SECTION_TITLES.constraints, read(SECTION_TITLES.constraints)),
		conventions: bullets(SECTION_TITLES.conventions, read(SECTION_TITLES.conventions)),
		examples: examples(read(SECTION_TITLES.examples)),
	};
}
