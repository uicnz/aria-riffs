import { Command } from 'commander';
import { describe, expect, it, vi } from 'vitest';
import packageManifest from '../../package.json' with { type: 'json' };
import { createProgram } from '../../src/cli.js';

describe('cli - command structure', () => {
	it('given createProgram, when called, then returns Commander Command instance', () => {
		const program = createProgram();
		expect(program).toBeInstanceOf(Command);
	});

	it('given program, when created, then has correct name', () => {
		const program = createProgram();
		expect(program.name()).toBe('hr-staffer');
	});

	it('given program, when created, then has correct version', () => {
		const program = createProgram();
		expect(program.version()).toBe(packageManifest.version);
	});

	it('given program, when created, then has correct description', () => {
		const program = createProgram();
		expect(program.description()).toBe(packageManifest.description);
	});

	it('given program, when created, then generate command has csv-file argument', () => {
		const program = createProgram();
		const generateCmd = program.commands.find(cmd => cmd.name() === 'generate');
		const csvArgument = generateCmd?.registeredArguments[0];
		expect(csvArgument).toBeDefined();
		expect(csvArgument?.name()).toBe('csv-file');
	});

	it('given program, when created, then generate command has required config option', () => {
		const program = createProgram();
		const generateCmd = program.commands.find(cmd => cmd.name() === 'generate');
		const configOption = generateCmd?.options.find(opt => opt.long === '--config');
		expect(configOption).toBeDefined();
		expect(configOption?.short).toBe('-c');
	});

	it('given program, when created, then generate command has required output option', () => {
		const program = createProgram();
		const generateCmd = program.commands.find(cmd => cmd.name() === 'generate');
		const outputOption = generateCmd?.options.find(opt => opt.long === '--output');
		expect(outputOption).toBeDefined();
		expect(outputOption?.short).toBe('-o');
	});

	it('given program, when created, then generate command has format flags (text-only, markdown-only, mermaid-only)', () => {
		const program = createProgram();
		const generateCmd = program.commands.find(cmd => cmd.name() === 'generate');
		const textOnly = generateCmd?.options.find(opt => opt.long === '--text-only');
		const markdownOnly = generateCmd?.options.find(opt => opt.long === '--markdown-only');
		const mermaidOnly = generateCmd?.options.find(opt => opt.long === '--mermaid-only');

		expect(textOnly).toBeDefined();
		expect(markdownOnly).toBeDefined();
		expect(mermaidOnly).toBeDefined();
	});

	it('given program, when created, then generate command has display option flags', () => {
		const program = createProgram();
		const generateCmd = program.commands.find(cmd => cmd.name() === 'generate');
		const noTitle = generateCmd?.options.find(opt => opt.long === '--no-title');
		const noDepartment = generateCmd?.options.find(opt => opt.long === '--no-department');
		const includeEmail = generateCmd?.options.find(opt => opt.long === '--include-email');

		expect(noTitle).toBeDefined();
		expect(noDepartment).toBeDefined();
		expect(includeEmail).toBeDefined();
	});

	it('given program, when created, then generate command has max-depth option', () => {
		const program = createProgram();
		const generateCmd = program.commands.find(cmd => cmd.name() === 'generate');
		const maxDepth = generateCmd?.options.find(opt => opt.long === '--max-depth');
		expect(maxDepth).toBeDefined();
	});

	it('given program, when invoked with nonexistent CSV file, then exits with error code', async () => {
		const program = createProgram();
		const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

		await program.parseAsync(['node', 'cli.ts', 'does-not-exist.csv']);

		expect(exitSpy).toHaveBeenCalledWith(1);

		vi.restoreAllMocks();
	});
});
