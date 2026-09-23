/**
 * TypeScript type definitions for image meta processor
 */

// Base config interfaces for LLM providers (without discriminant)
export interface BaseOllamaConfig {
	endpoint: string;
	model: string;
	timeout: number;
	keepAlive: number;
	prompt: string;
}

export interface BaseAnthropicConfig {
	apiKey: string;
	model: string;
	timeout: number;
	maxTokens: number;
	baseUrl: string;
	prompt: string;
}

export interface BaseGeminiConfig {
	apiKey: string;
	model: string;
	timeout: number;
	maxTokens: number;
	baseUrl: string;
	prompt: string;
}

// Discriminated union types for the client architecture
export interface OllamaConfig extends BaseOllamaConfig {
	provider: 'ollama';
}

export interface AnthropicConfig extends BaseAnthropicConfig {
	provider: 'anthropic';
}

export interface GeminiConfig extends BaseGeminiConfig {
	provider: 'gemini';
}

export type LLMProviderConfig = OllamaConfig | AnthropicConfig | GeminiConfig;

export interface DatabaseConfig {
	backupCount: number;
	journalMode?: string;
}

export interface ImagesConfig {
	supportedExtensions: string[];
	maxFileSizeMb: number;
}

export interface MetadataConfig {
	retryAttempts: number;
	retryDelay: number;
}

export interface LoggingConfig {
	level: string;
	verbose: boolean;
	file: string;
	maxFileSizeMb: number;
	maxFiles: number;
}

export interface ProcessingConfig {
	batchSize: number;
	progressBar: boolean;
}

/**
 * Model information returned from list models
 */
export interface ModelInfo {
	name: string;
	size?: number;
	modified_at?: string;
	digest?: string;
}

/**
 * Abstract interface for LLM clients
 */
export interface LLMClient {
	generateDescription(imagePath: string): Promise<string>;
	testConnection(): Promise<boolean>;
	listModels(): Promise<ModelInfo[]>;
	modelName: string;
	endpointUrl: string;
}

export interface ProcessingResults {
	total_files: number;
	processed: number;
	failed: number;
	renamed: number;
	processing_time: number;
	errors: string[];
}

export interface DatabaseRecord {
	file_path: string;
	description: string;
	created_at: string;
	updated_at: string;
}

export interface DescriptionResult {
	description: string | null;
	source: 'generated' | 'cached' | 'skipped';
}

export class ImageProcessorError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ImageProcessorError';
	}
}

export class LlmConnectionError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'LlmConnectionError';
	}
}

export class DatabaseError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'DatabaseError';
	}
}

export class MetadataWriteError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'MetadataWriteError';
	}
}

export class FilePermissionError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'FilePermissionError';
	}
}

export class UnsupportedImageFormat extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'UnsupportedImageFormat';
	}
}
