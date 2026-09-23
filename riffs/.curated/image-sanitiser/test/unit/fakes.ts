/**
 * Test helper utilities for image-sanitiser tests
 */

import type { Logger } from 'pino';
import { vi } from 'vitest';
import type { ImageSanitiserConfig, ImageSanitiserRiffConfig, LoggingConfig } from '../../src/lib/schema.js';

/**
 * Create a mock Pino logger for testing
 */
export function createMockLogger(): Logger {
	return {
		info: vi.fn(),
		debug: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		fatal: vi.fn(),
		trace: vi.fn(),
		silent: vi.fn(),
		level: 'info',
		child: vi.fn(),
	} as unknown as Logger;
}

/**
 * Create a test configuration with defaults that match Zod schema defaults
 */
type DeepPartial<T> = T extends (infer U)[]
	? U[]
	: T extends object
		? {
				[K in keyof T]?: DeepPartial<T[K]>;
			}
		: T;

type TestConfigOverrides = {
	'image-sanitiser'?: DeepPartial<ImageSanitiserRiffConfig>;
	logging?: DeepPartial<LoggingConfig>;
};

export function createTestConfig(overrides: TestConfigOverrides = {}): ImageSanitiserConfig {
	return {
		'image-sanitiser': {
			paths: {
				input: {
					dir: null,
					...overrides['image-sanitiser']?.paths?.input,
				},
				database: {
					file: '.aria/db/image-sanitiser/image-sanitiser.sqlite',
					...overrides['image-sanitiser']?.paths?.database,
				},
			},
			images: {
				supportedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.tif', '.webp'],
				maxFileSizeMb: 100,
				verifyAfterRename: true,
				...overrides['image-sanitiser']?.images,
			},
			fileOperations: {
				safeMoveRetries: 3,
				moveDelaySeconds: 0.5,
				backupOriginals: false,
				confirmOverwrites: true,
				...overrides['image-sanitiser']?.fileOperations,
			},
			detection: {
				useSharpMetadata: true,
				preferSharpOverMagic: false,
				fallbackToMagicBytes: true,
				strictMode: false,
				...overrides['image-sanitiser']?.detection,
			},
			processing: {
				progressBar: true,
				batchSize: 50,
				concurrentOperations: false,
				dryRun: false,
				recursive: true,
				...overrides['image-sanitiser']?.processing,
			},
			database: {
				tableName: 'images',
				journalMode: 'DELETE',
				...overrides['image-sanitiser']?.database,
			},
		},
		logging: {
			level: 'info',
			verbose: false,
			file: '.aria/logs/test/image-sanitiser-test.log',
			maxFileSizeMb: 10,
			maxFiles: 7,
			...overrides.logging,
		},
	};
}
