/**
 * Zod schema for doc-decomposer configuration
 * Single source of truth for config structure and defaults
 */

import { z } from 'zod';

const AriaRiffMetadataSchema = z
	.object({
		name: z.literal('doc-decomposer'),
		description: z.string().min(1),
		category: z.enum(['documents', 'images', 'knowledge', 'development', 'utilities']),
	})
	.strict();

// =============================================================================
// LOGGING SECTION
// =============================================================================

export const LoggingConfigSchema = z.object({
	level: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
	verbose: z.boolean().default(false),
	file: z.string().default('.aria/logs/doc-decomposer.log'),
	maxFileSizeMb: z.number().default(10),
	maxFiles: z.number().default(7),
});

export type LoggingConfig = z.infer<typeof LoggingConfigSchema>;

// =============================================================================
// PATHS SECTION
// =============================================================================

const PathInputSchema = z.object({
	metadata: z.string().default(''),
	rfp: z.string().default(''),
});

const PathOutputSchema = z.object({
	dir: z.string().default('output'),
});

const PathTemplateSchema = z.object({
	descriptions: z.string().default('descriptions'),
	assets: z.string().default('assets'),
	fullRfp: z.string().default('full'),
});

export const PathsConfigSchema = z.object({
	input: PathInputSchema.default(PathInputSchema.parse({})),
	output: PathOutputSchema.default(PathOutputSchema.parse({})),
	template: PathTemplateSchema.default(PathTemplateSchema.parse({})),
});

export type PathsConfig = z.infer<typeof PathsConfigSchema>;

// =============================================================================
// PATTERNS SECTION (for regex patterns - stored as strings)
// =============================================================================

export const PatternsConfigSchema = z.object({
	importantBlock: z.string(),
	importantBlockFlags: z.string().default(''),
	metadataSection: z.string(),
	metadataSectionFlags: z.string().default(''),
	heading: z.string(),
	headingFlags: z.string().default(''),
	imageRef: z.string(),
	imageRefFlags: z.string().default(''),
	priority: z.string(),
	priorityFlags: z.string().default(''),
	category: z.string(),
	categoryFlags: z.string().default(''),
	department: z.string(),
	departmentFlags: z.string().default(''),
	leader: z.string(),
	leaderFlags: z.string().default(''),
	customise: z.string(),
	customiseFlags: z.string().default(''),
});

export type PatternsConfig = z.infer<typeof PatternsConfigSchema>;

// =============================================================================
// CATEGORY DEFINITION
// =============================================================================

export const CategoryDefinitionSchema = z.object({
	name: z.string(),
	description: z.string(),
	customise: z.boolean().default(false),
});

export type CategoryDefinition = z.infer<typeof CategoryDefinitionSchema>;

// =============================================================================
// PRIORITY DEFINITION
// =============================================================================

export const PriorityDefinitionSchema = z.object({
	name: z.string(),
	level: z.string(),
});

export type PriorityDefinition = z.infer<typeof PriorityDefinitionSchema>;

// =============================================================================
// DEPARTMENT DEFINITION
// =============================================================================

export const DepartmentDefinitionSchema = z.object({
	name: z.string(),
	description: z.string(),
});

export type DepartmentDefinition = z.infer<typeof DepartmentDefinitionSchema>;

// =============================================================================
// RESPONSE TEMPLATES SECTION
// =============================================================================

export const ResponseTemplatesConfigSchema = z.object({
	/**
	 * Company name used in response templates and parsing patterns.
	 * Example: "Acme Corp" produces "See Acme Corp response to BR01"
	 */
	companyName: z.string().default(''),
	/**
	 * Compliance statement template.
	 * Example: "agrees to fully comply" produces "[Company] agrees to fully comply"
	 */
	complianceStatement: z.string().default('agrees to fully comply'),
});

export type ResponseTemplatesConfig = z.infer<typeof ResponseTemplatesConfigSchema>;

// =============================================================================
// RIFF CONFIG SCHEMA
// =============================================================================

export const DocDecomposerRiffSchema = z.object({
	paths: PathsConfigSchema.default(PathsConfigSchema.parse({})),
	patterns: PatternsConfigSchema.optional(),
	responseTemplates: ResponseTemplatesConfigSchema.default(ResponseTemplatesConfigSchema.parse({})),
	categories: z.array(CategoryDefinitionSchema).default([]),
	priorities: z.array(PriorityDefinitionSchema).default([]),
	departments: z.array(DepartmentDefinitionSchema).default([]),
});

export type DocDecomposerRiffConfig = z.infer<typeof DocDecomposerRiffSchema>;

// =============================================================================
// ROOT CONFIG SCHEMA
// =============================================================================

export const DocDecomposerConfigSchema = z
	.object({
		'aria-riff': AriaRiffMetadataSchema.optional(),
		'doc-decomposer': DocDecomposerRiffSchema.default(DocDecomposerRiffSchema.parse({})),
		logging: LoggingConfigSchema.default(LoggingConfigSchema.parse({})),
	})
	.strict();

export type DocDecomposerConfig = z.infer<typeof DocDecomposerConfigSchema>;

// =============================================================================
// COMPILED REGEX PATTERNS TYPE (runtime compiled from config strings)
// =============================================================================

export interface RegexPatterns {
	IMPORTANT_BLOCK: RegExp;
	METADATA_SECTION: RegExp;
	HEADING: RegExp;
	IMAGE_REF: RegExp;
	PRIORITY: RegExp;
	CATEGORY: RegExp;
	DEPARTMENT: RegExp;
	LEADER: RegExp;
	CUSTOMISE: RegExp;
}
