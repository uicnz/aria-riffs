/**
 * TypeScript type definitions for image renamer riff
 */

// Discriminated union types for the client architecture
export interface OllamaConfig {
	provider: 'ollama';
	endpoint: string;
	model: string;
	timeout: number;
	retryAttempts: number;
	retryDelay: number;
	prompt: string;
}

export interface AnthropicConfig {
	provider: 'anthropic';
	apiKey: string;
	model: string;
	timeout: number;
	maxTokens: number;
	baseUrl: string;
	prompt: string;
}

export interface GeminiConfig {
	provider: 'gemini';
	apiKey: string;
	model: string;
	timeout: number;
	maxTokens: number;
	baseUrl: string;
	prompt: string;
}

export type LLMProviderConfig = OllamaConfig | AnthropicConfig | GeminiConfig;

export interface ProcessingResults {
	total_files: number;
	processed: number;
	failed: number;
	skipped: number;
	processing_time: number;
	errors: string[];
}
/**
 * Abstract interface for LLM clients
 */
/**
 * Model information returned from list models
 */
export interface ModelInfo {
	name: string;
	size?: number;
	modified_at?: string;
	digest?: string;
}

export interface LLMClient {
	generateFilename(imagePath: string, customPrompt?: string): Promise<string>;
	testConnection(): Promise<boolean>;
	listModels(): Promise<ModelInfo[]>;
	modelName: string;
	endpointUrl: string;
}

export interface WatchStats {
	files_processed: number;
	files_failed: number;
	watch_time: number;
}

export class ImageRenameError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ImageRenameError';
	}
}

export class LlmConnectionError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'LlmConnectionError';
	}
}

export class FileOperationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'FileOperationError';
	}
}

export class ImageCorrupted extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ImageCorrupted';
	}
}

export class WatcherError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'WatcherError';
	}
}

export class ConfigError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ConfigError';
	}
}

// Database update result types
export type WasModified = 'Modified' | 'NotModified';
