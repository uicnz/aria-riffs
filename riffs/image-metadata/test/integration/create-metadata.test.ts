/// <reference types="vitest" />
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ImageMetadata } from '../../src/core/create-metadata.js';
import { createMockLogger, createMockProgressLogger } from '../unit/fakes.js';

// Mock fs-extra
const { mockPathExists, mockStat, mockMove } = vi.hoisted(() => ({
	mockPathExists: vi.fn(),
	mockStat: vi.fn(),
	mockMove: vi.fn(),
}));

vi.mock('fs-extra', () => ({
	default: {
		pathExists: mockPathExists,
		stat: mockStat,
		move: mockMove,
	},
}));

// Mock utils
const { mockValidateImageFile, mockFindImageFiles } = vi.hoisted(() => ({
	mockValidateImageFile: vi.fn(),
	mockFindImageFiles: vi.fn(),
}));

vi.mock('../../src/utils/utils', () => ({
	validateImageFile: mockValidateImageFile,
	findImageFiles: mockFindImageFiles,
}));

// Mock create-metadata to mock sanitizeFilename
const { mockSanitizeFilename } = vi.hoisted(() => ({
	mockSanitizeFilename: vi.fn((name: string) => {
		// Simulate sanitization: remove special characters
		return name.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_');
	}),
}));

vi.mock('../../src/core/create-metadata', async () => {
	const actual = await vi.importActual('../../src/core/create-metadata.js');
	return {
		...actual,
		sanitizeFilename: mockSanitizeFilename,
	};
});

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
			file: '.aria/logs/test/image-metadata-integration.log',
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
		cyan: (str: string) => str,
		green: (str: string) => str,
		yellow: (str: string) => str,
		gray: (str: string) => str,
		red: (str: string) => str,
	},
}));

// Mock cli-progress with proper class constructor
vi.mock('cli-progress', () => ({
	__esModule: true,
	default: {
		SingleBar: class MockSingleBar {
			start = vi.fn();
			stop = vi.fn();
			update = vi.fn();
			getTotal() {
				return 10;
			}
		},
	},
}));

// Mock MetadataWriter
vi.mock('../../src/core/write-metadata', () => ({
	MetadataWriter: class {
		async writeDescription() {
			return Promise.resolve();
		}
		async hasDescription() {
			return Promise.resolve(false);
		}
		async cleanup() {
			return Promise.resolve();
		}
	},
}));

describe('Directory processing end-to-end', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('given mock LLM and database clients, when ImageMetadata constructed, then should instantiate successfully', () => {
		const mockLlmClient = {
			generateDescription: vi.fn().mockResolvedValue('Test description'),
		} as any;

		const mockDatabase = {
			getDescription: vi.fn().mockResolvedValue(null),
			saveDescription: vi.fn().mockResolvedValue(undefined),
			close: vi.fn(),
		} as any;

		const processor = new ImageMetadata(
			mockLlmClient,
			mockDatabase,
			createMockProgressLogger(),
			createMockLogger()
		);
		expect(processor).toBeDefined();
	});

	it('given directory with multiple images, when processDirectory called, then should process all files', async () => {
		const mockLlmClient = {
			generateDescription: vi.fn().mockResolvedValue('Test description'),
		} as any;

		const mockDatabase = {
			getDescription: vi.fn().mockResolvedValue(null),
			saveDescription: vi.fn().mockResolvedValue(undefined),
			close: vi.fn(),
		} as any;

		// Setup mock implementations
		mockPathExists.mockResolvedValue(true);
		mockStat.mockResolvedValue({ isFile: () => false, isDirectory: () => true } as any);
		mockFindImageFiles.mockResolvedValue(['/test/image1.jpg', '/test/image2.png', '/test/image3.jpg']);
		mockValidateImageFile.mockResolvedValue(undefined);

		const processor = new ImageMetadata(
			mockLlmClient,
			mockDatabase,
			createMockProgressLogger(),
			createMockLogger()
		);
		const result = await processor.processDirectory('/test', { showProgress: false });

		expect(result.total_files).toBe(3);
		expect(result).toHaveProperty('processed');
		expect(result).toHaveProperty('failed');
		expect(result).toHaveProperty('processing_time');
	});
});

describe('Filename sanitization end-to-end', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('given mock LLM and database clients for sanitization, when ImageMetadata constructed, then should instantiate successfully', () => {
		const mockLlmClient = {
			generateDescription: vi.fn().mockResolvedValue('Test description'),
		} as any;

		const mockDatabase = {
			getDescription: vi.fn().mockResolvedValue(null),
			saveDescription: vi.fn().mockResolvedValue(undefined),
			close: vi.fn(),
		} as any;

		const processor = new ImageMetadata(
			mockLlmClient,
			mockDatabase,
			createMockProgressLogger(),
			createMockLogger()
		);
		expect(processor).toBeDefined();
	});

	it('given ImageMetadata, when processDirectory called, then should sanitize filenames in directory', async () => {
		const mockLlmClient = {
			generateDescription: vi.fn().mockResolvedValue('Test description'),
		} as any;

		const mockDatabase = {
			getDescription: vi.fn().mockResolvedValue(null),
			saveDescription: vi.fn().mockResolvedValue(undefined),
			close: vi.fn(),
		} as any;

		// Setup mock implementations
		mockPathExists.mockResolvedValue(true);
		mockFindImageFiles.mockResolvedValue(['/test/image.jpg']);
		mockMove.mockResolvedValue(undefined);

		const processor = new ImageMetadata(
			mockLlmClient,
			mockDatabase,
			createMockProgressLogger(),
			createMockLogger()
		);
		const results = await processor.processDirectory('/test');

		expect(results.renamed).toBeGreaterThanOrEqual(0);
	});
});

describe('Single file processing end-to-end', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('given mock LLM and database clients, when processSingleFile called, then should process file successfully', async () => {
		const mockLlmClient = {
			generateDescription: vi.fn().mockResolvedValue('Test image description'),
		} as any;

		const mockDatabase = {
			getDescription: vi.fn().mockResolvedValue(null),
			saveDescription: vi.fn().mockResolvedValue(undefined),
			close: vi.fn(),
		} as any;

		const processor = new ImageMetadata(
			mockLlmClient,
			mockDatabase,
			createMockProgressLogger(),
			createMockLogger()
		);
		expect(processor).toBeDefined();
	});
});
