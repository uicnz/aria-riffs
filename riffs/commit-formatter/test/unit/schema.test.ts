import { describe, expect, it } from 'vitest';
import { validateConfig, validateConfigSafe } from '../../src/lib/schema.js';

describe('schema', () => {
	const validConfig = {
		'commit-formatter': {
			llm: {
				provider: 'anthropic',
				anthropic: {
					apiKey: '',
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
			file: '.aria/logs/test/commit-formatter.log',
			maxFileSizeMb: 10,
			maxFiles: 7,
		},
	};

	describe('validateConfig', () => {
		it('validates correct config', () => {
			expect(() => validateConfig(validConfig)).not.toThrow();
			const result = validateConfig(validConfig);
			expect(result).toBeDefined();
		});

		it('accepts anthropic as provider', () => {
			const result = validateConfig(validConfig);
			expect(result['commit-formatter'].llm.provider).toBe('anthropic');
		});

		it('accepts gemini as provider', () => {
			const config = {
				...validConfig,
				'commit-formatter': {
					...validConfig['commit-formatter'],
					llm: { ...validConfig['commit-formatter'].llm, provider: 'gemini' },
				},
			};
			const result = validateConfig(config);
			expect(result['commit-formatter'].llm.provider).toBe('gemini');
		});

		it('accepts openai as provider', () => {
			const config = {
				...validConfig,
				'commit-formatter': {
					...validConfig['commit-formatter'],
					llm: { ...validConfig['commit-formatter'].llm, provider: 'openai' },
				},
			};
			const result = validateConfig(config);
			expect(result['commit-formatter'].llm.provider).toBe('openai');
		});

		it('rejects invalid provider', () => {
			const config = {
				...validConfig,
				'commit-formatter': {
					...validConfig['commit-formatter'],
					llm: { ...validConfig['commit-formatter'].llm, provider: 'invalid' },
				},
			};
			expect(() => validateConfig(config)).toThrow();
		});

		it('validates temperature range 0-2', () => {
			const config1 = JSON.parse(JSON.stringify(validConfig));
			config1['commit-formatter'].llm.anthropic.temperature = 0;
			expect(() => validateConfig(config1)).not.toThrow();

			const config2 = JSON.parse(JSON.stringify(validConfig));
			config2['commit-formatter'].llm.anthropic.temperature = 2;
			expect(() => validateConfig(config2)).not.toThrow();

			const config3 = JSON.parse(JSON.stringify(validConfig));
			config3['commit-formatter'].llm.anthropic.temperature = -0.1;
			expect(() => validateConfig(config3)).toThrow();

			const config4 = JSON.parse(JSON.stringify(validConfig));
			config4['commit-formatter'].llm.anthropic.temperature = 2.1;
			expect(() => validateConfig(config4)).toThrow();
		});

		it('requires positive maxTokens', () => {
			const config1 = JSON.parse(JSON.stringify(validConfig));
			config1['commit-formatter'].llm.anthropic.maxTokens = 0;
			expect(() => validateConfig(config1)).toThrow();

			const config2 = JSON.parse(JSON.stringify(validConfig));
			config2['commit-formatter'].llm.anthropic.maxTokens = -1;
			expect(() => validateConfig(config2)).toThrow();

			const config3 = JSON.parse(JSON.stringify(validConfig));
			config3['commit-formatter'].llm.anthropic.maxTokens = 1;
			expect(() => validateConfig(config3)).not.toThrow();
		});

		it('requires valid URL for baseUrl', () => {
			const config1 = JSON.parse(JSON.stringify(validConfig));
			config1['commit-formatter'].llm.anthropic.baseUrl = 'not-a-url';
			expect(() => validateConfig(config1)).toThrow();

			const config2 = JSON.parse(JSON.stringify(validConfig));
			config2['commit-formatter'].llm.anthropic.baseUrl = 'https://valid.url.com';
			expect(() => validateConfig(config2)).not.toThrow();
		});

		it('accepts all valid mode values', () => {
			const modes = ['automatic', 'assisted', 'advisory', 'preview'];
			for (const mode of modes) {
				const config = {
					...validConfig,
					'commit-formatter': {
						...validConfig['commit-formatter'],
						defaults: { ...validConfig['commit-formatter'].defaults, mode: mode as any },
					},
				};
				expect(() => validateConfig(config)).not.toThrow();
			}
		});

		it('rejects invalid mode', () => {
			const config = {
				...validConfig,
				'commit-formatter': {
					...validConfig['commit-formatter'],
					defaults: { ...validConfig['commit-formatter'].defaults, mode: 'invalid' as any },
				},
			};
			expect(() => validateConfig(config)).toThrow();
		});

		it('requires positive count', () => {
			const config1 = JSON.parse(JSON.stringify(validConfig));
			config1['commit-formatter'].defaults.count = 0;
			expect(() => validateConfig(config1)).toThrow();

			const config2 = JSON.parse(JSON.stringify(validConfig));
			config2['commit-formatter'].defaults.count = -1;
			expect(() => validateConfig(config2)).toThrow();

			const config3 = JSON.parse(JSON.stringify(validConfig));
			config3['commit-formatter'].defaults.count = 1;
			expect(() => validateConfig(config3)).not.toThrow();
		});

		it('accepts preserve and rewrite author modes', () => {
			const config1 = {
				...validConfig,
				'commit-formatter': { ...validConfig['commit-formatter'], author: { mode: 'preserve' as const } },
			};
			expect(() => validateConfig(config1)).not.toThrow();

			const config2 = {
				...validConfig,
				'commit-formatter': {
					...validConfig['commit-formatter'],
					author: { mode: 'rewrite' as const, name: 'Test', email: 'test@example.com' },
				},
			};
			expect(() => validateConfig(config2)).not.toThrow();
		});

		it('validates email format when provided', () => {
			const config1 = JSON.parse(JSON.stringify(validConfig));
			config1['commit-formatter'].author = { mode: 'rewrite' as const, name: 'Test', email: 'invalid-email' };
			expect(() => validateConfig(config1)).toThrow();

			const config2 = JSON.parse(JSON.stringify(validConfig));
			config2['commit-formatter'].author = {
				mode: 'rewrite' as const,
				name: 'Test',
				email: 'valid@example.com',
			};
			expect(() => validateConfig(config2)).not.toThrow();
		});

		it('accepts all valid log levels', () => {
			const levels = ['debug', 'info', 'warn', 'error'];
			for (const level of levels) {
				const config = { ...validConfig, logging: { ...validConfig.logging, level: level as any } };
				expect(() => validateConfig(config)).not.toThrow();
			}
		});

		it('requires positive maxFileSizeMb', () => {
			const config1 = JSON.parse(JSON.stringify(validConfig));
			config1.logging.maxFileSizeMb = 0;
			expect(() => validateConfig(config1)).toThrow();

			const config2 = JSON.parse(JSON.stringify(validConfig));
			config2.logging.maxFileSizeMb = 10;
			expect(() => validateConfig(config2)).not.toThrow();
		});

		it('requires positive maxFiles', () => {
			const config1 = JSON.parse(JSON.stringify(validConfig));
			config1.logging.maxFiles = 0;
			expect(() => validateConfig(config1)).toThrow();

			const config2 = JSON.parse(JSON.stringify(validConfig));
			config2.logging.maxFiles = 7;
			expect(() => validateConfig(config2)).not.toThrow();
		});
	});

	describe('validateConfigSafe', () => {
		it('returns success for valid config', () => {
			const result = validateConfigSafe(validConfig);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data).toBeDefined();
			}
		});

		it('returns error for invalid config', () => {
			const invalidConfig = {
				...validConfig,
				'commit-formatter': {
					...validConfig['commit-formatter'],
					llm: { ...validConfig['commit-formatter'].llm, provider: 'invalid' },
				},
			};
			const result = validateConfigSafe(invalidConfig);
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toBeDefined();
				expect(result.error.issues.length).toBeGreaterThan(0);
			}
		});

		it('provides error details for invalid config', () => {
			const invalidConfig = JSON.parse(JSON.stringify(validConfig));
			invalidConfig['commit-formatter'].llm.anthropic.temperature = 3;
			const result = validateConfigSafe(invalidConfig);
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.issues[0].path).toContain('temperature');
			}
		});
	});
});
