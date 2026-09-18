const foreignBrandWord = 'Claude';
const foreignCodingCliName = `${foreignBrandWord} Code`;

/**
 * Prompt Tracer -- RiffPrompt definition
 */
export const riffPrompt = {
	name: 'prompt-tracer',
	summary: 'Anthropic coding CLI system prompt extraction and version comparison',
	purpose: `Extracts and captures upstream coding CLI system prompts, user message formats, and available riffs from any installed or npm-published version. Works by downloading the specified ${foreignCodingCliName} version from npm, patching the version check to prevent auto-updates, running with an integrated traffic interceptor to capture API requests, and parsing the captured data to extract system prompt content. Supports comparing prompts across versions, testing custom/local builds, and building a version history trace database in JSONL format.`,
	whenToUse: [
		'Extracting the system prompt and riffs list from the current or a specific upstream CLI version',
		'Comparing system prompts between two upstream CLI versions to see what changed',
		'Testing a local/custom upstream CLI build to inspect its prompt configuration',
		'Building a historical record of upstream prompt evolution across releases',
	],
	pipeline: [
		'Download specified upstream CLI version from npm (or use --binary-path for custom builds)',
		'Patch version check to prevent auto-update interference',
		'Launch the upstream CLI with integrated traffic interceptor',
		'Send a test haiku request to trigger an API call',
		'Capture the API request/response including system prompt and riff definitions',
		'Parse captured data to extract user message format, system prompt, and riffs (excluding MCP riffs)',
		'Save trace to JSONL file (append mode by default) and Markdown report with timestamp',
	],
	parameters: [
		{
			name: 'version',
			type: 'string',
			required: false,
			description: 'Upstream CLI version to extract (e.g., 2.0.0). Uses the system-installed version if omitted',
		},
		{
			name: '--latest',
			type: 'flag',
			required: false,
			description: 'Extract all versions from specified version to latest',
		},
		{
			name: '--binary-path',
			type: 'string',
			required: false,
			description: 'Path to a custom upstream CLI binary (skips npm download)',
		},
		{
			name: '--claude-args',
			type: 'string',
			required: false,
			description: 'Additional arguments to pass to the upstream CLI',
		},
		{
			name: '--separate-trace',
			type: 'flag',
			required: false,
			description: 'Create separate timestamped trace file instead of appending to the main file',
		},
		{ name: '-v, --verbose', type: 'flag', required: false, description: 'Enable verbose debug output' },
	],
	output: 'JSONL trace file at .aria/db/prompt-tracer/prompt-tracer.jsonl (or timestamped separate file) containing the raw API capture. Markdown report at the configured output directory containing the user message format, system prompt text, and available riffs with descriptions and schemas.',
	constraints: [
		'Must be logged in to the upstream CLI (authentication required)',
		'Each version extraction sends one API request to the provider (may incur costs)',
		'Shell commands are sanitized via shell-quote to prevent injection',
		'Existing output files are skipped to avoid redundant API calls',
	],
	conventions: [
		'Use --separate-trace when capturing many versions to keep individual trace files',
		'Default append mode builds up a consolidated trace database in a single JSONL file',
		'Compare Markdown output files across versions to track prompt changes',
		'Use --binary-path for testing local development builds',
		'Configuration is in config.yaml co-located in the riff directory',
		'Invocation pattern: $RIFF [version] [options]',
	],
	examples: [
		{
			description: 'Extract prompts from the system-installed upstream CLI',
			command: '$RIFF',
			outcome:
				'Captures system prompt and riffs from the currently installed version, saves trace and Markdown report',
		},
		{
			description: 'Extract from a specific version',
			command: '$RIFF 2.0.0',
			outcome: 'Downloads the specified upstream CLI version from npm, extracts prompts, and saves results',
		},
		{
			description: 'Extract all versions from 2.0.0 to latest',
			command: '$RIFF 2.0.0 --latest',
			outcome: 'Iterates through all published versions from 2.0.0 onward, extracting prompts from each',
		},
	],
};
