/**
 * HR Staffer -- RiffPrompt definition
 */
export const riffPrompt = {
	name: 'hr-staffer',
	summary: 'Staff directory parsing with org chart generation and semantic search',
	purpose:
		'Parses CSV staff directory files, validates and sanitizes employee data with Zod schemas, builds hierarchical organizational trees, and generates org charts in multiple formats (plain text, Markdown, Mermaid diagrams). Stores employee data in SQLite for querying. Supports decomposing org chart markdown into sections for indexing and semantic search across staff directory data. Mermaid output includes configurable team breakdowns for targeted sub-team diagrams.',
	whenToUse: [
		'Generating org charts from a CSV staff directory export',
		'Visualizing team structure with Mermaid diagrams including sub-team breakdowns',
		'Querying staff data by department, manager, title, or other fields',
		'Indexing and searching org chart content with semantic search',
		'Validating and sanitizing CSV staff directory data before processing',
	],
	pipeline: [
		'Parse CSV staff directory file validating the exact 11-column structure',
		'Sanitize data: trim whitespace, normalize manager references, fix name mismatches',
		'Validate employee data: check for duplicates, circular references, orphaned employees, single root',
		'Build hierarchical organizational tree from manager relationships',
		'Store employee data in SQLite database',
		'Generate output formats: plain text (indented tree), Markdown (headings), Mermaid (diagrams with team breakdowns)',
		'For search: decompose org chart markdown into sections, index with embeddings, and enable semantic search',
	],
	parameters: [
		{
			name: 'csvFile',
			type: 'string',
			required: false,
			description: 'Path to CSV staff directory file (positional argument, defaults to config path)',
		},
		{ name: '-c, --config', type: 'string', required: false, description: 'Path to config file' },
		{
			name: '-o, --output',
			type: 'string',
			required: false,
			description: 'Output directory for generated files (overrides config)',
		},
		{ name: '--text-only', type: 'flag', required: false, description: 'Generate only text output' },
		{ name: '--markdown-only', type: 'flag', required: false, description: 'Generate only markdown output' },
		{ name: '--mermaid-only', type: 'flag', required: false, description: 'Generate only mermaid diagram' },
		{ name: '--no-title', type: 'flag', required: false, description: 'Exclude job titles from output' },
		{ name: '--no-department', type: 'flag', required: false, description: 'Exclude departments from output' },
		{ name: '--include-email', type: 'flag', required: false, description: 'Include email addresses in output' },
		{ name: '--max-depth', type: 'number', required: false, description: 'Maximum tree depth to display' },
	],
	output: 'Multiple files in the output directory: org-chart.txt (plain text hierarchy), org-chart.md (Markdown with headings), org-chart.mermaid (combined Mermaid diagram), executive-leadership.mermaid (top-level diagram), and individual team-{leader}.mermaid files. SQLite database with employee records. For search: ranked results from indexed org chart content.',
	constraints: [
		'Input CSV must have exactly 11 columns in the required order: Display Name, First Name, Last Name, Email Address, Title, Department, Manager, Mobile, Street Address, City, Country',
		'Column headers must match exactly (case-sensitive)',
		'Display Name and Email Address must be unique across all employees',
		'Manager field must reference an existing Display Name or be "No Manager" for the root employee',
		'Exactly one root employee (No Manager) is required',
		'No circular reporting relationships allowed',
	],
	conventions: [
		'Configuration is in config.yaml co-located in the riff directory',
		'Team breakdowns for Mermaid are configured in the mermaid.breakDownTeams section',
		'Embedding provider is configurable: openai, gemini, or ollama',
		'Invocation pattern: $RIFF [csvFile] [options]',
		'Run without arguments to use the CSV path from config',
	],
	examples: [
		{
			description: 'Generate org charts from staff directory',
			command: '$RIFF sources/cello/staff/cello-staff-active-directory.csv',
			outcome:
				'Creates org-chart.txt, org-chart.md, and Mermaid diagram files in the configured output directory',
		},
		{
			description: 'Generate only Mermaid diagrams limited to 3 levels',
			command: '$RIFF sources/staff.csv --mermaid-only --max-depth 3',
			outcome: 'Creates Mermaid diagram files showing only the top 3 levels of the org hierarchy',
		},
		{
			description: 'Search indexed org chart content',
			command: '$RIFF search "engineering team leads"',
			outcome: 'Returns relevant org chart sections matching the query about engineering team leadership',
		},
	],
};
