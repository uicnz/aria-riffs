---
name: hr-policy
description: HR policy document decomposition, indexing, and semantic search
---

# Hr Policy

## Purpose

Decomposes, indexes, and searches HR policy documents using hybrid semantic and lexical search. Splits policy documents into sections at heading boundaries, indexes them with OpenAI embeddings into a SQLite database with FTS5, and provides multi-pass hybrid search with RRF fusion. Supports multiple embedding providers (OpenAI, Gemini, Ollama) and configurable search weighting. Designed for policy-heavy document collections where precise section-level retrieval matters.

## When to use

- Decomposing HR policy markdown documents into searchable sections
- Indexing policy documents for hybrid semantic and lexical search
- Searching policy content with natural language queries
- Answering HR policy questions by retrieving the most relevant policy sections
- Building a searchable knowledge base from structured policy documents

## Pipeline

1. For decompose: split policy markdown files at H2/H3 heading boundaries into individual section files
2. For index: parse section files extracting frontmatter metadata and content
3. Generate embeddings via configured provider (OpenAI, Gemini, or Ollama)
4. Store documents, embeddings, and FTS5 index in SQLite database
5. For search: execute multi-pass retrieval combining semantic and lexical search with RRF fusion
6. Return ranked results with snippets and metadata

## Parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `command` | `enum(decompose\|index\|search)` | yes | Subcommand to execute |
| `query` | `string` | no | Search query text (required for search command) |
| `-i, --input` | `string` | no | Input directory for decompose command |
| `-o, --output` | `string` | no | Output directory for decompose command |
| `-f, --file` | `string` | no | SQLite database file path |
| `-r, --reset` | `flag` | no | Reset and clear existing documents before indexing |
| `-k, --api-key` | `string` | no | API key for embedding provider |
| `-n, --results` | `number` | no | Number of search results (default: 5) |
| `--hybrid / --no-hybrid` | `flag` | no | Enable or disable hybrid search |
| `--alpha` | `number` | no | Lexical weight in hybrid search, 0.0 to 1.0 (default: 0.35) |
| `--json` | `flag` | no | Output raw JSON instead of formatted display |
| `-v, --verbose` | `flag` | no | Enable verbose/debug output |

## Output

For decompose: individual section files in the output directory, one per policy section. For index: populates SQLite database with documents, embeddings, and FTS5 index. For search: ranked results with scores, snippets with highlighted terms, and source metadata.

## Constraints

- Embedding provider API key required (OpenAI by default, set via OPENAI_API_KEY)
- Input documents must be Markdown format with heading structure
- Decomposer requires H2 or H3 headings as section boundaries (configurable via patterns)
- Database path must be writable

## Conventions

- Run decompose first to split policy documents, then index to make them searchable
- Configuration is in config.yaml co-located in the riff directory
- Embedding provider is configurable: openai, gemini, or ollama
- Higher alpha values (0.3-0.5) work better for factoid queries; lower values (0.1-0.2) for conceptual queries
- Invocation pattern: $RIFF <command> [args]

## Examples

### Decompose policy documents into sections

```sh
$RIFF decompose -i sources/cello/hr-policies/ -o .aria/exports/cello/hr-policies/
```

Splits each policy markdown file at heading boundaries into individual section files

### Index decomposed sections

```sh
$RIFF index sources/cello/hr-policies/ --reset
```

Clears existing data and indexes all policy sections with embeddings and FTS5

### Search for leave policy information

```sh
$RIFF search "annual leave entitlement"
```

Returns the most relevant policy sections about annual leave with highlighted snippets
