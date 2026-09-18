/**
 * HR Policy -- RiffPrompt definition
 */
export const riffPrompt = {
	name: 'hr-policy',
	summary: 'HR policy document decomposition, indexing, and semantic search',
	purpose:
		'Decomposes, indexes, and searches HR policy documents using hybrid semantic and lexical search. Splits policy documents into sections at heading boundaries, indexes them with OpenAI embeddings into a SQLite database with FTS5, and provides multi-pass hybrid search with RRF fusion. Supports multiple embedding providers (OpenAI, Gemini, Ollama) and configurable search weighting. Designed for policy-heavy document collections where precise section-level retrieval matters.',
	whenToUse: [
		'Decomposing HR policy markdown documents into searchable sections',
		'Indexing policy documents for hybrid semantic and lexical search',
		'Searching policy content with natural language queries',
		'Answering HR policy questions by retrieving the most relevant policy sections',
		'Building a searchable knowledge base from structured policy documents',
	],
	pipeline: [
		'For decompose: split policy markdown files at H2/H3 heading boundaries into individual section files',
		'For index: parse section files extracting frontmatter metadata and content',
		'Generate embeddings via configured provider (OpenAI, Gemini, or Ollama)',
		'Store documents, embeddings, and FTS5 index in SQLite database',
		'For search: execute multi-pass retrieval combining semantic and lexical search with RRF fusion',
		'Return ranked results with snippets and metadata',
	],
	parameters: [
		{ name: 'command', type: 'enum(decompose|index|search)', required: true, description: 'Subcommand to execute' },
		{
			name: 'query',
			type: 'string',
			required: false,
			description: 'Search query text (required for search command)',
		},
		{ name: '-i, --input', type: 'string', required: false, description: 'Input directory for decompose command' },
		{
			name: '-o, --output',
			type: 'string',
			required: false,
			description: 'Output directory for decompose command',
		},
		{ name: '-f, --file', type: 'string', required: false, description: 'SQLite database file path' },
		{
			name: '-r, --reset',
			type: 'flag',
			required: false,
			description: 'Reset and clear existing documents before indexing',
		},
		{ name: '-k, --api-key', type: 'string', required: false, description: 'API key for embedding provider' },
		{
			name: '-n, --results',
			type: 'number',
			required: false,
			description: 'Number of search results (default: 5)',
		},
		{
			name: '--hybrid / --no-hybrid',
			type: 'flag',
			required: false,
			description: 'Enable or disable hybrid search',
		},
		{
			name: '--alpha',
			type: 'number',
			required: false,
			description: 'Lexical weight in hybrid search, 0.0 to 1.0 (default: 0.35)',
		},
		{ name: '--json', type: 'flag', required: false, description: 'Output raw JSON instead of formatted display' },
		{ name: '-v, --verbose', type: 'flag', required: false, description: 'Enable verbose/debug output' },
	],
	output: 'For decompose: individual section files in the output directory, one per policy section. For index: populates SQLite database with documents, embeddings, and FTS5 index. For search: ranked results with scores, snippets with highlighted terms, and source metadata.',
	constraints: [
		'Embedding provider API key required (OpenAI by default, set via OPENAI_API_KEY)',
		'Input documents must be Markdown format with heading structure',
		'Decomposer requires H2 or H3 headings as section boundaries (configurable via patterns)',
		'Database path must be writable',
	],
	conventions: [
		'Run decompose first to split policy documents, then index to make them searchable',
		'Configuration is in config.yaml co-located in the riff directory',
		'Embedding provider is configurable: openai, gemini, or ollama',
		'Higher alpha values (0.3-0.5) work better for factoid queries; lower values (0.1-0.2) for conceptual queries',
		'Invocation pattern: $RIFF <command> [args]',
	],
	examples: [
		{
			description: 'Decompose policy documents into sections',
			command: '$RIFF decompose -i sources/cello/hr-policies/ -o .aria/exports/cello/hr-policies/',
			outcome: 'Splits each policy markdown file at heading boundaries into individual section files',
		},
		{
			description: 'Index decomposed sections',
			command: '$RIFF index sources/cello/hr-policies/ --reset',
			outcome: 'Clears existing data and indexes all policy sections with embeddings and FTS5',
		},
		{
			description: 'Search for leave policy information',
			command: '$RIFF search "annual leave entitlement"',
			outcome: 'Returns the most relevant policy sections about annual leave with highlighted snippets',
		},
	],
};
