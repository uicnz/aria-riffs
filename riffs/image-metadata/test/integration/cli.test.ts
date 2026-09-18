/// <reference types="vitest" />
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Command from commander
vi.mock('commander', () => ({
	Command: class {
		name(_n: string) {
			return this;
		}
		description(_d: string) {
			return this;
		}
		version(_v: string) {
			return this;
		}
		command(_c: string) {
			return this;
		}
		argument(_a: string, _d: string) {
			return this;
		}
		option(..._args: any[]) {
			return this;
		}
		action(_fn: () => void) {
			return this;
		}
		parse() {
			return this;
		}
		hook(_event: string, _fn: () => void) {
			return this;
		}
		opts() {
			return {};
		}
	},
}));

// Mock DescriptionGenerator
vi.mock('../../src/core/description-generator', () => ({
	DescriptionGenerator: class {
		modelName = 'test-model';
		endpointUrl = 'http://localhost:11434';
		async testConnection() {
			return true;
		}
		async generateDescription() {
			return 'Test description';
		}
	},
}));

// Mock ImageMetadata
vi.mock('../../src/core/create-metadata', () => ({
	ImageMetadata: class {
		async processSingleFile() {
			return { total_files: 1, processed: 1, failed: 0, renamed: 0, processing_time: 0.1, errors: [] };
		}
		async processDirectory() {
			return { total_files: 0, processed: 0, failed: 0, renamed: 0, processing_time: 0.1, errors: [] };
		}
	},
}));

// Mock DatabaseManager
vi.mock('../../src/db/database', () => ({
	DatabaseManager: class {
		databasePath = '/test/db.sqlite';
		async close() {}
		async countRecords() {
			return 0;
		}
		async getAllDescriptions() {
			return [];
		}
	},
}));

// Mock loadConfig with hoisted pattern for module-level initialization
const { mockLoadConfig } = vi.hoisted(() => {
	const defaultConfig = {
		'image-metadata': {
			paths: { input: { dir: './images' }, database: { file: '.aria/db/test.db' } },
			llm: { provider: 'ollama' as const },
			database: { backupCount: 3, journalMode: 'DELETE' },
			images: {
				supportedExtensions: ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'],
				maxFileSizeMb: 50,
			},
			metadata: { retryAttempts: 3, retryDelay: 1.0 },
			processing: { batchSize: 10, progressBar: true },
		},
		logging: {
			level: 'info',
			verbose: false,
			file: '.aria/logs/test/image-metadata-cli-integration.log',
			maxFileSizeMb: 10,
			maxFiles: 7,
		},
		llmProviders: {
			ollama: {
				endpoint: 'http://localhost:11434/',
				model: 'llava-llama3',
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

// Mock chalk
vi.mock('chalk', () => ({
	__esModule: true,
	default: {
		blue: (str: string) => str,
		cyan: (str: string) => str,
		green: (str: string) => str,
		red: (str: string) => str,
		yellow: (str: string) => str,
		bold: (str: string) => str,
	},
}));

describe('CLI end-to-end', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('given CLI module, when imported, then should load without errors', async () => {
		// This test verifies the CLI module can be imported without errors
		const cliModule = await import('../../src/cli.js');
		expect(cliModule).toBeDefined();
	});
});
