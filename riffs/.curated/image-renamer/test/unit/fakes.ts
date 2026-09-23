/**
 * Test fakes and mock helpers for image-renamer tests
 */

import type { Logger } from 'pino';
import { vi } from 'vitest';

/**
 * Create a mock Pino logger for testing.
 * All methods are no-op vi.fn() mocks.
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
		child: vi.fn().mockReturnThis(),
	} as unknown as Logger;
}
