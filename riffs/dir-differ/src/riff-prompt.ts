/**
 * Dir Differ -- RiffPrompt definition
 */
export const riffPrompt = {
	name: 'dir-differ',
	summary: 'Directory and file comparison with color-coded difference output',
	purpose:
		'Compares two directories and displays differences with color-coded terminal output. Shows files unique to each directory, files with changed content, and identical files. Supports content-level diff display, exclusion patterns, and summary-only output. Designed for A/B testing workflows, migration verification, and directory synchronization checks. Automatically excludes common system files (.DS_Store, .git, node_modules).',
	whenToUse: [
		'Comparing two directories to find structural differences (missing or extra files)',
		'Verifying that a migration or conversion produced identical output',
		'A/B testing directory contents after running different processing pipelines',
		'Checking content-level changes between two versions of a document set',
	],
	pipeline: [
		'Validate both input directories exist and are accessible',
		'Scan both directories, applying exclusion patterns',
		'Compare file lists to find files unique to each directory',
		'Compare content of files present in both directories',
		'Display color-coded summary and details (red=only-in-dir1, magenta=only-in-dir2, yellow=changed)',
		'Optionally show line-by-line content differences with --content flag',
		'Exit with code 0 (identical) or 1 (different)',
	],
	parameters: [
		{ name: 'dir1', type: 'string', required: true, description: 'First directory path to compare' },
		{ name: 'dir2', type: 'string', required: true, description: 'Second directory path to compare' },
		{ name: '--content', type: 'flag', required: false, description: 'Show content differences for changed files' },
		{
			name: '--summary-only',
			type: 'flag',
			required: false,
			description: 'Show only the summary without individual file listings',
		},
		{
			name: '--exclude',
			type: 'string',
			required: false,
			description: 'Exclude files matching pattern (can be used multiple times)',
		},
		{ name: '--no-color', type: 'flag', required: false, description: 'Disable colored terminal output' },
		{ name: '-v, --verbose', type: 'flag', required: false, description: 'Enable verbose debug logging' },
	],
	output: 'Color-coded terminal output showing: header with directories and exclusions, summary statistics (file counts, identical, changed, unique), detailed file listings by category, optional content diffs, and final PASS/FAIL result. Exit code 0 means identical, 1 means different.',
	constraints: [
		'Both directories must exist and be readable',
		'Comparison is file-level by default (content comparison requires --content flag)',
		'Default exclusions always apply: .DS_Store, *.md.bak, .git, node_modules',
	],
	conventions: [
		'Use --summary-only for quick pass/fail checks in CI pipelines',
		'Use --content when you need to see exactly what changed within files',
		'Configuration is in config.yaml co-located in the riff directory',
		'Invocation pattern: $RIFF <dir1> <dir2> [options]',
	],
	examples: [
		{
			description: 'Basic directory comparison',
			command: '$RIFF ./expected/ ./actual/',
			outcome: 'Shows summary of differences and lists files unique to each directory or changed between them',
		},
		{
			description: 'Compare with content differences',
			command: '$RIFF ./v1/ ./v2/ --content',
			outcome: 'Shows file-level differences plus line-by-line content changes for modified files',
		},
		{
			description: 'Compare with custom exclusions',
			command: '$RIFF ./src/ ./backup/ --exclude "*.log" --exclude "temp*"',
			outcome: 'Compares directories while ignoring log files and temp files',
		},
	],
};
