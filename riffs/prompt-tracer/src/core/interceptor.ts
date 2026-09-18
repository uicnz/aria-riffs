import fs from 'node:fs';
import type { ClientRequest, IncomingMessage, RequestOptions } from 'node:http';
import path from 'node:path';
import type { Logger } from 'pino';
import pino from 'pino';
import type { RawPair } from '../lib/types.js';

type FetchResponse = Awaited<ReturnType<typeof globalThis.fetch>>;
type ClonedFetchResponse = ReturnType<FetchResponse['clone']>;

export interface InterceptorConfig {
	logDirectory?: string;
	logBaseName?: string;
}

export class ClaudeTrafficLogger {
	private logDir: string;
	private logFile: string;
	private pendingRequests: Map<string, unknown> = new Map();
	private pairs: RawPair[] = [];
	private config: InterceptorConfig;
	private logger: Logger;

	constructor(config: InterceptorConfig = {}) {
		this.config = {
			logDirectory: '.prompt-tracer',
			...config,
		};

		// Create a minimal logger for the interceptor (runs in Claude's process)
		this.logger = pino({
			level: process.env.PROMPT_TRACER_DEBUG === 'true' ? 'debug' : 'info',
		});

		// Create log directory if it doesn't exist
		this.logDir = this.config.logDirectory ?? '.prompt-tracer';
		if (!fs.existsSync(this.logDir)) {
			fs.mkdirSync(this.logDir, { recursive: true });
		}

		// Generate trace filename from config or environment
		const traceBaseName = config?.logBaseName || process.env.PROMPT_TRACER_TRACE_NAME;
		const fileBaseName =
			traceBaseName || `trace-${new Date().toISOString().replace(/[:.]/g, '-').replace('T', '-').slice(0, -5)}`; // Remove milliseconds and Z

		this.logFile = path.join(this.logDir, `${fileBaseName}.jsonl`);

		// Create log file if it doesn't exist (but don't clear if it does - we append)
		if (!fs.existsSync(this.logFile)) {
			fs.writeFileSync(this.logFile, '');
		}

		this.logger.debug({ logFile: path.resolve(this.logFile) }, 'Traffic log initialized');
	}

	private isClaudeAPI(url: string | URL): boolean {
		const urlString = typeof url === 'string' ? url : url.toString();
		const includeAllRequests = process.env.PROMPT_TRACER_INCLUDE_ALL_REQUESTS === 'true';

		// Support custom PROMPT_TRACER_ANTHROPIC_BASE_URL
		const baseUrl = process.env.PROMPT_TRACER_ANTHROPIC_BASE_URL || 'https://api.anthropic.com';
		const apiHost = new URL(baseUrl).hostname;

		// Check for direct Anthropic API calls
		const isAnthropicAPI = urlString.includes(apiHost);

		// Check for AWS Bedrock Claude API calls
		const isBedrockAPI = urlString.includes('bedrock-runtime.') && urlString.includes('.amazonaws.com');

		if (includeAllRequests) {
			return isAnthropicAPI || isBedrockAPI; // Capture all Claude API requests
		}

		return (isAnthropicAPI && urlString.includes('/v1/messages')) || isBedrockAPI;
	}

	private generateRequestId(): string {
		return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
	}

	private redactSensitiveHeaders(headers: Record<string, string>): Record<string, string> {
		const redactedHeaders = { ...headers };
		const sensitiveKeys = [
			'authorization',
			'x-api-key',
			'x-auth-token',
			'cookie',
			'set-cookie',
			'x-session-token',
			'x-access-token',
			'bearer',
			'proxy-authorization',
		];

		for (const key of Object.keys(redactedHeaders)) {
			const lowerKey = key.toLowerCase();
			if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
				// Keep first 10 chars and last 4 chars, redact middle
				const value = redactedHeaders[key];
				if (value && value.length > 14) {
					redactedHeaders[key] = `${value.substring(0, 10)}...${value.slice(-4)}`;
				} else if (value && value.length > 4) {
					redactedHeaders[key] = `${value.substring(0, 2)}...${value.slice(-2)}`;
				} else {
					redactedHeaders[key] = '[REDACTED]';
				}
			}
		}

