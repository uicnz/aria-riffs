/**
 * Base extractor interface and types for SharePoint link extraction strategies
 */

/**
 * Result of SharePoint link extraction
 */
export interface ExtractionResult {
	url: string | null;
	error?: string;
	method: 'applescript' | 'database' | 'graph-api';
	resourceId?: string;
	parentResourceId?: string;
	etag?: string;
}

/**
 * Configuration for extractors
 */
export interface ExtractorConfig {
	extractionDelay?: number;
	oneDriveDbPath?: string;
	sharePointBase?: string;
	sharePointWebBasePath?: string;
	syncFolder?: string;
	graphApiToken?: string;
}

/**
 * Abstract base class for all extraction strategies
 */
export abstract class BaseExtractor {
	protected config: ExtractorConfig;

	constructor(config: ExtractorConfig) {
		this.config = config;
	}

	/**
	 * Extract SharePoint URL for a file
	 */
	abstract extract(filePath: string): Promise<ExtractionResult>;

	/**
	 * Check if this extractor is available and configured
	 */
	abstract validate(): Promise<boolean>;

	/**
	 * Get extractor name for logging and identification
	 */
	abstract getName(): string;
}
