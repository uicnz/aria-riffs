/**
 * Type definitions for Doc Decomposer Riff
 * Uses canonical schema from doc-indexer
 */

// Schema types are defined independently to avoid cross-module dependencies

/**
 * Configuration for the RFP decompose process
 */
export interface Config {
	metadataFile: string; // Path to metadata classification file
	rfpFile: string; // Path to source RFP file
	outputDir: string; // Path to output directory
	descriptionsDir: string; // Path to descriptions directory
}

/**
 * Asset information for files referenced in RFP
 */
export interface AssetInfo {
	originalPath: string; // Original path as referenced in document
	fullPath: string; // Full resolved path to the asset
	assetName: string; // Filename of the asset
	mimeType: string; // MIME type of the asset
	altText?: string; // Alt text description of the asset
}

/**
 * Map of asset paths to asset information
 */
export type AssetReferences = Record<string, AssetInfo>;

/**
 * Content range in the original document
 */
export interface ContentRange {
	start: number; // Start index in original content
	end: number; // End index in original content
}

/**
 * Raw RFP request/response pair extracted from document
 */
export interface RfpPair {
	Title: string; // Section title from the RFP
	Identifier: string; // Unique identifier (e.g., PR8, BR1)
	Priority: string; // Priority level
	importantBlock: string; // The IMPORTANT block content
	Request: string; // The request content
	Response: string; // The response content
	contentRange: ContentRange; // Range in the original content
}

/**
 * Metadata entry from classification file
 */
export interface MetadataEntry {
	Title: string; // Descriptive title
	Identifier: string; // Unique identifier matching RFP pairs
	Priority: string; // Priority level
	Category: string; // standard, hybrid, or specific
	Department: string; // Department responsible
	Leader: string; // Department lead
	Customise: boolean; // Whether customisation needed
}

/**
 * Map of identifiers to metadata entries
 */
export type MetadataLookup = Record<string, MetadataEntry>;

/**
 * RFP pair enriched with metadata
 */
export interface MatchedPair extends RfpPair {
	Description: string; // Descriptive title from metadata
	Category: string; // standard, hybrid, or specific
	Department: string; // Department responsible
	Leader: string; // Department lead person
	Customise: boolean; // Whether customisation needed
}

/**
 * Statistics for a category
 */
export interface CategoryStats {
	category: string;
	count: number;
	percentage: string;
}

/**
 * Statistics for a department
 */
export interface DepartmentStats {
	department: string;
	count: number;
	percentage: string;
}

/**
 * Statistics for a department lead
 */
export interface LeaderStats {
	Leader: string;
	count: number;
	percentage: string;
}

/**
 * Overall statistics for the RFP decomposition
 */
export interface DecomposeStats {
	totalPairs: number;
	categories: CategoryStats[];
	departments: DepartmentStats[];
	leaders: LeaderStats[];
	customCount: number; // Number requiring customisation
	standardCount: number; // Number that are standard
}

// LoggingConfig is now defined in schema.ts and re-exported from config.ts
