import { z } from 'zod';

const AriaRiffMetadataSchema = z
	.object({
		name: z.literal('hr-staffer'),
		description: z.string().min(1),
		category: z.enum(['documents', 'images', 'knowledge', 'development', 'utilities']),
	})
	.strict();

/**
 * Zod schema for Employee data validation
 */
export const EmployeeSchema = z.object({
	displayName: z.string().min(1, 'Display name is required'),
	firstName: z.string(),
	lastName: z.string(),
	email: z.string().email('Invalid email format'),
	title: z.string(),
	department: z.string(),
	manager: z.string(),
	mobile: z.string(),
	streetAddress: z.string(),
	city: z.string(),
	country: z.string(),
});

/**
 * Zod schema for OrgNode (tree structure)
 */
export const OrgNodeSchema: z.ZodType<{
	employee: z.infer<typeof EmployeeSchema>;
	directReports: Array<{
		employee: z.infer<typeof EmployeeSchema>;
		directReports: unknown[];
	}>;
}> = z.lazy(() =>
	z.object({
		employee: EmployeeSchema,
		directReports: z.array(OrgNodeSchema),
	})
);

/**
 * Zod schema for format options
 */
export const FormatOptionsSchema = z.object({
	includeTitle: z.boolean().optional(),
	includeDepartment: z.boolean().optional(),
	includeEmail: z.boolean().optional(),
	maxDepth: z.number().optional(),
});

// =============================================================================
// PATHS SCHEMA
// =============================================================================

const PathInputSchema = z.object({
	staff: z.string().min(1, 'Staff CSV file path is required'),
	chart: z.string().default('.aria/db/hr-staffer/org-chart.md'),
	sections: z.string().default('.aria/exports/cello/hr-staffer'),
});

const PathOutputSchema = z.object({
	chart: z.string().default('.aria/db/hr-staffer'),
	sections: z.string().default('.aria/exports/cello/hr-staffer'),
});

const PathDatabaseSchema = z.object({
	file: z.string().default('.aria/db/hr-staffer/hr-staffer.sqlite'),
});

export const PathsSchema = z.object({
	input: PathInputSchema,
	output: PathOutputSchema.default(PathOutputSchema.parse({})),
	database: PathDatabaseSchema.default(PathDatabaseSchema.parse({})),
});

// =============================================================================
// INPUT / OUTPUT / DISPLAY SCHEMAS
// =============================================================================

/**
 * Zod schema for Hr Staffer output formats
 */
export const HrStafferOutputFormatsSchema = z.object({
	text: z.boolean().default(true),
	markdown: z.boolean().default(true),
	mermaid: z.boolean().default(true),
});

/**
 * Zod schema for Hr Staffer output configuration
 */
export const HrStafferOutputSchema = z.object({
	formats: HrStafferOutputFormatsSchema,
});

/**
 * Zod schema for Hr Staffer display options
 */
export const HrStafferDisplaySchema = z.object({
	includeTitle: z.boolean().default(true),
	includeDepartment: z.boolean().default(true),
	includeEmail: z.boolean().default(false),
	maxDepth: z.number().nullable().default(null),
});

/**
 * Zod schema for Hr Staffer mermaid-specific options
 */
export const HrStafferMermaidSchema = z.object({
	breakDownTeams: z.array(z.string()).default([]),
});

/**
 * Zod schema for Hr Staffer database configuration
 */
export const HrStafferDatabaseSchema = z.object({
	enabled: z.boolean().default(true),
});

/**
 * Zod schema for Hr Staffer decomposer configuration
 */
export const HrStafferDecomposerSchema = z.object({
	headerPattern: z.string().default('^#{1,6} .+'),
});

/**
 * Zod schema for Hr Staffer indexer configuration
 */
export const HrStafferIndexerSchema = z.object({
	useFts: z.boolean().default(true),
});

/**
 * Zod schema for field weights in search scoring
 */
export const HrStafferFieldWeightsSchema = z.object({
	department: z.number().min(0).max(1).default(0.15),
	title: z.number().min(0).max(1).default(0.1),
	manager: z.number().min(0).max(1).default(0.08),
	location: z.number().min(0).max(1).default(0.15),
});

/**
 * Zod schema for scoring weights in hybrid search ranking.
 * Base weights (title + field + name + semantic + lexical) should sum to 1.0.
 */
export const HrStafferScoringWeightsSchema = z.object({
	title: z.number().min(0).max(1).default(0.3),
	field: z.number().min(0).max(1).default(0.1),
	name: z.number().min(0).max(1).default(0.15),
	semantic: z.number().min(0).max(1).default(0.2),
	lexical: z.number().min(0).max(1).default(0.25),
	nameBoost: z.number().min(0).max(1).default(0.2),
	passBonus: z.number().min(0).max(0.1).default(0.025),
});

/**
 * Zod schema for Hr Staffer search configuration
 */
export const HrStafferSearchSchema = z.object({
	hybrid: z.boolean().default(true),
	weights: HrStafferScoringWeightsSchema.default(HrStafferScoringWeightsSchema.parse({})),
	fieldWeights: HrStafferFieldWeightsSchema.default({ department: 0.15, title: 0.1, manager: 0.08, location: 0.15 }),
	defaultResults: z.number().positive().default(5),
	snippetContextLines: z.number().positive().default(2),
	maxSnippetLength: z.number().positive().default(2000),
	highlight: z.boolean().default(true),
});

