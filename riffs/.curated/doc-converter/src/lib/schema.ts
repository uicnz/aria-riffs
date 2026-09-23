import { z } from 'zod';

const AriaRiffMetadataSchema = z
	.object({
		name: z.literal('doc-converter'),
		description: z.string().min(1),
		category: z.enum(['documents', 'images', 'knowledge', 'development', 'utilities']),
	})
	.strict();

// Valid document types
export const DocTypeSchema = z.enum(['docx', 'pptx', 'xlsx', 'auto']);

// Path configuration schemas
const PathInputSchema = z.object({
	dir: z.string().default('sources'),
});

const PathOutputSchema = z.object({
	dir: z.string().default('.aria/exports/doc-converter'),
});

const PathsSchema = z.object({
	input: PathInputSchema.default(PathInputSchema.parse({})),
	output: PathOutputSchema.default(PathOutputSchema.parse({})),
});

// Doc Converter execution options
export const DocConverterRiffSchema = z
	.object({
		paths: PathsSchema.default(PathsSchema.parse({})),
		type: DocTypeSchema.default('auto'),
		cleanFirst: z.boolean().default(false),
		inPlace: z.boolean().default(false),
		dirsRecurse: z.boolean().default(false),
		dirsPreserve: z.boolean().default(false),
		dirsSanitize: z.boolean().default(false),
		gitkeep: z.boolean().default(true),
	})
	.strict();

// Markdownlint execution options
export const MarkdownlintConfigSchema = z
	.object({
		enabled: z.boolean().default(false),
		fix: z.boolean().default(false),
		configPath: z.string().nullable().default(null),
	})
	.strict();

// Valid AR rule codes (from RULES registry)
const ARRuleCodes = z.enum([
	'AR001',
	'AR002',
	'AR003',
	'AR004',
	'AR005',
	'AR006',
	'AR007',
	'AR008',
	'AR009',
	'AR010',
	'AR011',
	'AR012',
	'AR013',
	'AR014',
	'AR015',
	'AR016',
	'AR017',
	'AR018',
]);

// AriaRules section
export const AriaRulesConfigSchema = z
	.object({
		enabled: z.boolean().default(true),
		rules: z.record(ARRuleCodes, z.boolean()).optional(),
	})
	.strict();

// Valid MD rule codes (markdownlint rules MD001-MD059 with gaps)
// Using string keys to allow for any valid MD code pattern

// MarkdownlintRules section
export const MarkdownlintRulesConfigSchema = z
	.object({
		enabled: z.boolean().default(false),
		rules: z.record(z.string(), z.boolean()).optional().default({}),
	})
	.strict();

// Logging configuration
export const LoggingConfigSchema = z
	.object({
		level: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
		verbose: z.boolean().default(false),
		file: z.string().default('.aria/logs/doc-converter.log'),
		maxFileSizeMb: z.number().default(10),
		maxFiles: z.number().default(7),
	})
	.strict();

// Complete config file schema
export const DocConverterConfigSchema = z
	.object({
		'aria-riff': AriaRiffMetadataSchema.optional(),
		'doc-converter': DocConverterRiffSchema.default(DocConverterRiffSchema.parse({})),
		markdownlint: MarkdownlintConfigSchema.default(MarkdownlintConfigSchema.parse({})),
		ariaRules: AriaRulesConfigSchema.default(AriaRulesConfigSchema.parse({})),
		markdownlintRules: MarkdownlintRulesConfigSchema.default(MarkdownlintRulesConfigSchema.parse({})),
		logging: LoggingConfigSchema.default(LoggingConfigSchema.parse({})),
	})
	.strict();

// Infer TypeScript types from schema (single source of truth)
export type DocType = z.infer<typeof DocTypeSchema>;
export type DocConverterRiffConfig = z.infer<typeof DocConverterRiffSchema>;
export type MarkdownlintConfig = z.infer<typeof MarkdownlintConfigSchema>;
export type AriaRulesConfig = z.infer<typeof AriaRulesConfigSchema>;
export type MarkdownlintRulesConfig = z.infer<typeof MarkdownlintRulesConfigSchema>;
export type LoggingConfig = z.infer<typeof LoggingConfigSchema>;
export type DocConverterConfig = z.infer<typeof DocConverterConfigSchema>;
