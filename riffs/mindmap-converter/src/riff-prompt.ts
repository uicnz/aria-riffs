/**
 * Mindmap Converter -- RiffPrompt definition
 */
export const riffPrompt = {
	name: 'mindmap-converter',
	summary: 'OPML and FreeMind mindmap to Markdown and JSONL conversion',
	purpose:
		'Converts hierarchical mindmap files (OPML and FreeMind .mm format) into clean, well-structured Markdown documents. Preserves the mindmap hierarchy using proper heading levels (h1-h6) and switches to bullet points after the maximum heading depth. Also supports batch processing with JSONL export for portable, searchable storage, and SQLite database storage for querying. Output follows project Markdown standards including blank lines around headings (MD022), proper list formatting (MD032), and single trailing newline (MD047).',
	whenToUse: [
		'Converting OPML mindmap exports into readable Markdown documentation',
		'Converting FreeMind (.mm) mindmap files into Markdown',
		'Batch processing a directory of mindmap files into Markdown with preserved directory structure',
		'Exporting mindmaps to JSONL format for searchable, appendable storage',
		'Building a mindmap knowledge base with SQLite database storage for querying',
		'Validating mindmap file structure before conversion',
	],
	pipeline: [
		'Auto-detect input format from file extension (.opml or .mm) or use --format flag',
		'Parse XML structure using fast-xml-parser',
		'Build hierarchical node tree from parsed data',
		'Convert tree to Markdown using heading levels (h1 through configurable max, default h6)',
		'Switch to bullet points for nodes beyond the maximum heading level',
		'Apply project Markdown standards (blank lines around headings, proper list formatting)',
		'Write output Markdown file with single trailing newline',
		'Optionally store results in SQLite database and/or export to JSONL',
	],
	parameters: [
		{
			name: 'command',
			type: 'enum(convert|validate|batch|export|export-jsonl|jsonl-search|db-stats|db-list|db-search)',
			required: true,
			description: 'Action to perform',
		},
		{
			name: 'input',
			type: 'string',
			required: true,
			description: 'Path to input mindmap file (.opml or .mm) or directory for batch processing',
		},
		{
			name: 'output',
			type: 'string',
			required: false,
			description: 'Path for output Markdown file or output directory',
		},
		{
			name: '-f, --format',
			type: 'enum(opml|mm)',
			required: false,
			description: 'Input format, auto-detected from extension if not specified',
		},
		{
			name: '-m, --max-heading',
			type: 'number',
			required: false,
			description: 'Maximum heading level before switching to bullets (1-6, default: 6)',
		},
		{
			name: '--no-bullets',
			type: 'flag',
			required: false,
			description: 'Disable bullet points after max heading level',
		},
		{
			name: '--no-hierarchy',
			type: 'flag',
			required: false,
			description: 'Flatten hierarchy instead of preserving it',
		},
		{ name: '-v, --verbose', type: 'flag', required: false, description: 'Enable verbose debug output' },
	],
	output: 'Markdown file(s) with proper heading hierarchy and formatting. For batch mode, preserves source directory structure. JSONL export produces one JSON record per line with complete tree structure. Database commands output query results to stdout.',
	constraints: [
		'Input must be valid OPML or FreeMind XML format',
		'Maximum heading depth is 6 levels (h1-h6) before switching to bullet points',
		'OPML is the recommended format over FreeMind for portability',
		'Existing output files are not overwritten by default (configurable)',
	],
	conventions: [
		'Use validate command to check file structure before converting',
		'Use OPML format over FreeMind when possible for better portability',
		'Use batch command for processing entire directories with database tracking',
		'JSONL exports append by default - use --no-append to overwrite',
		'Configuration is in config.yaml co-located in the riff directory',
		'Invocation pattern: $RIFF [command] [args]',
	],
	examples: [
		{
			description: 'Convert an OPML file to Markdown',
			command: '$RIFF convert input.opml output.md',
			outcome: 'Creates output.md with headings reflecting the mindmap hierarchy',
		},
		{
			description: 'Convert with limited heading depth',
			command: '$RIFF convert input.opml --max-heading 3 --verbose',
			outcome: 'Uses h1-h3 headings then switches to bullet points for deeper nodes',
		},
		{
			description: 'Export directory of mindmaps to JSONL',
			command: '$RIFF export-jsonl sources/mindmaps',
			outcome: 'Appends all mindmap structures to the master JSONL file for searchable storage',
		},
	],
};