/**
 * Zod schema for Hr Staffer logging configuration
 */
export const LoggingConfigSchema = z.object({
	level: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
	verbose: z.boolean().default(false),
	file: z.string().default('.aria/logs/hr-staffer.log'),
	maxFileSizeMb: z.number().positive().default(10),
	maxFiles: z.number().positive().default(7),
});

/**
 * Zod schema for OpenAI embeddings configuration
 */
export const HrStafferOpenAIEmbeddingsSchema = z.object({
	apiKey: z.string().default(''),
	model: z.string().default('text-embedding-3-large'),
	dimensions: z.number().positive().default(3072),
	timeout: z.number().positive().default(30),
});

/**
 * Zod schema for Gemini embeddings configuration
 */
export const HrStafferGeminiEmbeddingsSchema = z.object({
	apiKey: z.string().default(''),
	model: z.string().default('gemini-embedding-2'),
	dimensions: z.number().positive().default(768),
	timeout: z.number().positive().default(30),
	baseUrl: z.string().default('https://generativelanguage.googleapis.com/v1'),
});

/**
 * Zod schema for Ollama embeddings configuration
 */
export const HrStafferOllamaEmbeddingsSchema = z.object({
	endpoint: z.string().default('http://localhost:11434/'),
	model: z.string().default('embeddinggemma:latest'),
	dimensions: z.number().positive().default(768),
	timeout: z.number().positive().default(60),
	keepAlive: z.number().positive().default(300),
});

/**
 * Zod schema for Hr Staffer embeddings configuration
 */
export const HrStafferEmbeddingsSchema = z.object({
	provider: z.enum(['openai', 'gemini', 'ollama']).default('openai'),
	maxChars: z.number().positive().default(35000),
	batchSize: z.number().positive().default(64),
	openai: HrStafferOpenAIEmbeddingsSchema.default({
		apiKey: '',
		model: 'text-embedding-3-large',
		dimensions: 3072,
		timeout: 30,
	}),
	gemini: HrStafferGeminiEmbeddingsSchema.default({
		apiKey: '',
		model: 'gemini-embedding-2',
		dimensions: 768,
		timeout: 30,
		baseUrl: 'https://generativelanguage.googleapis.com/v1',
	}),
	ollama: HrStafferOllamaEmbeddingsSchema.default({
		endpoint: 'http://localhost:11434/',
		model: 'embeddinggemma:latest',
		dimensions: 768,
		timeout: 60,
		keepAlive: 300,
	}),
});

/**
 * Complete Hr Staffer riff configuration schema (under wrapper)
 */
export const HrStafferRiffSchema = z.object({
	paths: PathsSchema,
	output: HrStafferOutputSchema,
	display: HrStafferDisplaySchema,
	mermaid: HrStafferMermaidSchema,
	database: HrStafferDatabaseSchema.optional(),
	decomposer: HrStafferDecomposerSchema.optional(),
	indexer: HrStafferIndexerSchema.optional(),
	search: HrStafferSearchSchema.optional(),
	embeddings: HrStafferEmbeddingsSchema.optional(),
});

/**
 * Root config file schema with wrapper and logging peer section
 */
export const HrStafferConfigSchema = z
	.object({
		'aria-riff': AriaRiffMetadataSchema.optional(),
		'hr-staffer': HrStafferRiffSchema,
		logging: LoggingConfigSchema.default(LoggingConfigSchema.parse({})),
	})
	.strict();

/**
 * Infer TypeScript types from Zod schemas (single source of truth)
 */
export type Employee = z.infer<typeof EmployeeSchema>;
export type OrgNode = z.infer<typeof OrgNodeSchema>;
export type FormatOptions = z.infer<typeof FormatOptionsSchema>;
export type PathsConfig = z.infer<typeof PathsSchema>;
export type HrStafferOutputFormats = z.infer<typeof HrStafferOutputFormatsSchema>;
export type HrStafferOutput = z.infer<typeof HrStafferOutputSchema>;
export type HrStafferDisplay = z.infer<typeof HrStafferDisplaySchema>;
export type HrStafferMermaid = z.infer<typeof HrStafferMermaidSchema>;
export type HrStafferDatabase = z.infer<typeof HrStafferDatabaseSchema>;
export type HrStafferDecomposer = z.infer<typeof HrStafferDecomposerSchema>;
export type HrStafferIndexer = z.infer<typeof HrStafferIndexerSchema>;
export type HrStafferFieldWeights = z.infer<typeof HrStafferFieldWeightsSchema>;
export type HrStafferScoringWeights = z.infer<typeof HrStafferScoringWeightsSchema>;
export type HrStafferSearch = z.infer<typeof HrStafferSearchSchema>;
export type LoggingConfig = z.infer<typeof LoggingConfigSchema>;
export type HrStafferOpenAIEmbeddings = z.infer<typeof HrStafferOpenAIEmbeddingsSchema>;
export type HrStafferGeminiEmbeddings = z.infer<typeof HrStafferGeminiEmbeddingsSchema>;
export type HrStafferOllamaEmbeddings = z.infer<typeof HrStafferOllamaEmbeddingsSchema>;
export type HrStafferEmbeddings = z.infer<typeof HrStafferEmbeddingsSchema>;
export type HrStafferRiffConfig = z.infer<typeof HrStafferRiffSchema>;
export type HrStafferConfig = z.infer<typeof HrStafferConfigSchema>;
