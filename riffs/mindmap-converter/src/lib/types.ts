/**
 * Type definitions for mindmap-converter riff
 *
 * Domain types for mindmap processing and conversion.
 * Config types are defined in schema.ts.
 */

// Re-export config types from schema.ts for backwards compatibility
export type {
	BatchConfig,
	ConversionConfig,
	DatabaseConfig,
	JsonlConfig,
	LoggingConfig,
	MindmapConverterConfig,
	MindmapConverterRiffConfig,
	OutputConfig,
	ValidationConfig,
} from './schema.js';

// Re-export schemas for consumers that need runtime validation
export {
	BatchConfigSchema,
	ConversionConfigSchema,
	DatabaseConfigSchema,
	JsonlConfigSchema,
	LoggingConfigSchema,
	MindmapConverterConfigSchema,
	MindmapConverterRiffSchema,
	OutputConfigSchema,
	ValidationConfigSchema,
} from './schema.js';

/**
 * Represents a node in a mindmap hierarchy
 */
export interface MindmapNode {
	text: string;
	children: MindmapNode[];
}

/**
 * Supported output formats for conversion
 */
export type OutputFormat =
	| 'headers' // Current default - nested headers
	| 'bullets' // Nested bullet lists
	| 'numbered' // Nested numbered lists
	| 'legal' // Hierarchical numbering for legal docs (1, 1.1, 1.1.1)
	| 'mixed' // Headers + bullets
	| 'mindmap' // Hierarchical numbering (1.1, 1.2.1)
	| 'tasks' // GitHub task lists
	| 'tree' // Unix tree style
	| 'mermaid-mindmap' // Mermaid mindmap
	| 'mermaid-flowchart'; // Mermaid flowchart

/**
 * Options for format-specific configuration
 */
export interface FormatOptions {
	format: OutputFormat;
	headingDepth?: number; // For mixed format
	rootLabel?: string; // For tree/mermaid
	mermaidDirection?: 'TD' | 'LR' | 'RL' | 'BT'; // For flowchart
}

/**
 * Supported input formats
 */
export type InputFormat = 'opml' | 'mm';

/**
 * Configuration options for Markdown conversion
 */
export interface MarkdownOptions {
	maxHeadingLevel: number;
	useBulletPoints: boolean;
	preserveHierarchy: boolean;
}

/**
 * Result of parsing a mindmap file
 */
export interface ParseResult {
	root: MindmapNode;
	format: InputFormat;
	metadata?: {
		title?: string;
		dateCreated?: string;
		generator?: string;
	};
}

/**
 * Options for the conversion process
 */
export interface ConversionOptions {
	inputPath: string;
	outputPath: string;
	format?: InputFormat;
	outputFormat?: OutputFormat;
	markdownOptions?: Partial<MarkdownOptions>;
	formatOptions?: Partial<FormatOptions>;
	verbose?: boolean;
}

/**
 * Database record for a mindmap file
 */
export interface MindmapRecord {
	id?: number;
	file_path: string;
	format: InputFormat;
	title?: string;
	node_count: number;
	content_json: string;
	converted_path?: string;
	status: 'pending' | 'completed' | 'failed';
	error_message?: string;
	created_at?: string;
	updated_at?: string;
}

/**
 * Custom error for database operations
 */
export class DatabaseError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'DatabaseError';
	}
}
