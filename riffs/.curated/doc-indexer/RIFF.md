---
name: doc-indexer
description: Document indexing with hybrid semantic/lexical search and knowledge
  graph generation
---

# Doc Indexer

## Purpose

Indexes markdown documents into a SQLite database with OpenAI embeddings for semantic search and FTS5 for lexical search. Implements a multi-pass retrieval system with Reciprocal Rank Fusion (RRF) combining semantic, lexical OR, synonym expansion, and phrase proximity passes. Generates interactive knowledge graph visualizations. Supports both general document indexing and specialized RFP parsing with configurable requirement patterns, metadata extraction, and domain-specific query expansion.

## When to use

- Indexing decomposed RFP responses or general markdown documents for semantic search
- Searching indexed documents with hybrid semantic and lexical matching
- Generating interactive knowledge graphs showing document relationships
- Creating HTML visualizations for exploring document collections
- Performing filtered searches by category, department, priority, or identifier
- Exporting search results as JSON for programmatic consumption

## Pipeline

1. Parse markdown documents extracting metadata, content sections, and identifiers
2. Enrich content with contextual embedding prefixes, abbreviation injection, and domain keyword extraction
3. Generate OpenAI embeddings for each document section
4. Store documents, embeddings, and FTS5 index in SQLite database
5. For search: execute four-pass retrieval (semantic, lexical OR, synonym expansion, phrase proximity)
6. Fuse results using RRF with configurable scoring weights
7. For graph: export document relationships as JSON and generate interactive HTML viewer

## Parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `command` | `enum(index\|search\|graph\|graph:html\|graph:validate\|tui)` | yes | Subcommand to execute |
| `query` | `string` | no | Search query text (required for search command) |
| `-f, --file` | `string` | no | SQLite database file path (overrides config) |
| `-r, --reset` | `flag` | no | Clear existing documents before indexing |
| `-k, --api-key` | `string` | no | OpenAI API key |
| `-n, --results` | `number` | no | Number of search results to return (default: 5) |
| `--hybrid / --no-hybrid` | `flag` | no | Enable or disable hybrid search mode |
| `--alpha` | `number` | no | Lexical weight in hybrid search, 0.0 to 1.0 (default: 0.2) |
| `--category` | `string` | no | Filter results by category |
| `--department` | `string` | no | Filter results by department |
| `--priority` | `string` | no | Filter results by priority level |
| `--json` | `flag` | no | Output raw JSON instead of formatted display |
| `-v, --verbose` | `flag` | no | Enable verbose logging output |

## Output

For index: populates SQLite database with documents, embeddings, and FTS5 index. For search: ranked results with scores, snippets, and metadata displayed in terminal or as JSON. For graph: JSON file representing document relationships. For graph:html: interactive HTML viewer file. For tui: launches interactive terminal UI for real-time search.

## Constraints

- OpenAI API key required for embedding generation (set via OPENAI_API_KEY or --api-key)
- SQLite3 support required
- Documents must be in Markdown format
- Embedding model dimensions must match between indexing and searching (default: 3072 for text-embedding-3-large)
- Graph HTML viewer requires the graph JSON to be generated first

## Conventions

- Run doc-decomposer first to prepare RFP content, then doc-indexer to index the decomposed files
- Use --reset when re-indexing to clear stale data
- Configuration is in config.yaml co-located in the riff directory
- Domain-specific abbreviations, synonyms, and concepts are configured in the searchReference section
- Use the tui command for interactive exploration, search command for scripted queries
- Invocation pattern: $RIFF <command> [args]

## Examples

### Index documents with reset

```sh
$RIFF index --reset
```

Clears existing data and indexes all documents from the configured input directory into SQLite with embeddings and FTS5

### Search for network security requirements

```sh
$RIFF search "authentication and security WPA3 encryption"
```

Returns ranked results combining semantic similarity and keyword matching with highlighted snippets

### Generate knowledge graph and HTML viewer

```sh
$RIFF graph && $RIFF graph:html
```

Creates graph.json and an interactive HTML visualization of document relationships

### Filtered search with JSON output

```sh
$RIFF search "disaster recovery" --priority "Must Fully Comply" --json
```

Returns JSON array of matching documents filtered to must-comply priority level
