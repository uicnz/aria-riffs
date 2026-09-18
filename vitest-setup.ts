import { afterEach, beforeEach, vi } from 'vitest';

const PROVIDER_KEYS = ['ANTHROPIC_API_KEY', 'GOOGLE_API_KEY', 'OPENAI_API_KEY'] as const;

function shadowProviderKeys(): void {
	for (const name of PROVIDER_KEYS) process.env[name] = '';
}

shadowProviderKeys();

beforeEach(() => {
	shadowProviderKeys();
	vi.clearAllMocks();
});

afterEach(() => {
	shadowProviderKeys();
	vi.restoreAllMocks();
});

global.console = {
	...console,
	log: vi.fn(),
	debug: vi.fn(),
	info: vi.fn(),
	warn: vi.fn(),
	error: vi.fn(),
};
