import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createProgram } from '../../src/cli.js';
import type { BatchResult } from '../../src/lib/types.js';

const mockBatchResult: BatchResult = {
	totalFiles: 1,
	processed: 1,
	failed: 0,
	skipped: 0,
	results: [],
};

const mockFailedResult: BatchResult = {
	totalFiles: 2,
	processed: 1,
	failed: 1,
	skipped: 0,
	results: [
		{
			inputPath: 'good.jpg',
			outputPath: 'good.jpg',
			originalSize: 1000,
			finalSize: 1000,
			iterations: 0,
			success: true,
		},
		{
			inputPath: 'bad.jpg',
			outputPath: 'bad.jpg',
			originalSize: 0,
			finalSize: 0,
			iterations: 0,
			success: false,
			error: 'Test error',
		},
	],
};

describe('CLI', () => {
	it('given CLI program, when created, then is a Commander program', () => {
		expect(createProgram()).toBeInstanceOf(Command);
	});

	it('given CLI program, when created, then has "process" command', () => {
		const processCommand = createProgram().commands.find(cmd => cmd.name() === 'process');
		expect(processCommand).toBeDefined();
	});

	it('given CLI program, when created, then requires file path argument', () => {
		const processCommand = createProgram().commands.find(cmd => cmd.name() === 'process');
		expect(processCommand?.registeredArguments).toHaveLength(1);
		expect(processCommand?.registeredArguments[0].required).toBe(true);
	});

	it('given mock transcoder injected, when process action invoked, then calls mock', async () => {
		const program = createProgram();
		const mockTranscoder = {
			process: vi.fn().mockResolvedValue(mockBatchResult),
		};
		program.setTranscoder(mockTranscoder as any);

		await program.parseAsync(['node', 'cli.js', 'process', '/path/to/image.png']);

		expect(mockTranscoder.process).toHaveBeenCalledWith('/path/to/image.png');
	});

	it('given no transcoder injected, when process action invoked, then creates default ImageTranscoder', async () => {
		const program = createProgram();
		const { ImageTranscoder } = await import('../../src/core/image-transcoder.js');
		const constructorSpy = vi.spyOn(ImageTranscoder.prototype, 'process').mockResolvedValue(mockBatchResult);

		program.setTranscoder(undefined as any);
		await program.parseAsync(['node', 'cli.js', 'process', '/path/to/test.png']);

		expect(constructorSpy).toHaveBeenCalledWith('/path/to/test.png');
	});

	it('given --output option, when process command invoked, then accepts option without error', async () => {
		const program = createProgram();
		const mockTranscoder = {
			process: vi.fn().mockResolvedValue(mockBatchResult),
		};
		program.setTranscoder(mockTranscoder as any);

		await expect(
			program.parseAsync(['node', 'cli.js', 'process', '/path/to/image.png', '--output', '/output/dir'])
		).resolves.not.toThrow();
	});

	it('given --output option, when process command invoked, then transcoder has output_dir from CLI option', async () => {
		const program = createProgram();
		const { ImageTranscoder } = await import('../../src/core/image-transcoder.js');
		let capturedTranscoder: any = null;
		const processSpy = vi.spyOn(ImageTranscoder.prototype, 'process').mockImplementation(async function (
			this: any
		): Promise<BatchResult> {
			capturedTranscoder = this;
			return mockBatchResult;
		});

		program.setTranscoder(undefined as any);
		await program.parseAsync(['node', 'cli.js', 'process', '/path/to/image.png', '--output', '/custom/output']);

		expect(capturedTranscoder).not.toBeNull();
		expect(capturedTranscoder.outputDir).toBe('/custom/output');
		processSpy.mockRestore();
	});
});

describe('CLI - Summary and Exit Code', () => {
	let exitSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
	});

	afterEach(() => {
		exitSpy.mockRestore();
	});

	it('given successful processing, when CLI completes, then does not call process.exit', async () => {
		const program = createProgram();
		const mockTranscoder = {
			process: vi.fn().mockResolvedValue(mockBatchResult),
		};
		program.setTranscoder(mockTranscoder as any);

		await program.parseAsync(['node', 'cli.js', 'process', '/path/to/image.png']);

		expect(exitSpy).not.toHaveBeenCalled();
	});

	it('given failed processing, when CLI completes, then calls process.exit with code 1', async () => {
		const program = createProgram();
		const mockTranscoder = {
			process: vi.fn().mockResolvedValue(mockFailedResult),
		};
		program.setTranscoder(mockTranscoder as any);

		await program.parseAsync(['node', 'cli.js', 'process', '/path/to/image.png']);

		expect(exitSpy).toHaveBeenCalledWith(1);
	});
});
