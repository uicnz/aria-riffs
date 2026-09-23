// Core types used across the application

// DocumentType represents document categorization, configured per parser
export type DocumentType = string;

export interface SourceCitation {
	file: string;
	anchor?: string;
	line_range?: [number, number];
}

export interface RfpDocMetadata {
	id: string;
	identifier?: string;
	type?: DocumentType;
	title?: string;
	description?: string;
	category?: string;
	department?: string;
	leader?: string;
	customise?: boolean;
	priority?: string;
	relative_path: string;
	full_path: string;
	request_text?: string;
	response_text?: string;
	assets?: string[];
	source_citation?: SourceCitation;
	rfp_name?: string;
	client?: string;
	vendor?: string;
	proposal_date?: string; // ISO string
	indexed_at: string; // ISO string
	embedding_model: string;
	dimensions: number;
}

// Canonical field names as constants
export const SCHEMA = {
	IDENTIFIER: 'Identifier',
	TYPE: 'Type',
	TITLE: 'Title',
	DESCRIPTION: 'Description',
	PRIORITY: 'Priority',
	CATEGORY: 'Category',
	DEPARTMENT: 'Department',
	LEADER: 'Leader',
	CUSTOMISE: 'Customise',
	REQUEST: 'Request',
	RESPONSE: 'Response',
	CITATION: 'Citation',
	ASSET: 'Asset',
	PATH: 'Path',
	FULL_PATH: 'FullPath',
} as const;

export type SchemaField = (typeof SCHEMA)[keyof typeof SCHEMA];

// Citation structure
export interface Citation {
	file: string;
	anchor?: string;
	line_range?: [number, number];
}

// Main document schema interface
export interface DocumentSchema {
	Identifier: string;
	Type: string;
	Title: string;
	Description?: string;
	Priority: string;
	Category: string;
	Department: string;
	Leader: string;
	Customise: boolean;
	Request?: string;
	Response?: string;
	Citation?: Citation;
	Asset?: string[];
	Path: string;
	FullPath: string;
}

// Metadata for indexing and tracking
export interface DocumentMetadata extends DocumentSchema {
	id: string;
	rfp_name?: string;
	client?: string;
	vendor?: string;
	proposal_date?: string;
	indexed_at: string;
	embedding_model?: string;
	dimensions?: number;
}

// Graph node types
export const NODE_TYPES = {
	DOCUMENT: 'Document',
	CATEGORY: 'Category',
	DEPARTMENT: 'Department',
	LEADER: 'Leader',
	PRIORITY: 'Priority',
	TYPE: 'Type',
	CUSTOMISE: 'Customise',
	CITATION: 'Citation',
	ASSET: 'Asset',
} as const;

export type NodeType = (typeof NODE_TYPES)[keyof typeof NODE_TYPES];

// Graph edge relations (MUST match field names exactly)
export const EDGE_RELATIONS = {
	CATEGORY: SCHEMA.CATEGORY,
	DEPARTMENT: SCHEMA.DEPARTMENT,
	LEADER: SCHEMA.LEADER,
	PRIORITY: SCHEMA.PRIORITY,
	TYPE: SCHEMA.TYPE,
	CUSTOMISE: SCHEMA.CUSTOMISE,
	CITATION: SCHEMA.CITATION,
	ASSET: SCHEMA.ASSET,
} as const;

export type EdgeRelation = (typeof EDGE_RELATIONS)[keyof typeof EDGE_RELATIONS];

// Validation functions
export function validateDocumentSchema(doc: unknown): doc is DocumentSchema {
	if (!doc || typeof doc !== 'object') return false;

	const required = [
		'Identifier',
		'Type',
		'Title',
		'Priority',
		'Category',
		'Department',
		'Leader',
		'Path',
		'FullPath',
	];
	for (const field of required) {
		if (!(field in doc)) {
			return false;
		}
	}

	if ('Customise' in doc && typeof doc.Customise !== 'boolean') {
		return false;
	}

	if ('Asset' in doc && !Array.isArray(doc.Asset)) {
		return false;
	}

	return true;
}

// Priority levels - loaded from config file
export type PriorityLevel = string;

// Document types - examples only, actual types are configuration-driven
export const DOCUMENT_TYPES = {} as const;

export type CategoryType = string;

// Configuration types
export type SectionsMode = 'response' | 'request' | 'both' | 'full';

// RFP parser configuration (optional)
export interface RfpMetadataExtraction {
	pattern: string; // Regex pattern to extract metadata
	fallback?: string | null; // Fallback value if pattern doesn't match
	dateFormat?: string; // Date format for parsing (e.g., 'DD-MM-YY', 'YYYY-MM-DD')
}

