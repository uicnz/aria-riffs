/**
 * Zod schema definitions for doc-indexer configuration
 * Single source of truth for config structure and defaults
 */

import { z } from 'zod';

const AriaRiffMetadataSchema = z
	.object({
		name: z.literal('doc-indexer'),
		description: z.string().min(1),
		category: z.enum(['documents', 'images', 'knowledge', 'development', 'utilities']),
	})
	.strict();

// =============================================================================
// CATEGORY SCHEMA
// =============================================================================

const CategorySchema = z.object({
	name: z.string(),
	description: z.string(),
	customise: z.boolean(),
});

// =============================================================================
// PRIORITY SCHEMA
// =============================================================================

const PrioritySchema = z.object({
	name: z.string(),
	level: z.string(),
});

// =============================================================================
// DEPARTMENT SCHEMA
// =============================================================================

const DepartmentSchema = z.object({
	name: z.string(),
	description: z.string(),
	leader: z.string().default(''),
});

// =============================================================================
// PATHS SCHEMA
// =============================================================================

const PathInputSchema = z.object({
	documents: z.string().default('exports'),
	fullRfp: z.string().optional(),
});

const PathOutputSchema = z.object({
	dir: z.string().default('.aria/db/doc-indexer'),
});

const PathTemplateSchema = z.object({
	graph: z.string().default('graph.json'),
	documents: z.string().default('documents.jsonl'),
	viewer: z.string().default('viewer.html'),
});

const PathDatabaseSchema = z.object({
	file: z.string().default('.aria/db/doc-indexer/doc-indexer.sqlite'),
});

const PathsSchema = z.object({
	input: PathInputSchema.default(PathInputSchema.parse({})),
	output: PathOutputSchema.default(PathOutputSchema.parse({})),
	template: PathTemplateSchema.default(PathTemplateSchema.parse({})),
	database: PathDatabaseSchema.default(PathDatabaseSchema.parse({})),
});

// =============================================================================
// RFP EXTRACTION PATTERN SCHEMA
// =============================================================================

const ExtractionPatternSchema = z.object({
	pattern: z.string(),
	fallback: z.string().nullable().optional(),
	dateFormat: z.string().optional(),
});

const RfpMetadataSchema = z.object({
	vendor: z.string().optional(),
	client: z.string().optional(),
	rfpName: z.string().optional(),
});

const RfpExtractionSchema = z.object({
	vendor: ExtractionPatternSchema.optional(),
	client: ExtractionPatternSchema.optional(),
	rfpName: ExtractionPatternSchema.optional(),
	proposalDate: ExtractionPatternSchema.optional(),
});

const RfpRequirementsSchema = z.object({
	patterns: z.array(z.string()).default([]),
});

const RfpSchema = z.object({
	metadata: RfpMetadataSchema.optional(),
	extraction: RfpExtractionSchema.optional(),
	requirements: RfpRequirementsSchema.optional(),
});

// =============================================================================
// SCORING WEIGHTS SCHEMA
// =============================================================================

const ScoringWeightsSchema = z.object({
	title: z.number().default(0.25),
	identifier: z.number().default(0.15),
	semantic: z.number().default(0.3),
	lexical: z.number().default(0.2),
	phrase: z.number().default(0.1),
	identifierBoost: z.number().default(0.2),
	phraseBoost: z.number().default(0.15),
	passBonus: z.number().default(0.025),
});

// =============================================================================
// SEARCH SCHEMAS
// =============================================================================

const SearchConfigSchema = z.object({
	weights: ScoringWeightsSchema.default(ScoringWeightsSchema.parse({})),
	snippetContextLines: z.number().default(1),
});

const SearchReferenceSchema = z.object({
	abbreviations: z.record(z.string(), z.array(z.string())).default({}),
	synonyms: z.array(z.array(z.string())).default([]),
	stopWords: z.array(z.string()).default([]),
	identifierExpansions: z.record(z.string(), z.array(z.string())).default({}),
	domainProducts: z.array(z.string()).default([]),
	domainConcepts: z.array(z.string()).default([]),
});

// =============================================================================
// TUI SCHEMA
// =============================================================================

const TuiConfigSchema = z.object({
	theme: z.string().default('GitHub Dark'),
});

// =============================================================================
// LOGGING SCHEMA
// =============================================================================

export const LoggingConfigSchema = z.object({
	level: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
	verbose: z.boolean().default(false),
	file: z.string().default('.aria/logs/doc-indexer.log'),
	maxFileSizeMb: z.number().min(1).default(10),
	maxFiles: z.number().min(1).default(7),
});

// =============================================================================
// ROOT SCHEMA
// =============================================================================

export const DocIndexerRiffSchema = z.object({
	categories: z.array(CategorySchema).default([
		{ name: 'standard', description: 'Cookie-cutter: use verbatim across clients', customise: false },
		{ name: 'hybrid', description: 'Mix: standard framework with specific details', customise: true },
		{ name: 'specific', description: 'Snowflake: 100% custom, unique to each client', customise: true },
	]),
	priorities: z.array(PrioritySchema).default([
		{ name: 'Must Fully Comply', level: 'must' },
		{ name: 'Should Comply', level: 'should' },
		{ name: 'Nice to Comply', level: 'nice' },
	]),
	departments: z.array(DepartmentSchema).default([]),
	paths: PathsSchema.default(PathsSchema.parse({})),
	rfp: RfpSchema.optional(),
	search: SearchConfigSchema.default(SearchConfigSchema.parse({})),
	model: z.string().default('text-embedding-3-large'),
	dimensions: z.number().default(3072),
	maxEmbedChars: z.number().default(20000),
	sections: z.enum(['response', 'request', 'both', 'full']).default('both'),
	weightResponse: z.number().default(1.8),
	useFts: z.boolean().default(true),
	hybrid: z.boolean().default(true),
	alpha: z.number().default(0.2),
	showMetadata: z.boolean().default(true),
	highlight: z.boolean().default(true),
	highlightColor: z.string().default('magenta'),
	tui: TuiConfigSchema.default(TuiConfigSchema.parse({})),
});

export const DocIndexerConfigSchema = z
	.object({
		'aria-riff': AriaRiffMetadataSchema.optional(),
		'doc-indexer': DocIndexerRiffSchema.default(DocIndexerRiffSchema.parse({})),
		logging: LoggingConfigSchema.default(LoggingConfigSchema.parse({})),
		searchReference: SearchReferenceSchema.default(SearchReferenceSchema.parse({})),
	})
	.strict();

// =============================================================================
// TYPES
// =============================================================================

export type DocIndexerConfig = z.infer<typeof DocIndexerConfigSchema>;
export type DocIndexerRiffConfig = z.infer<typeof DocIndexerRiffSchema>;
export type CategoryConfig = z.infer<typeof CategorySchema>;
export type PriorityConfig = z.infer<typeof PrioritySchema>;
export type DepartmentConfig = z.infer<typeof DepartmentSchema>;
export type PathsConfig = z.infer<typeof PathsSchema>;
export type RfpConfig = z.infer<typeof RfpSchema>;
export type ScoringWeights = z.infer<typeof ScoringWeightsSchema>;
export type SearchConfig = z.infer<typeof SearchConfigSchema>;
export type SearchReferenceConfig = z.infer<typeof SearchReferenceSchema>;
export type LoggingConfig = z.infer<typeof LoggingConfigSchema>;
export type TuiConfig = z.infer<typeof TuiConfigSchema>;
