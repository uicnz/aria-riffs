---
name: vector-indexer
description: Semantic vector indexing and search with local embeddings and Qdrant
---

# Vector Indexer

## Purpose

Indexes and searches documents using locally-hosted embedding models (Qwen3-Embedding via Ollama or llama.cpp) with Qdrant vector database. Supports hybrid dense (semantic) and sparse (BM25) vector retrieval with cross-encoder re-ranking. Features hierarchical markdown chunking, multi-provider backends, automatic service orchestration (Docker for Qdrant, llama-server processes), and collection management. All processing happens locally with no external API calls, making it suitable for air-gapped environments.

## When to use

- Indexing documents for semantic search using locally-hosted models (no cloud API dependency)
- Searching indexed collections with hybrid dense/sparse retrieval and re-ranking
- Working in air-gapped or privacy-sensitive environments where external API calls are prohibited
- Managing multiple named collections of indexed documents in Qdrant
- Using custom chunking strategies for domain-specific document structures

## Pipeline

1. Scan input directory for markdown files
2. Auto-start required services (Qdrant via Docker, llama-server for embeddings and reranking)
3. Parse markdown documents respecting heading hierarchy
4. Chunk documents using configurable strategy (generic.hierarchical or aria.heading-enriched)
5. Generate dense embeddings via Ollama or llama.cpp provider
6. Generate sparse BM25 vectors for lexical matching
7. Upsert vectors into Qdrant collection with metadata
8. For search: query with dense+sparse fusion, then re-rank top results with cross-encoder

## Parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `command` | `enum(index\|search\|collections\|status\|check\|strategies\|shutdown)` | yes | Subcommand to execute |
| `directory` | `string` | no | Directory containing documents to index (required for index command) |
| `query` | `string` | no | Search query text (required for search command) |
| `-c, --collection` | `string` | no | Collection name (required for index and search commands) |
| `--config` | `string` | no | Path to config file |
| `--strategy` | `string` | no | Chunking strategy name (e.g., generic.hierarchical, aria.heading-enriched) |
| `--top-k` | `number` | no | Number of results to retrieve from Qdrant (default: 100) |
| `--final-k` | `number` | no | Number of final results after re-ranking (default: 20) |
| `--no-rerank` | `flag` | no | Disable cross-encoder re-ranking |
| `--dry-run` | `flag` | no | Skip Qdrant and embedding operations (for testing) |
| `--json` | `flag` | no | Output status as JSON |

## Output

For index: vectors upserted into Qdrant collection with stats (documents processed, chunks created, total tokens, duration, success rate). For search: ranked results with scores, source paths, headings, and content previews. For collections: list of collections with point counts and status. For status: comprehensive system health report covering services, models, and collections.

## Constraints

- Docker required for Qdrant vector database
- Either Ollama or llama.cpp required for embedding generation
- Qdrant must be accessible (auto-started by default via Docker Compose)
- Embedding dimensions must match between indexing and searching (default: 4096 for qwen3-embedding:8b)
- Re-ranking requires a compatible model (dengcao/Qwen3-Reranker-4B or 8B)
- Service startup can take up to 120 seconds (Qdrant needs approximately 90 seconds)

## Conventions

- Services auto-start by default; use shutdown command to stop them manually
- Configuration is in config.yaml co-located in the riff directory
- Provider selection (ollama vs llama-cpp) is configured per-component in config.yaml
- Use the strategies command to list available chunking strategies before indexing
- Collection names should be descriptive (e.g., "legislation", "rfp-responses")
- Invocation pattern: $RIFF <command> [args]

## Examples

### Index documents into a collection

```sh
$RIFF index .aria/exports/markdown --collection legislation
```

Scans directory, chunks documents, generates embeddings, and upserts vectors into Qdrant collection named "legislation"

### Search with re-ranking

```sh
$RIFF search "network security requirements" --collection legislation
```

Returns top 20 re-ranked results from hybrid dense/sparse retrieval across the legislation collection

### Check system status

```sh
$RIFF status
```

Displays health of Qdrant, Ollama, llama-server processes, available models, and collection statistics

### List and manage collections

```sh
$RIFF collections --list
```

Shows all Qdrant collections with point counts and status
