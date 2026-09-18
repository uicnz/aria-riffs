/**
 * Zod schema definitions for riff-auditor configuration
 * Single source of truth for config structure and defaults
 */

import { z } from 'zod';

const AriaRiffMetadataSchema = z
	.object({
		name: z.literal('riff-auditor'),
		description: z.string().min(1),
		category: z.enum(['documents', 'images', 'knowledge', 'development', 'utilities']),
	})
	.strict();

// =============================================================================
// PATHS SCHEMA (nested structure)
// =============================================================================

const PathInputSchema = z.object({
	riffs: z.string().default('riffs'),
	package: z.string().default('package.json'),
});

const PathOutputSchema = z.object({
	dir: z.string().default('.aria/audits'),
	filename: z.string().default('riff-auditor.json'),
});

const PathsSchema = z.object({
	input: PathInputSchema.default(PathInputSchema.parse({})),
	output: PathOutputSchema.default(PathOutputSchema.parse({})),
});

// =============================================================================
// AUDITS ENABLE/DISABLE SCHEMA
// =============================================================================

const AuditsSchema = z.object({
	config: z.boolean().default(true),
	schema: z.boolean().default(true),
	cli: z.boolean().default(true),
	env: z.boolean().default(true),
	logger: z.boolean().default(true),
	source: z.boolean().default(true),
	structure: z.boolean().default(true),
	tui: z.boolean().default(true),
	scripts: z.boolean().default(true),
	tsconfig: z.boolean().default(true),
	validation: z.boolean().default(true),
	paths: z.boolean().default(true),
	configTest: z.boolean().default(true),
	configLoader: z.boolean().default(true),
	dependencies: z.boolean().default(true),
});

// =============================================================================
// RULES SCHEMA
// =============================================================================

const RulesSchema = z.object({
	// Directory requirements
	requireTestUnit: z.boolean().default(true),
	requireTestIntegration: z.boolean().default(true),
	requireTui: z.boolean().default(false),
	requireCore: z.boolean().default(true),
	requireLib: z.boolean().default(true),
	// Placeholder handling
	allowGitkeepPlaceholders: z.boolean().default(true),
	// Script requirements
	requireRiffScript: z.boolean().default(true),
	requireTestScript: z.boolean().default(true),
	requireTypecheckScript: z.boolean().default(true),
	// TUI requirements
	requireTuiAppExport: z.boolean().default(false),
	requireTuiRenderAppExport: z.boolean().default(false),
	requireTuiControllerExport: z.boolean().default(false),
	requireAriaTuiPackage: z.boolean().default(false),
	requireAppShell: z.boolean().default(false),
	// CLI requirements
	requireCreateProgramFunc: z.boolean().default(true),
	requireExecutionGuard: z.boolean().default(true),
	disallowModuleLevelProgram: z.boolean().default(true),
	requireProgramNameMatchesRiff: z.boolean().default(true),
	// Config requirements
	requireConfigWrapper: z.boolean().default(true),
	requireLoggingPeer: z.boolean().default(true),
	requireAriaRiffPeer: z.boolean().default(true),
	requireBracketNotation: z.boolean().default(true),
	// Schema requirements
	requireLoggingSchema: z.boolean().default(true),
	requireStrictRoot: z.boolean().default(true),
});

// =============================================================================
// LOGGING SCHEMA
// =============================================================================

export const LoggingConfigSchema = z.object({
	level: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
	verbose: z.boolean().default(false),
	file: z.string().default('.aria/logs/riff-auditor.log'),
	maxFileSizeMb: z.number().min(1).default(10),
	maxFiles: z.number().min(1).default(7),
});

// =============================================================================
// RIFF SCHEMA
// =============================================================================

export const RiffAuditorRiffSchema = z.object({
	paths: PathsSchema.default(PathsSchema.parse({})),
	audits: AuditsSchema.default(AuditsSchema.parse({})),
	rules: RulesSchema.default(RulesSchema.parse({})),
});

// =============================================================================
// ROOT SCHEMA
// =============================================================================

export const RiffAuditorConfigSchema = z
	.object({
		'aria-riff': AriaRiffMetadataSchema.optional(),
		'riff-auditor': RiffAuditorRiffSchema.default(RiffAuditorRiffSchema.parse({})),
		logging: LoggingConfigSchema.default(LoggingConfigSchema.parse({})),
	})
	.strict();

// =============================================================================
// TYPES
// =============================================================================

export type RiffAuditorConfig = z.infer<typeof RiffAuditorConfigSchema>;
export type RiffAuditorRiffConfig = z.infer<typeof RiffAuditorRiffSchema>;
export type PathsConfig = z.infer<typeof PathsSchema>;
export type PathInputConfig = z.infer<typeof PathInputSchema>;
export type PathOutputConfig = z.infer<typeof PathOutputSchema>;
export type AuditsConfig = z.infer<typeof AuditsSchema>;
export type RulesConfig = z.infer<typeof RulesSchema>;
export type LoggingConfig = z.infer<typeof LoggingConfigSchema>;
