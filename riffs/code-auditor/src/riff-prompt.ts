/**
 * Code Auditor -- RiffPrompt definition
 */
export const riffPrompt = {
	name: 'code-auditor',
	summary: 'Dependency management and security scanning with safe update and rollback',
	purpose:
		'Audits Node.js project dependencies to find outdated and unused packages, then provides safe update capabilities with automatic backup and rollback on test failure. Creates timestamped backups of package.json and lockfile before any changes, runs the test suite before and after updates, and automatically restores from backup if tests fail. Supports dry-run previews, selective per-dependency updates, dev-only updates, and JSON output for programmatic consumption.',
	whenToUse: [
		'Checking which project dependencies are outdated and by how much',
		'Safely updating dependencies with automatic rollback if tests break',
		'Selectively choosing which dependencies to update via interactive prompts',
		'Updating only devDependencies without touching production dependencies',
		'Generating a JSON audit report for CI/CD pipeline consumption',
	],
	pipeline: [
		'Audit: Run bun pm ls to list installed dependencies',
		'Audit: Run bun outdated to find outdated packages with current/latest versions',
		'Audit: Generate report to console and optionally to JSON files',
		'Update: Create timestamped backup of package.json and lockfile',
		'Update: Run baseline tests to verify current state passes',
		'Update: Apply dependency updates (all, selective, or dev-only)',
		'Update: Run tests again to verify updates did not break anything',
		'Update: Automatically rollback from backup if post-update tests fail',
	],
	parameters: [
		{
			name: 'command',
			type: 'enum(audit|update|status)',
			required: true,
			description:
				'Action: audit lists outdated deps, update applies changes with safety net, status shows environment info',
		},
		{ name: '-j, --json', type: 'flag', required: false, description: 'Output results in JSON format' },
		{
			name: '-d, --dry-run',
			type: 'flag',
			required: false,
			description: 'Preview what would be updated without making changes',
		},
		{
			name: '-s, --selective',
			type: 'flag',
			required: false,
			description: 'Interactively choose which dependencies to update',
		},
		{ name: '--dev-only', type: 'flag', required: false, description: 'Only update devDependencies' },
		{
			name: '--skip-tests',
			type: 'flag',
			required: false,
			description: 'Skip test verification (not recommended)',
		},
		{
			name: '-b, --backup-dir',
			type: 'string',
			required: false,
			description: 'Custom backup directory for package files',
		},
		{
			name: '-t, --test-command',
			type: 'string',
			required: false,
			description: 'Test command to run for verification (default: test)',
		},
		{
			name: '-p, --package-manager',
			type: 'string',
			required: false,
			description: 'Package manager to use (default: bun)',
		},
		{
			name: '-o, --output-dir',
			type: 'string',
			required: false,
			description: 'Custom output directory for audit reports',
		},
		{ name: '-v, --verbose', type: 'flag', required: false, description: 'Enable verbose debug logging' },
	],
	output: 'Audit command outputs dependency status to console (or JSON with --json flag) including lists of installed, outdated, and unused dependencies. Update command outputs progress and results of the update process. JSON reports written to audit-summary.json or update-summary.json when --json is used. Exit code 0 on success, 1 on failure.',
	constraints: [
		'Requires bun as the package manager (configurable via --package-manager)',
		'Must be run from a directory containing package.json',
		'Update operations require a clean working directory',
		'Rollback restores package.json and lockfile but does not undo node_modules changes',
	],
	conventions: [
		'Always run audit before update to understand what will change',
		'Always use --dry-run first when updating to preview changes',
		'Use --selective for active projects where some updates may be risky',
		'Use --dev-only when you only want to update build/test riffing',
		'Configuration is in config.yaml co-located in the riff directory',
		'Invocation pattern: $RIFF [command] [options]',
	],
	examples: [
		{
			description: 'Audit all dependencies',
			command: '$RIFF audit',
			outcome: 'Lists all installed dependencies with their current and latest versions',
		},
		{
			description: 'Preview dependency updates without applying',
			command: '$RIFF update --dry-run',
			outcome: 'Shows what would be updated without making any changes',
		},
		{
			description: 'Safely update with test verification',
			command: '$RIFF update --test-command "bun run test"',
			outcome: 'Creates backup, runs tests, applies updates, re-runs tests, rolls back if tests fail',
		},
	],
};