		return redactedHeaders;
	}

	private cloneResponse(response: FetchResponse): ClonedFetchResponse {
		// Clone the response to avoid consuming the body
		return response.clone();
	}

	private async parseRequestBody(body: unknown): Promise<unknown> {
		if (!body) return null;

		if (typeof body === 'string') {
			try {
				return JSON.parse(body);
			} catch {
				return body;
			}
		}

		if (body instanceof FormData) {
			const formObject: Record<string, unknown> = {};
			for (const [key, value] of Array.from(body as unknown as Iterable<[string, unknown]>)) {
				formObject[key] = value;
			}
			return formObject;
		}

		return body;
	}

	private async parseResponseBody(response: ClonedFetchResponse): Promise<{ body?: unknown; body_raw?: string }> {
		const contentType = response.headers.get('content-type') || '';

		try {
			if (contentType.includes('application/json')) {
				const body = await response.json();
				return { body };
			} else if (contentType.includes('text/event-stream')) {
				const body_raw = await response.text();
				return { body_raw };
			} else if (contentType.includes('text/')) {
				const body_raw = await response.text();
				return { body_raw };
			} else {
				// For other types, try to read as text
				const body_raw = await response.text();
				return { body_raw };
			}
		} catch (_error) {
			// Silent error handling during runtime
			return {};
		}
	}

	public instrumentAll(): void {
		this.instrumentFetch();
		this.instrumentNodeHTTP();
	}

	public instrumentFetch(): void {
		if (!globalThis.fetch) {
			// Silent - fetch not available
			return;
		}

		// Check if already instrumented by checking for our marker
		if (
			(globalThis.fetch as unknown as typeof globalThis.fetch & { __claudeTraceInstrumented?: boolean })
				.__claudeTraceInstrumented
		) {
			return;
		}

		const originalFetch = globalThis.fetch;

		const instrumentedFetch = async (
			input: Parameters<typeof originalFetch>[0],
			init: Parameters<typeof originalFetch>[1] = {}
		): Promise<FetchResponse> => {
			// Convert input to URL for consistency
			const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

			// Only intercept Claude API calls
			if (!this.isClaudeAPI(url)) {
				return originalFetch(input, init);
			}

			const requestId = this.generateRequestId();
			const requestTimestamp = Date.now();

			// Capture request details
			const requestData = {
				timestamp: requestTimestamp / 1000, // Convert to seconds (like Python version)
				method: init.method || 'GET',
				url: url,
				headers: this.redactSensitiveHeaders(
					Object.fromEntries(
						Array.from(new Headers(init.headers || {}) as unknown as Iterable<[string, string]>)
					)
				),
				body: await this.parseRequestBody(init.body),
			};

			// Store pending request
			this.pendingRequests.set(requestId, requestData);

			try {
				// Make the actual request
				const response = await originalFetch(input, init);
				const responseTimestamp = Date.now();

				// Clone response to avoid consuming the body
				const clonedResponse = await this.cloneResponse(response);

				// Parse response body
				const responseBodyData = await this.parseResponseBody(clonedResponse);

				// Create response data
				const responseData = {
					timestamp: responseTimestamp / 1000,
					status_code: response.status,
					headers: this.redactSensitiveHeaders(
						Object.fromEntries(Array.from(response.headers as unknown as Iterable<[string, string]>))
					),
					...responseBodyData,
				};

				// Create paired request-response object
				const pair: RawPair = {
					request: requestData,
					response: responseData,
					logged_at: new Date().toISOString(),
				};

				// Remove from pending and add to pairs
				this.pendingRequests.delete(requestId);
				this.pairs.push(pair);

				// Write to log file
				await this.writePairToLog(pair);

				return response;
			} catch (error) {
				// Remove from pending requests on error
				this.pendingRequests.delete(requestId);
				throw error;
			}
		};

		globalThis.fetch = Object.assign(instrumentedFetch, {
			preconnect: originalFetch.preconnect.bind(originalFetch),
		});

		// Mark fetch as instrumented
		(
			globalThis.fetch as unknown as typeof globalThis.fetch & { __claudeTraceInstrumented?: boolean }
		).__claudeTraceInstrumented = true;

		// Silent initialization
	}

	public instrumentNodeHTTP(): void {
		try {
			const http = require('node:http');
			const https = require('node:https');

			// Instrument http.request
			if (
				http.request &&
				!(http.request as unknown as typeof http.request & { __claudeTraceInstrumented?: boolean })
					.__claudeTraceInstrumented
			) {
				const originalHttpRequest = http.request;
				http.request = (options: RequestOptions | string | URL, callback?: (res: IncomingMessage) => void) =>
					this.interceptNodeRequest(originalHttpRequest, options, callback, false);
				(
					http.request as unknown as typeof http.request & { __claudeTraceInstrumented?: boolean }
				).__claudeTraceInstrumented = true;
			}

			// Instrument http.get
			if (
				http.get &&
				!(http.get as unknown as typeof http.get & { __claudeTraceInstrumented?: boolean })
					.__claudeTraceInstrumented
			) {
				const originalHttpGet = http.get;
				http.get = (options: RequestOptions | string | URL, callback?: (res: IncomingMessage) => void) =>
					this.interceptNodeRequest(originalHttpGet, options, callback, false);
				(
					http.get as unknown as typeof http.get & { __claudeTraceInstrumented?: boolean }
				).__claudeTraceInstrumented = true;
			}

			// Instrument https.request
			if (
				https.request &&
				!(https.request as unknown as typeof https.request & { __claudeTraceInstrumented?: boolean })
					.__claudeTraceInstrumented
			) {
				const originalHttpsRequest = https.request;
				https.request = (options: RequestOptions | string | URL, callback?: (res: IncomingMessage) => void) =>
					this.interceptNodeRequest(originalHttpsRequest, options, callback, true);
				(
					https.request as unknown as typeof https.request & { __claudeTraceInstrumented?: boolean }
				).__claudeTraceInstrumented = true;
			}

			// Instrument https.get
			if (
				https.get &&
				!(https.get as unknown as typeof https.get & { __claudeTraceInstrumented?: boolean })
					.__claudeTraceInstrumented
			) {
				const originalHttpsGet = https.get;
				https.get = (options: RequestOptions | string | URL, callback?: (res: IncomingMessage) => void) =>
					this.interceptNodeRequest(originalHttpsGet, options, callback, true);
				(
					https.get as unknown as typeof https.get & { __claudeTraceInstrumented?: boolean }
				).__claudeTraceInstrumented = true;
			}
		} catch (_error) {
			// Silent error handling
		}
	}

	private interceptNodeRequest(
		originalRequest: (...args: unknown[]) => ClientRequest,
		options: RequestOptions | string | URL,
		callback: ((res: IncomingMessage) => void) | undefined,
		isHttps: boolean
	): ClientRequest {
		// Parse URL from options
		const url = this.parseNodeRequestURL(options, isHttps);

		if (!this.isClaudeAPI(url)) {
			return originalRequest.call(this, options, callback);
		}

		const requestTimestamp = Date.now();
		let requestBody = '';

		// Create the request
		const req = originalRequest.call(this, options, (res: IncomingMessage) => {
			const responseTimestamp = Date.now();
			let responseBody = '';

			// Capture response data
			res.on('data', (chunk: Buffer | string) => {
				responseBody += chunk;
			});

			res.on('end', async () => {
				// Process the captured request/response
				const method = typeof options === 'object' && 'method' in options ? options.method || 'GET' : 'GET';
				const headers =
					typeof options === 'object' && 'headers' in options
						? (options.headers as Record<string, string>)
						: {};

				const requestData = {
					timestamp: requestTimestamp / 1000,
					method,
					url: url,
					headers: this.redactSensitiveHeaders(headers),
					body: requestBody ? await this.parseRequestBody(requestBody) : null,
				};

				// Convert IncomingHttpHeaders to Record<string, string>
				const responseHeaders: Record<string, string> = {};
				for (const [key, value] of Object.entries(res.headers)) {
					if (value) {
						responseHeaders[key] = Array.isArray(value) ? value.join(', ') : value;
					}
				}

				const responseData = {
					timestamp: responseTimestamp / 1000,
					status_code: res.statusCode || 0,
					headers: this.redactSensitiveHeaders(responseHeaders),
					...(await this.parseResponseBodyFromString(
						responseBody,
						typeof res.headers['content-type'] === 'string' ? res.headers['content-type'] : undefined
					)),
				};

				const pair: RawPair = {
					request: requestData,
					response: responseData,
					logged_at: new Date().toISOString(),
				};

				this.pairs.push(pair);
				await this.writePairToLog(pair);
			});

			// Call original callback if provided
			if (callback) {
				callback(res);
			}
		});

		// Capture request body
		const originalWrite = req.write.bind(req);
		req.write = (
			chunk: Buffer | string | Uint8Array,
			encodingOrCallback?: BufferEncoding | ((error: Error | null | undefined) => void),
			callback?: (error: Error | null | undefined) => void
		) => {
			if (chunk) {
				requestBody += chunk;
			}
			return originalWrite(chunk, encodingOrCallback as BufferEncoding, callback);
		};

		return req;
	}

	private parseNodeRequestURL(options: RequestOptions | string | URL, isHttps: boolean): string {
		if (typeof options === 'string') {
			return options;
		}

		if (options instanceof URL) {
			return options.toString();
		}

		const protocol = isHttps ? 'https:' : 'http:';
		const hostname = options.hostname || options.host || 'localhost';
		const port = options.port ? `:${options.port}` : '';
		const pathname = options.path || '/';

		return `${protocol}//${hostname}${port}${pathname}`;
	}

	private async parseResponseBodyFromString(
		body: string,
		contentType?: string
	): Promise<{ body?: unknown; body_raw?: string }> {
		try {
			if (contentType?.includes('application/json')) {
				return { body: JSON.parse(body) };
			} else if (contentType?.includes('text/event-stream')) {
				return { body_raw: body };
			} else {
				return { body_raw: body };
			}
		} catch (_error) {
			return { body_raw: body };
		}
	}

	private async writePairToLog(pair: RawPair): Promise<void> {
		try {
			const jsonLine = `${JSON.stringify(pair)}\n`;
			fs.appendFileSync(this.logFile, jsonLine);
		} catch (_error) {
			// Silent error handling during runtime
		}
	}

	public cleanup(): void {
		this.logger.debug({ orphanedCount: this.pendingRequests.size }, 'Cleaning up orphaned requests');

		for (const [, requestData] of this.pendingRequests.entries()) {
			const orphanedPair = {
				request: requestData,
				response: null,
				note: 'ORPHANED_REQUEST - No matching response received',
				logged_at: new Date().toISOString(),
			};

			try {
				const jsonLine = `${JSON.stringify(orphanedPair)}\n`;
				fs.appendFileSync(this.logFile, jsonLine);
			} catch (error) {
				this.logger.error({ error: String(error) }, 'Error writing orphaned request');
			}
		}

		this.pendingRequests.clear();
		this.logger.info({ totalPairs: this.pairs.length }, 'Traffic logging cleanup complete');
	}

	public getStats() {
		return {
			totalPairs: this.pairs.length,
			pendingRequests: this.pendingRequests.size,
			logFile: this.logFile,
		};
	}
}

// Global logger instance
let globalLogger: ClaudeTrafficLogger | null = null;

// Track if event listeners have been set up
let eventListenersSetup = false;

export function initializeInterceptor(config?: InterceptorConfig): ClaudeTrafficLogger {
	if (globalLogger) {
		return globalLogger;
	}

	globalLogger = new ClaudeTrafficLogger(config);
	globalLogger.instrumentAll();

	// Setup cleanup on process exit only once
	if (!eventListenersSetup) {
		const cleanup = () => {
			if (globalLogger) {
				globalLogger.cleanup();
			}
		};

		process.on('exit', cleanup);
		process.on('SIGINT', cleanup);
		process.on('SIGTERM', cleanup);
		process.on('uncaughtException', _error => {
			// Uncaught exception handled by process listener
			cleanup();
			process.exit(1);
		});

		eventListenersSetup = true;
	}

	return globalLogger;
}

export function getLogger(): ClaudeTrafficLogger | null {
	return globalLogger;
}
