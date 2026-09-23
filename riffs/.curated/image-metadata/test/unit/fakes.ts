/**
 * Fake implementations for testing
 * These provide real working implementations that are easier to test with than mocks
 */

import type { Logger } from 'pino';
import { vi } from 'vitest';
import type { LLMClient, ModelInfo } from '../../src/lib/types.js';
import { ProgressLogger } from '../../src/utils/progress-logger.js';

/**
 * Creates a mock Pino logger for tests
 */
export function createMockLogger(): Logger {
	return {
		info: vi.fn(),
		debug: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		fatal: vi.fn(),
		trace: vi.fn(),
		silent: vi.fn(),
		level: 'info',
		child: vi.fn(),
	} as unknown as Logger;
}

/**
 * Creates a mock ProgressLogger for tests
 */
export function createMockProgressLogger(): ProgressLogger {
	const mock = new ProgressLogger();
	mock.log = vi.fn();
	mock.warn = vi.fn();
	mock.error = vi.fn();
	mock.setProgressBar = vi.fn();
	mock.start = vi.fn();
	mock.update = vi.fn();
	mock.stop = vi.fn();
	return mock;
}

export class FakeDatabaseManager {
	private storage = new Map<string, { description: string; created_at: string; updated_at: string }>();

	async getDescription(filePath: string): Promise<string | null> {
		const record = this.storage.get(filePath);
		return record?.description ?? null;
	}

	async saveDescription(filePath: string, description: string): Promise<void> {
		const now = new Date().toISOString();
		const existing = this.storage.get(filePath);
		this.storage.set(filePath, {
			description,
			created_at: existing?.created_at ?? now,
			updated_at: now,
		});
	}

	async countRecords(): Promise<number> {
		return this.storage.size;
	}

	async getAllDescriptions() {
		return Array.from(this.storage.entries()).map(([file_path, data]) => ({
			file_path,
			...data,
		}));
	}

	async close(): Promise<void> {
		this.storage.clear();
	}

	get databasePath(): string {
		return ':memory:';
	}

	// Test helpers for inspection
	getStoredDescriptions(): Map<string, string> {
		const result = new Map<string, string>();
		for (const [path, record] of this.storage) {
			result.set(path, record.description);
		}
		return result;
	}

	hasDescription(filePath: string): boolean {
		return this.storage.has(filePath);
	}
}

export class FakeLLMClient implements LLMClient {
	private descriptions = new Map<string, string>();
	modelName = 'fake-model';
	endpointUrl = 'http://fake';

	async generateDescription(imagePath: string): Promise<string> {
		return this.descriptions.get(imagePath) ?? `Generated description for ${imagePath}`;
	}

	async testConnection(): Promise<boolean> {
		return true;
	}

	async listModels(): Promise<ModelInfo[]> {
		return [{ name: 'fake-model' }];
	}

	// Test helpers
	setDescription(imagePath: string, description: string): void {
		this.descriptions.set(imagePath, description);
	}

	getCallCount(): number {
		return this.descriptions.size;
	}
}
