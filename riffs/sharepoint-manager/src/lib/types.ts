/**
 * TypeScript interfaces and types for SharePoint riffset
 */

export interface FileRecord {
	name: string;
	path: string;
	full_path: string;
	file_extension: string;
	download_link: string;
	directory_view_link: string;
	web_view_link: string;
	web_view_status: 'pending' | 'completed' | 'failed';
	error_message?: string;
	resource_id?: string;
	extraction_method?: 'applescript' | 'database' | 'graph-api';
	parent_resource_id?: string;
	etag?: string;
	size_mb: number;
	modified: string;
}

/**
 * Logging configuration
 */
export interface LoggingConfig {
	level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
	verbose: boolean;
	file: string;
	maxFileSizeMb: number;
	maxFiles: number;
}
