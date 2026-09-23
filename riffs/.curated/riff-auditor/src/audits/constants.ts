/**
 * Shared constants for audit modules
 */

// =============================================================================
// SHARED PROVIDER ENVIRONMENT VARIABLES
// =============================================================================

/** Exact provider credential names owned by Aria's provider boundary. */
export const CANONICAL_PROVIDER_KEY_NAMES = new Set([
	'ANTHROPIC_API_KEY',
	'ARIA_GATEWAY_API_KEY',
	'GOOGLE_API_KEY',
	'OPENAI_API_KEY',
	'XAI_API_KEY',
]);

export function isSharedProviderEnvVar(name: string): boolean {
	return CANONICAL_PROVIDER_KEY_NAMES.has(name);
}

// =============================================================================
// SCHEMA EXPORT PATTERNS
// =============================================================================

/**
 * Schema export naming patterns (priority order).
 * Used to find the main config schema export from a riff's schema.ts.
 */
export const SCHEMA_EXPORT_PATTERNS = [
	(pascal: string) => `${pascal}ConfigFileSchema`,
	(pascal: string) => `${pascal}ConfigSchema`,
];
