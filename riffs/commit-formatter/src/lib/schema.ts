/**
 * Zod schema validation for commit formatter configuration
 */

import { z } from 'zod';

const AriaRiffMetadataSchema = z
	.object({
		name: z.literal('commit-formatter'),
		description: z.string().min(1),
		category: z.enum(['documents', 'images', 'knowledge', 'development', 'utilities']),
	})
	.strict();

// Provider settings schema (common for all providers)
const ProviderSettingsSchema = z.object({
	apiKey: z.string().default(''),
	model: z.string(),
	temperature: z.number().min(0).max(2).default(0.3),
	maxTokens: z.number().positive().default(100),
	baseUrl: z.string().url(),
	timeout: z.number().positive().default(30),
});

// LLM configuration schema
const LLMConfigSchema = z.object({
	provider: z.enum(['anthropic', 'gemini', 'openai']).default('anthropic'),
	anthropic: ProviderSettingsSchema.default({
		apiKey: '',
		model: 'claude-haiku-4-5',
		temperature: 0.3,
		maxTokens: 1000,
		baseUrl: 'https://api.anthropic.com/v1',
		timeout: 60,
	}),
	gemini: ProviderSettingsSchema.default({
		apiKey: '',
		model: 'gemini-2.5-flash',
		temperature: 0.3,
		maxTokens: 1000,
		baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
		timeout: 60,
	}),
	openai: ProviderSettingsSchema.default({
		apiKey: '',
		model: 'gpt-5-mini',
		temperature: 0.3,
		maxTokens: 1000,
		baseUrl: 'https://api.openai.com/v1',
		timeout: 60,
	}),
});

// Defaults configuration schema
const DefaultsConfigSchema = z.object({
	mode: z.enum(['automatic', 'assisted', 'advisory', 'preview']).default('assisted'),
	count: z.number().positive().default(20),
	skipConventional: z.boolean().default(true),
	createBackup: z.boolean().default(true),
	generateReport: z.boolean().default(true),
});

// Author rewrite configuration schema
const AuthorConfigSchema = z.object({
	mode: z.enum(['preserve', 'rewrite']).default('preserve'),
	name: z.string().optional(),
	email: z.string().email().optional(),
});

// Conventional commits configuration schema
const ConventionalCommitsConfigSchema = z.object({
	requiredTypes: z.array(z.string()).default(['feat', 'fix']),
	additionalTypes: z.array(z.string()).default(['build', 'chore', 'ci', 'docs', 'style', 'refactor', 'perf', 'test']),
	maxDescriptionLength: z.number().positive().default(72),
	allowBreakingChanges: z.boolean().default(true),
	scopeOptional: z.boolean().default(true),
});

// Backup configuration schema
const BackupConfigSchema = z.object({
	branchPrefix: z.string().default('backup-before-reformat'),
	pushToRemote: z.boolean().default(false),
	cleanupAfterDays: z.number().positive().default(30),
});

// Path configuration schemas
const PathOutputSchema = z.object({
	dir: z.string().default('.'),
});

const PathsSchema = z.object({
	output: PathOutputSchema.default(PathOutputSchema.parse({})),
});

// Reports configuration schema
const ReportsConfigSchema = z.object({
	jsonFilenameTemplate: z.string().default('commit-reformat-report-{date}.json'),
	markdownFilenameTemplate: z.string().default('commit-reformat-report-{date}.md'),
	includeDiffSummary: z.boolean().default(false),
});

// Logging configuration schema
export const LoggingConfigSchema = z.object({
	level: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
	verbose: z.boolean().default(false),
	file: z.string().default('.aria/logs/commit-formatter.log'),
	maxFileSizeMb: z.number().positive().default(10),
	maxFiles: z.number().positive().default(7),
});

// Riff configuration schema (under commit-formatter:)
export const CommitFormatterRiffSchema = z.object({
	paths: PathsSchema.default(PathsSchema.parse({})),
	llm: LLMConfigSchema.default(LLMConfigSchema.parse({})),
	defaults: DefaultsConfigSchema.default(DefaultsConfigSchema.parse({})),
	author: AuthorConfigSchema.default(AuthorConfigSchema.parse({})),
	conventionalCommits: ConventionalCommitsConfigSchema.default(ConventionalCommitsConfigSchema.parse({})),
	backup: BackupConfigSchema.default(BackupConfigSchema.parse({})),
	reports: ReportsConfigSchema.default(ReportsConfigSchema.parse({})),
});

// Root configuration schema
export const CommitFormatterConfigSchema = z
	.object({
		'aria-riff': AriaRiffMetadataSchema.optional(),
		'commit-formatter': CommitFormatterRiffSchema.default(CommitFormatterRiffSchema.parse({})),
		logging: LoggingConfigSchema.default(LoggingConfigSchema.parse({})),
	})
	.strict();

// Export type inferred from schema
export type CommitFormatterConfig = z.infer<typeof CommitFormatterConfigSchema>;
export type CommitFormatterRiffConfig = z.infer<typeof CommitFormatterRiffSchema>;
export type LoggingConfig = z.infer<typeof LoggingConfigSchema>;

/**
 * Validate and parse config object
 */
export function validateConfig(config: unknown): CommitFormatterConfig {
	return CommitFormatterConfigSchema.parse(config);
}

/**
 * Validate config with detailed error reporting
 */
export function validateConfigSafe(
	config: unknown
): { success: true; data: CommitFormatterConfig } | { success: false; error: z.ZodError } {
	const result = CommitFormatterConfigSchema.safeParse(config);
	return result;
}
