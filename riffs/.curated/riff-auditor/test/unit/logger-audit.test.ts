/**
 * Unit tests for logger-audit module
 */

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { auditLogger } from '../../src/audits/logger-audit.js';

const TEST_ROOT = resolve(tmpdir(), 'aria-logger-audit-test');

function writeLogger(riff: string, content: string): void {
	const loggerDir = resolve(TEST_ROOT, 'riffs', '.curated', riff, 'src', 'lib');
	mkdirSync(loggerDir, { recursive: true });
	writeFileSync(resolve(loggerDir, 'logger.ts'), content, 'utf8');
}

describe('Logger Audit', () => {
	beforeEach(() => {
		mkdirSync(resolve(TEST_ROOT, 'riffs'), { recursive: true });
	});

	afterEach(() => {
		rmSync(TEST_ROOT, { recursive: true, force: true });
	});

	it('given transport worker targets, when audited, then flags standalone-hostile logger', () => {
		writeLogger(
			'test-riff',
			`
import type { Logger } from 'pino';
import pino from 'pino';

export interface LoggerOptions {
	level: string;
	verbose: boolean;
	silent?: boolean;
}

export function createLogger(options: LoggerOptions): Logger {
	return pino({}, pino.transport({
		targets: [
			{ target: 'pino-pretty' },
			{ target: 'pino-roll' },
		],
	}));
}
`
		);

		const result = auditLogger('test-riff', TEST_ROOT);

		expect(result.loggerExists).toBe(true);
		expect(result.usesPinoTransportCall).toBe(true);
		expect(result.usesPinoPrettyTarget).toBe(true);
		expect(result.usesPinoRollTarget).toBe(true);
		expect(result.isStandaloneSafe).toBe(false);
	});

	it('given inline transport config, when audited, then flags standalone-hostile logger', () => {
		writeLogger(
			'test-riff',
			`
import type { Logger } from 'pino';
import pino from 'pino';

export interface LoggerOptions {
	level: string;
	verbose: boolean;
	silent?: boolean;
}

export function createLogger(options: LoggerOptions): Logger {
	return pino({
		level: 'info',
		transport: {
			targets: [{ target: 'pino-pretty' }],
		},
	});
}
`
		);

		const result = auditLogger('test-riff', TEST_ROOT);

		expect(result.usesInlineTransportConfig).toBe(true);
		expect(result.usesTransportTargets).toBe(true);
		expect(result.isStandaloneSafe).toBe(false);
	});

	it('given destination streams and multistream, when audited, then reports standalone-safe logger', () => {
		writeLogger(
			'test-riff',
			`
import type { Level, Logger, LoggerOptions as PinoLoggerOptions, StreamEntry } from 'pino';
import pino from 'pino';

export interface LoggerOptions {
	level: string;
	verbose: boolean;
	silent?: boolean;
	file?: string;
}

export function createLogger(options: LoggerOptions): Logger {
	const logLevel = (options.verbose ? 'debug' : options.level.toLowerCase()) as Level;
	const loggerOptions: PinoLoggerOptions = { level: logLevel };
	const streams = [
		{ level: 'info', stream: pino.destination({ dest: options.file || '.aria/logs/test-riff.log', sync: true }) },
	];

	if (!options.silent) {
		streams.push({
			level: options.verbose ? 'debug' : 'info',
			stream: pino.destination({ dest: 1, sync: true, minLength: 0 }),
		});
	}

	return pino(loggerOptions, pino.multistream(streams as StreamEntry[]));
}
`
		);

		const result = auditLogger('test-riff', TEST_ROOT);

		expect(result.usesDestinationStreams).toBe(true);
		expect(result.usesMultistream).toBe(true);
		expect(result.hasLoggerOptionsInterface).toBe(true);
		expect(result.hasCreateLoggerSignature).toBe(true);
		expect(result.hasSilentOption).toBe(true);
		expect(result.usesPinoPrettyImport).toBe(false);
		expect(result.usesStdoutDestination).toBe(true);
		expect(result.usesSilentConsoleGate).toBe(true);
		expect(result.defaultLogPathMatchesRiff).toBe(true);
		expect(result.isStandaloneSafe).toBe(true);
	});

	it('given explanatory comments mentioning banned targets, when audited, then ignores comments', () => {
		writeLogger(
			'test-riff',
			`
import path from 'node:path';
import type { Level, Logger, LoggerOptions as PinoLoggerOptions, StreamEntry } from 'pino';
import pino from 'pino';

export interface LoggerOptions {
	level: string;
	verbose: boolean;
	silent?: boolean;
	file?: string;
}

export function createLogger(options: LoggerOptions): Logger {
	// Avoid pino.transport() and target: 'pino-pretty' here.
	const logFile = path.resolve(process.cwd(), options.file || '.aria/logs/test-riff.log');
	const logLevel = (options.verbose ? 'debug' : options.level.toLowerCase()) as Level;
	const loggerOptions: PinoLoggerOptions = { level: logLevel };
	const streams: StreamEntry[] = [
		{
			level: 'info',
			stream: pino.destination({ dest: logFile, mkdir: true, sync: true, minLength: 0 }),
		},
	];

	if (!options.silent) {
		streams.push({
			level: options.verbose ? 'debug' : 'info',
			stream: pino.destination({ dest: 1, sync: true, minLength: 0 }),
		});
	}

	return pino(loggerOptions, pino.multistream(streams));
}
`
		);

		const result = auditLogger('test-riff', TEST_ROOT);

		expect(result.usesPinoTransportCall).toBe(false);
		expect(result.usesPinoPrettyTarget).toBe(false);
		expect(result.isStandaloneSafe).toBe(true);
	});
});
