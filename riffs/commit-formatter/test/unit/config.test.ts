import fs from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock fs before importing config
vi.mock('node:fs');

describe('config', () => {
	const mockConfig = {
		'commit-formatter': {
			llm: {
				provider: 'anthropic',
				anthropic: {
					apiKey: 'test-key',
					model: 'claude-haiku-4-5',
					temperature: 0.3,
					maxTokens: 1000,
					baseUrl: 'https://api.anthropic.com/v1',
					timeout: 60,
				},
				gemini: {
					apiKey: '',
					model: 'gemini-2.5-flash',
					temperature: 0.3,
					maxTokens: 1000,
					baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
					timeout: 60,
				},
				openai: {
					apiKey: '',
					model: 'gpt-5-mini',
					temperature: 0.3,
					maxTokens: 1000,
					baseUrl: 'https://api.openai.com/v1',
					timeout: 60,
				},
			},
			defaults: {
				mode: 'assisted',
				count: 20,
				skipConventional: true,
				createBackup: true,
				generateReport: true,
			},
			author: {
				mode: 'preserve',
			},
			conventionalCommits: {
				requiredTypes: ['feat', 'fix'],
				additionalTypes: ['build', 'chore', 'ci', 'docs', 'style', 'refactor', 'perf', 'test'],
				maxDescriptionLength: 72,
				allowBreakingChanges: true,
				scopeOptional: true,
			},
			backup: {
				branchPrefix: 'backup-before-reformat',
				pushToRemote: false,
				cleanupAfterDays: 30,
			},
			paths: {
				output: {
					dir: '.',
				},
			},
			reports: {
				jsonFilenameTemplate: 'commit-reformat-report-{date}.json',
				markdownFilenameTemplate: 'commit-reformat-report-{date}.md',
				includeDiffSummary: false,
			},
		},
		logging: {
			level: 'info',
			verbose: false,
			file: '.aria/logs/commit-formatter.log',
			maxFileSizeMb: 10,
			maxFiles: 7,
		},
	};

	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();
		delete process.env.COMMIT_FORMATTER_LLM_PROVIDER;
		process.env.ANTHROPIC_API_KEY = '';
		delete process.env.COMMIT_FORMATTER_ANTHROPIC_MODEL;
		process.env.GOOGLE_API_KEY = '';
		delete process.env.COMMIT_FORMATTER_GOOGLE_MODEL;
		process.env.OPENAI_API_KEY = '';
		delete process.env.COMMIT_FORMATTER_OPENAI_MODEL;
		delete process.env.COMMIT_FORMATTER_LOG_LEVEL;
		delete process.env.COMMIT_FORMATTER_LOG_VERBOSE;
		delete process.env.COMMIT_FORMATTER_LOG_FILE;
		delete process.env.COMMIT_FORMATTER_LOG_MAX_FILE_SIZE_MB;
		delete process.env.COMMIT_FORMATTER_LOG_MAX_FILES;
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('loadConfig', () => {
		it('loads and parses config from YAML file', async () => {
			const yaml = await import('js-yaml');
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(yaml.dump(mockConfig));

			const { loadConfig } = await import('../../src/lib/config.js');
			const config = loadConfig();

			expect(config['commit-formatter'].llm.provider).toBe('anthropic');
			expect(config['commit-formatter'].llm.anthropic.model).toBe('claude-haiku-4-5');
		});

		it('returns complete config object with all sections', async () => {
			const yaml = await import('js-yaml');
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(yaml.dump(mockConfig));

			const { loadConfig } = await import('../../src/lib/config.js');
			const config = loadConfig();

			expect(config).toHaveProperty('logging');
			expect(config).toHaveProperty('commit-formatter');
		});

		it('provides nested config values', async () => {
			const yaml = await import('js-yaml');
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(yaml.dump(mockConfig));

			const { loadConfig } = await import('../../src/lib/config.js');
			const config = loadConfig();

			expect(config['commit-formatter'].llm.anthropic.maxTokens).toBe(1000);
			expect(config['commit-formatter'].defaults.count).toBe(20);
		});
	});

	describe('Environment variable overrides', () => {
		it('overrides provider from COMMIT_FORMATTER_LLM_PROVIDER env var', async () => {
			process.env.COMMIT_FORMATTER_LLM_PROVIDER = 'gemini';
			const yaml = await import('js-yaml');
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(yaml.dump(mockConfig));

			const { loadConfig } = await import('../../src/lib/config.js');
			const config = loadConfig();

			expect(config['commit-formatter'].llm.provider).toBe('gemini');
		});

		it('overrides Anthropic API key from env var', async () => {
			process.env.ANTHROPIC_API_KEY = 'env-api-key';
			const yaml = await import('js-yaml');
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(yaml.dump(mockConfig));

			const { loadConfig } = await import('../../src/lib/config.js');
			const config = loadConfig();

			expect(config['commit-formatter'].llm.anthropic.apiKey).toBe('env-api-key');
		});

		it('overrides log level from COMMIT_FORMATTER_LOG_LEVEL env var', async () => {
			process.env.COMMIT_FORMATTER_LOG_LEVEL = 'DEBUG';
			const yaml = await import('js-yaml');
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(yaml.dump(mockConfig));

			const { loadConfig } = await import('../../src/lib/config.js');
			const config = loadConfig();

			expect(config.logging.level).toBe('debug');
		});

		it('enables verbose from COMMIT_FORMATTER_LOG_VERBOSE env var', async () => {
			process.env.COMMIT_FORMATTER_LOG_VERBOSE = 'true';
			const yaml = await import('js-yaml');
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(yaml.dump(mockConfig));

			const { loadConfig } = await import('../../src/lib/config.js');
			const config = loadConfig();

			expect(config.logging.verbose).toBe(true);
		});

		it('does not enable verbose from COMMIT_FORMATTER_LOG_VERBOSE=1', async () => {
			process.env.COMMIT_FORMATTER_LOG_VERBOSE = '1';
			const yaml = await import('js-yaml');
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(yaml.dump(mockConfig));

			const { loadConfig } = await import('../../src/lib/config.js');
			const config = loadConfig();

			expect(config.logging.verbose).toBe(false);
		});

		it('overrides Anthropic model from COMMIT_FORMATTER_ANTHROPIC_MODEL env var', async () => {
			process.env.COMMIT_FORMATTER_ANTHROPIC_MODEL = 'claude-sonnet-4';
			const yaml = await import('js-yaml');
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(yaml.dump(mockConfig));

			const { loadConfig } = await import('../../src/lib/config.js');
			const config = loadConfig();

			expect(config['commit-formatter'].llm.anthropic.model).toBe('claude-sonnet-4');
		});

		it('overrides Gemini API key from GOOGLE_API_KEY env var', async () => {
			process.env.GOOGLE_API_KEY = 'gemini-env-key';
			const yaml = await import('js-yaml');
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(yaml.dump(mockConfig));

			const { loadConfig } = await import('../../src/lib/config.js');
			const config = loadConfig();

			expect(config['commit-formatter'].llm.gemini.apiKey).toBe('gemini-env-key');
		});

		it('overrides Gemini model from COMMIT_FORMATTER_GOOGLE_MODEL env var', async () => {
			process.env.COMMIT_FORMATTER_GOOGLE_MODEL = 'gemini-pro';
			const yaml = await import('js-yaml');
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(yaml.dump(mockConfig));

			const { loadConfig } = await import('../../src/lib/config.js');
			const config = loadConfig();

			expect(config['commit-formatter'].llm.gemini.model).toBe('gemini-pro');
		});

		it('overrides OpenAI model from COMMIT_FORMATTER_OPENAI_MODEL env var', async () => {
			process.env.COMMIT_FORMATTER_OPENAI_MODEL = 'gpt-5';
			const yaml = await import('js-yaml');
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(yaml.dump(mockConfig));

			const { loadConfig } = await import('../../src/lib/config.js');
			const config = loadConfig();

			expect(config['commit-formatter'].llm.openai.model).toBe('gpt-5');
		});
	});

	describe('Error handling', () => {
		it('throws ConfigError when explicit path not found', async () => {
			vi.mocked(fs.existsSync).mockReturnValue(false);

			const { loadConfig } = await import('../../src/lib/config.js');
			expect(() => loadConfig('/nonexistent/path.yaml')).toThrow('Config file not found');
		});

		it('throws ConfigError for invalid YAML', async () => {
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue('invalid: yaml: content: [[[');

			const { loadConfig } = await import('../../src/lib/config.js');
			expect(() => loadConfig()).toThrow();
		});

		it('formats Zod validation errors with path and message', async () => {
			const invalidConfig = { ...mockConfig };
			invalidConfig['commit-formatter'].llm.anthropic.temperature = 5.0; // Invalid: too high

			const yaml = await import('js-yaml');
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(yaml.dump(invalidConfig));

			const { loadConfig } = await import('../../src/lib/config.js');
			expect(() => loadConfig()).toThrow('Config validation failed');
			try {
				loadConfig();
			} catch (e) {
				expect(String(e)).toContain('commit-formatter.llm.anthropic.temperature');
			}
		});

		it('throws generic ConfigError for non-Zod errors', async () => {
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockImplementation(() => {
				throw new Error('Generic error');
			});

			const { loadConfig } = await import('../../src/lib/config.js');
			expect(() => loadConfig()).toThrow('Failed to load configuration');
		});
	});

	describe('tilde expansion', () => {
		it('given config with tilde paths, when loadConfig called, then tildes are expanded to home directory', async () => {
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(`
commit-formatter:
  paths:
    output:
      dir: '~/.aria/output'
logging:
  file: '~/.aria/logs/commit-formatter.log'
`);

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
