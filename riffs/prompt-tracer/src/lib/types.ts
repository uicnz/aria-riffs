/**
 * TypeScript type definitions for prompt-tracer riff
 * Config types are defined in schema.ts via Zod inference
 */

// =============================================================================
// CLAUDE API REQUEST/RESPONSE TYPES
// =============================================================================

export interface CacheControl {
	type: string;
}

export interface InputSchema {
	type?: string;
	properties?: Record<string, unknown>;
	required?: string[];
	[key: string]: unknown;
}

export interface Riff {
	name: string;
	description: string;
	input_schema: InputSchema;
}

export interface MessageContent {
	type: string;
	text?: string;
	cache_control?: CacheControl;
}

export interface Message {
	role: string;
	content: string | MessageContent[];
}

export interface SystemBlock {
	type: string;
	text: string;
	cache_control?: CacheControl;
}

export interface RequestBody {
	model: string;
	messages: Message[];
	temperature?: number;
	system?: SystemBlock[];
	riffs?: Riff[];
}

export interface Request {
	timestamp: number;
	method: string;
	url: string;
	headers: Record<string, string>;
	body: RequestBody;
}

export interface RequestResponsePair {
	request: Request;
	response: Record<string, unknown>;
}

// =============================================================================
// TRACE TYPES
// =============================================================================

export interface RawPair {
	request: {
		timestamp: number;
		method: string;
		url: string;
		headers: Record<string, string>;
		body: unknown;
	};
	response: {
		timestamp: number;
		status_code: number;
		headers: Record<string, string>;
		body?: unknown;
		body_raw?: string;
		events?: SSEEvent[];
	} | null; // null for orphaned requests
	logged_at: string;
	note?: string; // For orphaned requests
}

export interface SSEEvent {
	event: string;
	data: unknown;
	timestamp: string;
}

export interface ClaudeData {
	rawPairs: RawPair[];
	timestamp?: string;
	metadata?: Record<string, unknown>;
}

// =============================================================================
// HTML GENERATION TYPES
// =============================================================================

export interface HTMLGenerationData {
	rawPairs: RawPair[];
	timestamp: string;
	title?: string;
	includeAllRequests?: boolean;
}

export interface TemplateReplacements {
	__CLAUDE_LOGGER_BUNDLE_REPLACEMENT_UNIQUE_9487__: string;
	__CLAUDE_LOGGER_DATA_REPLACEMENT_UNIQUE_9487__: string;
	__CLAUDE_LOGGER_TITLE_REPLACEMENT_UNIQUE_9487__: string;
}

// =============================================================================
// FRONTEND TYPES
// =============================================================================

export interface ProcessedConversation {
	id: string;
	model: string;
	messages: unknown[]; // Original message format from API
	system?: unknown; // System prompt
	latestResponse?: string; // Latest assistant response
	pairs: RawPair[]; // All pairs in this conversation
	metadata: {
		startTime: string;
		endTime: string;
		totalPairs: number;
		totalTokens?: number;
		tokenUsage?: {
			input: number;
			output: number;
		};
	};
	rawPairs: RawPair[]; // Keep for compatibility
}

export interface ProcessedMessage {
	role: 'user' | 'assistant' | 'system';
	content: string;
	thinking?: string;
	riffCalls?: RiffCall[];
	metadata?: {
		timestamp: string;
		model?: string;
	};
}

export interface RiffCall {
	id: string;
	type: string;
	name: string;
	input: unknown;
	result?: unknown;
	error?: string;
}

// =============================================================================
// BEDROCK TYPES
// =============================================================================

export interface BedrockBinaryEvent {
	bytes: string; // base64 encoded JSON
	p?: string; // additional payload
}

export interface BedrockInvocationMetrics {
	inputTokenCount: number;
	outputTokenCount: number;
	invocationLatency: number;
	firstByteLatency: number;
	cacheReadInputTokenCount?: number;
	cacheWriteInputTokenCount?: number;
}

// =============================================================================
// GLOBAL DECLARATIONS
// =============================================================================

declare global {
	interface Window {
		claudeData: ClaudeData;
	}
}
