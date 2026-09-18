import fs from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock fs before importing config
vi.mock('node:fs');

describe('ImageOCR Config', () => {
	const mockConfig = {
		'image-ocr': {
			ocr: {
				language: 'eng',
				confidenceThreshold: 0.5,
				timeout: 30,
			},
			output: {
				format: 'markdown',
				includeMetadata: true,
				preserveLayout: false,
			},
			files: {
				supportedExtensions: ['.png', '.jpg', '.jpeg', '.pdf'],
				maxFileSizeMb: 100,
				outputExtension: '.txt',
			},
			processing: {
				batchSize: 5,
				progressBar: true,
				concurrentJobs: 2,
			},
		},
		logging: {
			level: 'info',
			verbose: false,
			file: '.aria/logs/test/image-ocr-config.log',
			maxFileSizeMb: 10,
			maxFiles: 7,
		},
	};

	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();
		// Clear environment variables
		delete process.env['IMAGE_OCR_LANGUAGE'];
		delete process.env['IMAGE_OCR_CONFIDENCE_THRESHOLD'];
		delete process.env['IMAGE_OCR_TIMEOUT'];
		delete process.env['IMAGE_OCR_OUTPUT_FORMAT'];
		delete process.env['IMAGE_OCR_DATABASE_DIR'];
		delete process.env['IMAGE_OCR_LOG_LEVEL'];
		delete process.env['IMAGE_OCR_LOG_VERBOSE'];
		delete process.env['IMAGE_OCR_LOG_FILE'];
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('loadConfig', () => {
		it('given YAML config file exists, when loadConfig called, then should load configuration', async () => {
			const yaml = await import('yaml');
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(yaml.stringify(mockConfig));

			const { loadConfig } = await import('../../src/lib/config.js');
			const config = loadConfig();
			const riff = config['image-ocr'];

			expect(riff.ocr.language).toBe('eng');
			expect(riff.ocr.confidenceThreshold).toBe(0.5);
			expect(riff.ocr.timeout).toBe(30);
			expect(riff.output.format).toBe('markdown');
			expect(config.logging.level).toBe('info');
		});

		it('given environment variables set, when loadConfig called, then should apply overrides', async () => {
			process.env['IMAGE_OCR_LANGUAGE'] = 'deu';
			process.env['IMAGE_OCR_CONFIDENCE_THRESHOLD'] = '0.8';
			process.env['IMAGE_OCR_DATABASE_DIR'] = '/tmp/aria-ocr-database';
			process.env['IMAGE_OCR_LOG_LEVEL'] = 'DEBUG';

			const yaml = await import('yaml');
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(yaml.stringify(mockConfig));

			vi.resetModules();
			const { loadConfig } = await import('../../src/lib/config.js');
			const config = loadConfig();
			const riff = config['image-ocr'];

			expect(riff.ocr.language).toBe('deu');
			expect(riff.ocr.confidenceThreshold).toBe(0.8);
			expect(riff.paths.database.dir).toBe('/tmp/aria-ocr-database');
			expect(config.logging.level).toBe('debug');
		});

		it('given nested config values, when loadConfig called, then should access nested values correctly', async () => {
			const yaml = await import('yaml');
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(yaml.stringify(mockConfig));

			const { loadConfig } = await import('../../src/lib/config.js');
			const config = loadConfig();
			const riff = config['image-ocr'];

			// Test nested object access
			expect(riff.ocr).toBeDefined();
			expect(typeof riff.ocr).toBe('object');

			// Test array access
			expect(Array.isArray(riff.files.supportedExtensions)).toBe(true);
			expect(riff.files.supportedExtensions).toContain('.png');
			expect(riff.files.supportedExtensions).toContain('.jpg');

			// Test deep nested values
			expect(riff.processing.batchSize).toBe(5);
		});

		it('given explicit path not found, when loadConfig called, then should throw error', async () => {
			vi.mocked(fs.existsSync).mockReturnValue(false);

			const { loadConfig } = await import('../../src/lib/config.js');
			expect(() => loadConfig('/nonexistent/path.yaml')).toThrow('Config file not found');
		});

		it('given invalid YAML, when loadConfig called, then should throw error', async () => {
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue('invalid: yaml: content: [[[');

			const { loadConfig } = await import('../../src/lib/config.js');
			expect(() => loadConfig()).toThrow();
		});

		it('given no config file at default path, when loadConfig called, then should use defaults', async () => {
			vi.mocked(fs.existsSync).mockReturnValue(false);

			const { loadConfig } = await import('../../src/lib/config.js');
			const config = loadConfig();
			const riff = config['image-ocr'];

			// Should have default values from schema
			expect(riff.ocr.language).toBe('eng');
			expect(riff.ocr.timeout).toBe(30);
			expect(config.logging.level).toBe('info');
		});
	});

	describe('tilde expansion', () => {
		it('given config with tilde paths, when loadConfig called, then tildes are expanded to home directory', async () => {
			const tildeConfig = {
				...mockConfig,
				logging: {
					...mockConfig.logging,
					file: '~/.aria/logs/image-ocr.log',
				},
			};
			const yaml = await import('yaml');
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(yaml.stringify(tildeConfig));

			const { loadConfig } = await import('../../src/lib/config.js');
			const config = loadConfig();

			const assertNoTildes = (obj: unknown, objPath = ''): void => {
				if (typeof obj === 'string' && obj.startsWith('~/')) {
					throw new Error(`Unexpanded tilde at ${objPath}: ${obj}`);
				}
				if (obj && typeof obj === 'object') {
					for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
						assertNoTildes(value, `${objPath}.${key}`);
					}
				}
			};
			assertNoTildes(config);
		});
	});
});
