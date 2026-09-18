/**
 * Doc Indexer -- RiffPrompt definition
 */
export const riffPrompt = {
	name: 'doc-indexer',
	summary: 'Document indexing with hybrid semantic/lexical search and knowledge graph generation',
	purpose:
		'Indexes markdown documents into a SQLite database with OpenAI embeddings for semantic search and FTS5 for lexical search. Implements a multi-pass retrieval system with Reciprocal Rank Fusion (RRF) combining semantic, lexical OR, synonym expansion, and phrase proximity passes. Generates interactive knowledge graph visualizations. Supports both general document indexing and specialized RFP parsing with configurable requirement patterns, metadata extraction, and domain-specific query expansion.',
	whenToUse: [
		'Indexing decomposed RFP responses or general markdown documents for semantic search',
		'Searching indexed documents with hybrid semantic and lexical matching',
		'Generating interactive knowledge graphs showing document relationships',
		'Creating HTML visualizations for exploring document collections',
		'Performing filtered searches by category, department, priority, or identifier',
		'Exporting search results as JSON for programmatic consumption',
	],
	pipeline: [
		'Parse markdown documents extracting metadata, content sections, and identifiers',
		'Enrich content with contextual embedding prefixes, abbreviation injection, and domain keyword extraction',
		'Generate OpenAI embeddings for each document section',
		'Store documents, embeddings, and FTS5 index in SQLite database',
		'For search: execute four-pass retrieval (semantic, lexical OR, synonym expansion, phrase proximity)',
		'Fuse results using RRF with configurable scoring weights',
		'For graph: export document relationships as JSON and generate interactive HTML viewer',
	],
	parameters: [
		{
			name: 'command',
			type: 'enum(index|search|graph|graph:html|graph:validate|tui)',
			required: true,
			description: 'Subcommand to execute',
		},
		{
			name: 'query',
			type: 'string',
			required: false,
			description: 'Search query text (required for search command)',
		},
		{
			name: '-f, --file',
			type: 'string',
			required: false,
			description: 'SQLite database file path (overrides config)',
		},
		{ name: '-r, --reset', type: 'flag', required: false, description: 'Clear existing documents before indexing' },
		{ name: '-k, --api-key', type: 'string', required: false, description: 'OpenAI API key' },
		{
			name: '-n, --results',
			type: 'number',
			required: false,
			description: 'Number of search results to return (default: 5)',
		},
		{
			name: '--hybrid / --no-hybrid',
			type: 'flag',
			required: false,
			description: 'Enable or disable hybrid search mode',
		},
		{
			name: '--alpha',
			type: 'number',
			required: false,
			description: 'Lexical weight in hybrid search, 0.0 to 1.0 (default: 0.2)',
		},
		{ name: '--category', type: 'string', required: false, description: 'Filter results by category' },
		{ name: '--department', type: 'string', required: false, description: 'Filter results by department' },
		{ name: '--priority', type: 'string', required: false, description: 'Filter results by priority level' },
		{ name: '--json', type: 'flag', required: false, description: 'Output raw JSON instead of formatted display' },
		{ name: '-v, --verbose', type: 'flag', required: false, description: 'Enable verbose logging output' },
	],
	output: 'For index: populates SQLite database with documents, embeddings, and FTS5 index. For search: ranked results with scores, snippets, and metadata displayed in terminal or as JSON. For graph: JSON file representing document relationships. For graph:html: interactive HTML viewer file. For tui: launches interactive terminal UI for real-time search.',
	constraints: [
		'OpenAI API key required for embedding generation (set via OPENAI_API_KEY or --api-key)',
		'SQLite3 support required',
		'Documents must be in Markdown format',
		'Embedding model dimensions must match between indexing and searching (default: 3072 for text-embedding-3-large)',
		'Graph HTML viewer requires the graph JSON to be generated first',
	],
	conventions: [
		'Run doc-decomposer first to prepare RFP content, then doc-indexer to index the decomposed files',
		'Use --reset when re-indexing to clear stale data',
		'Configuration is in config.yaml co-located in the riff directory',
		'Domain-specific abbreviations, synonyms, and concepts are configured in the searchReference section',
		'Use the tui command for interactive exploration, search command for scripted queries',
		'Invocation pattern: $RIFF <command> [args]',
	],
	examples: [
		{
			description: 'Index documents with reset',
			command: '$RIFF index --reset',
			outcome:
				'Clears existing data and indexes all documents from the configured input directory into SQLite with embeddings and FTS5',
		},
		{
			description: 'Search for network security requirements',
			command: '$RIFF search "authentication and security WPA3 encryption"',
			outcome:
				'Returns ranked results combining semantic similarity and keyword matching with highlighted snippets',
		},
		{
			description: 'Generate knowledge graph and HTML viewer',
			command: '$RIFF graph && $RIFF graph:html',
			outcome: 'Creates graph.json and an interactive HTML visualization of document relationships',
		},
		{
			description: 'Filtered search with JSON output',
			command: '$RIFF search "disaster recovery" --priority "Must Fully Comply" --json',
			outcome: 'Returns JSON array of matching documents filtered to must-comply priority level',
		},
	],
};