export interface RfpMetadataConfig {
	vendor?: string;
	client?: string;
	rfpName?: string;
}

export interface RfpExtractionConfig {
	vendor?: RfpMetadataExtraction;
	client?: RfpMetadataExtraction;
	rfpName?: RfpMetadataExtraction;
	proposalDate?: RfpMetadataExtraction;
}

export interface RfpRequirementsConfig {
	patterns: string[]; // Array of regex patterns to match requirement IDs
}

export interface RfpParserConfig {
	metadata?: RfpMetadataConfig; // Static metadata (overrides extraction)
	extraction?: RfpExtractionConfig; // Dynamic metadata extraction patterns
	requirements?: RfpRequirementsConfig; // Requirement identifier patterns
}

/**
 * Scoring weights for hybrid search ranking.
 * All weights should sum to 1.0 for the base formula.
 */
export interface ScoringWeights {
	/** Weight for title match score (0-1) */
	title: number;
	/** Weight for identifier match score (0-1) */
	identifier: number;
	/** Weight for semantic similarity score (0-1) */
	semantic: number;
	/** Weight for lexical/RRF score (0-1) */
	lexical: number;
	/** Weight for exact phrase match score (0-1) */
	phrase: number;
	/** Bonus multiplier for high-confidence identifier matches */
	identifierBoost: number;
	/** Bonus multiplier for exact phrase matches */
	phraseBoost: number;
	/** Bonus per retrieval pass (capped at 0.1 total) */
	passBonus: number;
}

export interface SearchConfig {
	abbreviations: Record<string, string[]>;
	synonyms: string[][];
	stopWords: string[];
	/** Identifier prefix expansions: maps prefix to expanded terms (e.g., MR -> management, requirement) */
	identifierExpansions?: Record<string, string[]>;
	/** Domain-specific product/platform names for keyword extraction */
	domainProducts?: string[];
	/** Domain-specific technical concepts for keyword extraction */
	domainConcepts?: string[];
	/** Scoring weights for hybrid search */
	weights?: ScoringWeights;
	/** Number of lines of context around snippet matches (1 = tight, 2 = moderate, 3+ = verbose) */
	snippetContextLines?: number;
}

export interface AriaDocConfig {
	rfp?: RfpParserConfig; // RFP parser configuration (optional)
	search?: SearchConfig; // Search configuration (abbreviations, synonyms, stop words)
	tui?: TuiConfig; // TUI configuration (optional)
	paths?: PathsConfig; // Paths configuration (database, output, etc.)
	model: string;
	dimensions: number;
	maxEmbedChars: number;
	sections: SectionsMode;
	weightResponse: number; // >1 biases embeddings toward Response
	useFts: boolean; // create/populate FTS5 table at index time
	hybrid: boolean; // default hybrid search behavior
	alpha: number; // lexical weight when hybrid=true (0..1)
	showMetadata: boolean; // pretty output default
	highlight: boolean; // pretty output default
	highlightColor?: string; // color for highlighting search terms
}

// Snippet extraction result
export interface SearchResultSnippet {
	/** The extracted text snippet */
	text: string;
	/** Starting line number (0-indexed) */
	startLine: number;
	/** Ending line number (0-indexed, inclusive) */
	endLine: number;
	/** Column where first match starts */
	matchStartCol: number;
	/** Column where first match ends */
	matchEndCol: number;
	/** All match positions in the snippet text */
	matchIndices: Array<{ start: number; end: number }>;
}

// Search result types
export interface SearchResult {
	id: string;
	score: number;
	sem_score: number;
	lex_score: number;
	title_score?: number;
	identifier_score?: number;
	pass_count?: number;
	metadata: RfpDocMetadata;
	content: string;
	snippet?: SearchResultSnippet;
}

export interface SearchOptions {
	filters?: Partial<Pick<RfpDocMetadata, 'category' | 'department' | 'priority' | 'identifier'>>;
	hybrid?: boolean;
	alpha?: number;
	includeFull?: boolean;
	includeContent?: boolean;
}

/**
 * TUI configuration
 */
export interface TuiConfig {
	theme?: string; // Theme name (e.g., 'Default', 'Dracula', 'GitHub Dark')
}

/**
 * Paths configuration
 */
export interface PathsConfig {
	input?: {
		documents?: string;
		fullRfp?: string;
	};
	output?: {
		dir?: string;
	};
	template?: {
		graph?: string;
		documents?: string;
		viewer?: string;
	};
	database?: {
		file?: string;
	};
}
