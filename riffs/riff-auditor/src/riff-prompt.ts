/**
 * Riff Auditor -- RiffPrompt definition
 */
export const riffPrompt = {
	name: 'riff-auditor',
	summary: 'Riff configuration auditing and structural parity enforcement across all Aria riffs',
	purpose:
		'Runs comprehensive health checks on all riffs in the Aria monorepo to enforce structural and semantic parity. Every riff must follow the canonical directory layout, config shape, schema patterns, CLI structure, environment handling, logging, standalone Bun package identity, dependency policy, and tsconfig. Dependency auditing checks package-local runtime declarations against current registry releases and verifies shared-version parity without moving Riff dependencies to the workspace root. Outputs a JSON report categorizing each riff as healthy, issues, or unhealthy.',
	whenToUse: [
		'Verifying all riffs conform to Aria structural parity standards after refactoring',
		'Checking a single riff for compliance issues before committing changes',
		'Running in CI/CD with --strict to fail the build on any non-healthy Riff',
		'Listing all discovered riffs and their config status',
		'Generating a comprehensive JSON audit report for review',
	],
	pipeline: [
		'Discover all riff directories under riffs/',
		'For each riff, enforce canonical wiring and prompt contracts, then run enabled audit categories (config, schema, cli, env, logger, source, structure, tui, scripts, dependencies, tsconfig, paths, validation)',
		'Wiring audit: verify the canonical files, package identity, package shape, binary, version, and metadata description parity',
		'Prompt audit: validate the exact Aria Riff prompt schema, Riff name, and $RIFF invocation placeholder',
		'Config audit: verify config.yaml has riff wrapper, aria-riff metadata, logging peer, camelCase keys',
		'Schema audit: verify schema.ts has riff wrapper, LoggingConfigSchema, proper defaults, no .strict() on root',
		'CLI audit: verify createProgram() factory function, execution guard, no module-level instantiation',
		'Env audit: verify config.ts uses schema, proper env prefix, bracket notation, ConfigError class',
		'Structure audit: verify src/core/, src/lib/, test/unit/, test/integration/ directories exist with content',
		'TSConfig audit: verify tsconfig.json matches canonical version exactly (standalone, no extends)',
		'Dependency audit: verify standalone Bun identity, sorted package-local dependencies, shared-version parity, and current releases',
		'Apply explicit canonical rules uniformly; no Riff exclusions or majority-derived standards are permitted',
		'Categorize each riff as healthy (no issues), issues (minor), or unhealthy (missing requirements)',
		'Write JSON report to configured output directory',
	],
	parameters: [
		{
			name: 'command',
			type: 'enum(audit|check|list)',
			required: false,
			description:
				'Action: audit runs full check on all riffs (default), check audits a single riff, list shows discovered riffs',
		},
		{
			name: 'riff',
			type: 'string',
			required: false,
			description: 'Riff name for the check command (e.g., doc-converter)',
		},
		{ name: '-c, --config', type: 'string', required: false, description: 'Path to custom config file' },
		{ name: '-o, --output', type: 'string', required: false, description: 'Output directory for the JSON report' },
		{
			name: '--json',
			type: 'flag',
			required: false,
			description: 'Output JSON to stdout (suppresses console logging)',
		},
		{
			name: '--strict',
			type: 'flag',
			required: false,
			description: 'Exit with code 1 if any Riff is not healthy (for CI)',
		},
		{ name: '-v, --verbose', type: 'flag', required: false, description: 'Enable verbose debug logging' },
	],
	output: 'JSON report at .aria/audits/riff-auditor.json with full audit details for every Riff. Console output shows per-Riff health status (healthy/issues/unhealthy) with specific issue descriptions. With --json flag, outputs structured JSON to stdout. Exit code 1 in --strict mode when any Riff is not healthy.',
	constraints: [
		'Must be run from the Aria monorepo root directory',
		'Requires riffs/ directory with at least one riff present',
		'TSConfig canonical comparison is based on the version defined in riffs/riff-auditor/src/audits/tsconfig-audit.ts',
	],
	conventions: [
		'Run after any refactoring pass to verify structural parity is maintained',
		'Use check <riff-name> for quick single-riff verification during development',
		'Use --strict in CI/CD pipelines to enforce compliance',
		'Use --json for programmatic consumption of audit results',
		'Canonical rules apply to every discovered Riff without exclusions',
		'Invocation pattern: $RIFF [command] [options]',
	],
	examples: [
		{
			description: 'Run full audit on all riffs',
			command: '$RIFF audit',
			outcome: 'Audits every riff in the monorepo, writes JSON report, and logs per-riff health status',
		},
		{
			description: 'Check a single riff for compliance',
			command: '$RIFF check doc-converter',
			outcome: 'Audits only doc-converter and reports its health status and any issues found',
		},
		{
			description: 'CI/CD strict mode with JSON output',
			command: '$RIFF audit --strict --json',
			outcome: 'Outputs full audit as JSON to stdout and exits with code 1 if any Riff is not healthy',
		},
	],
};
