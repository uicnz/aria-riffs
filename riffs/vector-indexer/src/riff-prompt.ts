/**
 * Vector Indexer -- RiffPrompt definition
 */
export const riffPrompt = {
	name: 'vector-indexer',
	summary: 'Semantic vector indexing and search with local embeddings and Qdrant',
	purpose:
		'Indexes and searches documents using locally-hosted embedding models (Qwen3-Embedding via Ollama or llama.cpp) with Qdrant vector database. Supports hybrid dense (semantic) and sparse (BM25) vector retrieval with cross-encoder re-ranking. Features hierarchical markdown chunking, multi-provider backends, automatic service orchestration (Docker for Qdrant, llama-server processes), and collection management. All processing happens locally with no external API calls, making it suitable for air-gapped environments.',
	whenToUse: [
		'Indexing documents for semantic search using locally-hosted models (no cloud API dependency)',
		'Searching indexed collections with hybrid dense/sparse retrieval and re-ranking',
		'Working in air-gapped or privacy-sensitive environments where external API calls are prohibited',
		'Managing multiple named collections of indexed documents in Qdrant',
		'Using custom chunking strategies for domain-specific document structures',
	],
	pipeline: [
		'Scan input directory for markdown files',
		'Auto-start required services (Qdrant via Docker, llama-server for embeddings and reranking)',
		'Parse markdown documents respecting heading hierarchy',
		'Chunk documents using configurable strategy (generic.hierarchical or aria.heading-enriched)',
		'Generate dense embeddings via Ollama or llama.cpp provider',
		'Generate sparse BM25 vectors for lexical matching',
		'Upsert vectors into Qdrant collection with metadata',
		'For search: query with dense+sparse fusion, then re-rank top results with cross-encoder',
	],
	parameters: [
		{
			name: 'command',
			type: 'enum(index|search|collections|status|check|strategies|shutdown)',
			required: true,
			description: 'Subcommand to execute',
		},
		{
			name: 'directory',
			type: 'string',
			required: false,
			description: 'Directory containing documents to index (required for index command)',
		},
		{
			name: 'query',
			type: 'string',
			required: false,
			description: 'Search query text (required for search command)',
		},
		{
			name: '-c, --collection',
			type: 'string',
			required: false,
			description: 'Collection name (required for index and search commands)',
		},
		{ name: '--config', type: 'string', required: false, description: 'Path to config file' },
		{
			name: '--strategy',
			type: 'string',
			required: false,
			description: 'Chunking strategy name (e.g., generic.hierarchical, aria.heading-enriched)',
		},
		{
			name: '--top-k',
			type: 'number',
			required: false,
			description: 'Number of results to retrieve from Qdrant (default: 100)',
		},
		{
			name: '--final-k',
			type: 'number',
			required: false,
			description: 'Number of final results after re-ranking (default: 20)',
		},
		{ name: '--no-rerank', type: 'flag', required: false, description: 'Disable cross-encoder re-ranking' },
		{
			name: '--dry-run',
			type: 'flag',
			required: false,
			description: 'Skip Qdrant and embedding operations (for testing)',
		},
		{ name: '--json', type: 'flag', required: false, description: 'Output status as JSON' },
	],
	output: 'For index: vectors upserted into Qdrant collection with stats (documents processed, chunks created, total tokens, duration, success rate). For search: ranked results with scores, source paths, headings, and content previews. For collections: list of collections with point counts and status. For status: comprehensive system health report covering services, models, and collections.',
	constraints: [
		'Docker required for Qdrant vector database',
		'Either Ollama or llama.cpp required for embedding generation',
		'Qdrant must be accessible (auto-started by default via Docker Compose)',
		'Embedding dimensions must match between indexing and searching (default: 4096 for qwen3-embedding:8b)',
		'Re-ranking requires a compatible model (dengcao/Qwen3-Reranker-4B or 8B)',
		'Service startup can take up to 120 seconds (Qdrant needs approximately 90 seconds)',
	],
	conventions: [
		'Services auto-start by default; use shutdown command to stop them manually',
		'Configuration is in config.yaml co-located in the riff directory',
		'Provider selection (ollama vs llama-cpp) is configured per-component in config.yaml',
		'Use the strategies command to list available chunking strategies before indexing',
		'Collection names should be descriptive (e.g., "legislation", "rfp-responses")',
		'Invocation pattern: $RIFF <command> [args]',
	],
	examples: [
		{
			description: 'Index documents into a collection',
			command: '$RIFF index .aria/exports/markdown --collection legislation',
			outcome:
				'Scans directory, chunks documents, generates embeddings, and upserts vectors into Qdrant collection named "legislation"',
		},
		{
			description: 'Search with re-ranking',
			command: '$RIFF search "network security requirements" --collection legislation',
			outcome:
				'Returns top 20 re-ranked results from hybrid dense/sparse retrieval across the legislation collection',
		},
		{
			description: 'Check system status',
			command: '$RIFF status',
			outcome:
				'Displays health of Qdrant, Ollama, llama-server processes, available models, and collection statistics',
		},
		{
			description: 'List and manage collections',
			command: '$RIFF collections --list',
			outcome: 'Shows all Qdrant collections with point counts and status',
		},
	],
};
