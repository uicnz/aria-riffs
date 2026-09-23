import type { Logger } from 'pino';
import { vi } from 'vitest';

/**
 * Create a mock Pino logger for tests.
 * All methods are vi.fn() stubs that can be asserted on.
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
