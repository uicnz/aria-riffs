/**
 * Represents an employee in the staff directory
 */
export interface Employee {
	displayName: string;
	firstName: string;
	lastName: string;
	email: string;
	title: string;
	department: string;
	manager: string;
	mobile: string;
	streetAddress: string;
	city: string;
	country: string;
}

/**
 * Represents a node in the organizational tree
 */
export interface OrgNode {
	employee: Employee;
	directReports: OrgNode[];
}

/**
 * Options for formatting the organizational chart
 */
export interface FormatOptions {
	includeTitle?: boolean;
	includeDepartment?: boolean;
	includeEmail?: boolean;
	maxDepth?: number;
}

/**
 * Section metadata for decomposed document sections
 */
export interface SectionMetadata {
	source_file: string;
	source_section: string;
	section_index: number;
	line_range: [number, number];
	decomposed_at: string;
}

/**
 * Decomposed section with heading, content, and metadata
 */
export interface Section {
	heading: string;
	content: string;
	metadata: SectionMetadata;
	filename: string;
	frontmatter: string;
}

/**
 * Decomposer configuration
 */
export interface DecomposerConfig {
	input_file: string;
	output_directory: string;
	header_pattern: string;
}

/**
 * Search result snippet with match positions
 */
export interface SearchResultSnippet {
	text: string;
	startLine: number;
	endLine: number;
	matchStartCol: number;
	matchEndCol: number;
	matchIndices: Array<{ start: number; end: number }>;
}

/**
 * Scoring weights for hybrid search ranking.
 * Base weights (title + field + name + semantic + lexical) should sum to 1.0.
 */
export interface ScoringWeights {
	/** Weight for job title match score (0-1) */
	title: number;
	/** Weight for metadata field match: department, manager, location (0-1) */
	field: number;
	/** Weight for person name match (0-1) */
	name: number;
	/** Weight for semantic similarity / cosine distance (0-1) */
	semantic: number;
	/** Weight for lexical RRF from FTS passes (0-1) */
	lexical: number;
	/** Bonus multiplier for high-confidence name matches (nameScore >= 0.8) */
	nameBoost: number;
	/** Bonus per retrieval pass, capped at 0.1 total */
	passBonus: number;
}

/**
 * Search result with scores and metadata
 */
export interface SearchResult {
	id: string;
	score: number;
	sem_score: number;
	lex_score: number;
	field_score: number;
	name_score: number;
	title_score: number;
	pass_count: number;
	content: string;
	metadata: Record<string, unknown>;
	snippet?: SearchResultSnippet;
}

/**
 * Field weights for search scoring (sub-weights within the field component)
 */
export interface FieldWeights {
	department: number;
	title: number;
	manager: number;
	location: number;
}

/**
 * Search options.
 * weights and fieldWeights are optional; search() provides defaults when omitted.
 */
export interface SearchOptions {
	hybrid: boolean;
	weights?: ScoringWeights;
	fieldWeights?: FieldWeights;
	nResults: number;
	snippetContextLines?: number;
}
