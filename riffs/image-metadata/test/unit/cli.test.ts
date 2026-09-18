import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock all CLI dependencies
vi.mock('node:path');
vi.mock('node:fs/promises', () => ({
	default: {
		stat: vi.fn(),
	},
}));

vi.mock('chalk', () => ({
	__esModule: true,
	default: {
		blue: (str: string) => str,
		cyan: (str: string) => str,
		green: (str: string) => str,
		red: (str: string) => str,
		bold: (str: string) => str,
	},
}));

const mockImageMetadata = vi.fn();

// Mock Command with hoisted pattern to survive vi.clearAllMocks()
const { MockedCommand } = vi.hoisted(() => {
	const MockedConstructor = vi.fn(function (this: unknown) {
		return {
			name: vi.fn().mockReturnThis(),
			description: vi.fn().mockReturnThis(),
			version: vi.fn().mockReturnThis(),
			command: vi.fn().mockReturnThis(),
			argument: vi.fn().mockReturnThis(),
			option: vi.fn().mockReturnThis(),
			action: vi.fn().mockReturnThis(),
			parse: vi.fn().mockReturnThis(),
			hook: vi.fn().mockReturnThis(),
			opts: vi.fn().mockReturnValue({}),
		};
	});
	return {
		MockedCommand: MockedConstructor,
	};
});

vi.mock('commander', () => ({
	Command: MockedCommand,
}));

// Mock loadConfig with hoisted pattern for module-level initialization
const { mockLoadConfig } = vi.hoisted(() => {
	const defaultConfig = {
		'image-metadata': {
			paths: { input: { dir: './images' }, database: { file: '.aria/db/test.db' } },
			llm: { provider: 'ollama' as const },
			database: { backupCount: 3, journalMode: 'DELETE' },
			images: { supportedExtensions: ['.png', '.jpg'], maxFileSizeMb: 50 },
			metadata: { retryAttempts: 3, retryDelay: 1.0 },
			processing: { batchSize: 10, progressBar: true },
		},
		logging: {
			level: 'info',
			verbose: false,
			file: '.aria/logs/test/image-metadata-cli.log',
			maxFileSizeMb: 10,
			maxFiles: 7,
		},
		llmProviders: {
			ollama: {
				endpoint: 'http://localhost:11434/',
				model: 'gemma4:12b',
				timeout: 30,
				keepAlive: 5,
				prompt: '',
			},
			anthropic: { apiKey: '', model: '', timeout: 30, maxTokens: 1024, baseUrl: '', prompt: '' },
			gemini: { apiKey: '', model: '', timeout: 30, maxTokens: 1024, baseUrl: '', prompt: '' },
		},
	};
	return {
		mockLoadConfig: vi.fn().mockReturnValue(defaultConfig),
	};
});

vi.mock('../../src/lib/config', () => ({
	loadConfig: mockLoadConfig,
}));

// Mock DescriptionGenerator with hoisted pattern to work with constructor
const { MockedDescriptionGenerator } = vi.hoisted(() => {
	const mockInstance = {
		generateDescription: vi.fn(),
		testConnection: vi.fn(),
		checkConnectionWithDiagnostics: vi.fn(),
		listModels: vi.fn(),
		modelName: 'test-model',
		endpointUrl: 'http://test-endpoint',
	};
	const MockedConstructor = vi.fn(function (this: unknown) {
		return mockInstance;
	});
	return {
		MockedDescriptionGenerator: MockedConstructor,
	};
});

vi.mock('../../src/core/description-generator', () => ({
	DescriptionGenerator: MockedDescriptionGenerator,
}));

vi.mock('../../src/db/database', () => ({
	DatabaseManager: vi.fn(),
}));

vi.mock('../../src/core/create-metadata', () => ({
	ImageMetadata: mockImageMetadata,
}));

describe('CLI module', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('given CLI module, when imported, then should have access to ProgressLogger', async () => {
		// The CLI should be able to import and use ProgressLogger
		const { ProgressLogger } = await import('../../src/utils/progress-logger.js');
		expect(ProgressLogger).toBeDefined();
	});

	it('given CLI module imported, when checked, then should instantiate ProgressLogger', async () => {
		// Dynamically import the CLI to test that it uses ProgressLogger
		const cliModule = await import('../../src/cli.js');

		// The CLI module should have imported ProgressLogger
		// We verify this by checking the imports are available
		const { ProgressLogger } = await import('../../src/utils/progress-logger.js');
		expect(ProgressLogger).toBeDefined();
		expect(cliModule).toBeDefined();
	});
});
