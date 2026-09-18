# Aria Vector Indexer Riff

Semantic vector indexing and search riff using Qwen3-Embedding models via Ollama or llama.cpp, with Qdrant vector database.

## Overview

Index and search documents using locally-hosted models. Supports multiple provider backends (Ollama, llama.cpp) configurable via YAML. All processing happens locally with no external API calls.

## Features

- **Hybrid Search** - Dense (semantic) + sparse (BM25) vector retrieval
- **Re-ranking** - Cross-encoder re-ranking with configurable providers
- **Hierarchical Chunking** - Semantic document splitting respecting markdown structure
- **Multi-Provider** - Supports Ollama and llama.cpp backends (configurable)
- **Service Management** - Auto-start and intelligent service orchestration
- **Local-first** - All processing happens locally, no external APIs
- **Structured Logging** - Pino logging with full observability

## Prerequisites

### Required

- Node.js 24+
- Docker (for Qdrant vector database)

### Provider-Specific Requirements

#### If using Ollama provider

```sh
# Install Ollama
# https://ollama.ai

# Pull embedding models (install at least one)
ollama pull qwen3-embedding:8b   # Primary - higher accuracy
ollama pull qwen3-embedding:4b   # Fallback - lower memory

# Pull re-ranker models
ollama pull dengcao/Qwen3-Reranker-4B:Q5_K_M  # Standard - ~3GB
ollama pull dengcao/Qwen3-Reranker-8B:Q5_K_M  # High accuracy - ~6GB (optional)
```

#### If using llama.cpp provider

```sh
# Install llama.cpp
brew install llama.cpp

# Configure model paths in config/config-vector-indexer.yaml
# Point to Ollama's GGUF files or download models separately
# See docs/plans/plan-llama-cpp-setup-macos.md for details
```

### Start Qdrant

Services auto-start by default. For manual setup:

```sh
# Via Docker Compose (recommended)
docker compose -f riffs/vector-indexer/docker/docker-compose.yml up -d

# Or via docker run
docker run -p 6333:6333 -v $(pwd)/.aria/db/vector-indexer:/qdrant/storage qdrant/qdrant
```

## Usage

### Index Documents

```sh
# Primary usage - direct bun execution
bun riffs/vector-indexer/src/cli/cli.ts index <directory> --collection <name>

# Example
bun riffs/vector-indexer/src/cli/cli.ts index .aria/exports/markdown --collection legislation

# Alternative - npm script (optional)
bun run vector-indexer:index -- <directory> --collection <name>
```

### Search

```sh
# Primary usage
bun riffs/vector-indexer/src/cli/cli.ts search "<query>" --collection <name>

# Example
bun riffs/vector-indexer/src/cli/cli.ts search "network security requirements" --collection legislation

# Options
bun riffs/vector-indexer/src/cli/cli.ts search "<query>" \
  --collection <name> \
  --top-k 100 \
  --final-k 20 \
  --no-rerank  # Disable re-ranking
```

### Manage Collections

```sh
# List collections
bun riffs/vector-indexer/src/cli/cli.ts collections --list

# Delete collection
bun riffs/vector-indexer/src/cli/cli.ts collections --delete <name>

# Show collection info
bun riffs/vector-indexer/src/cli/cli.ts collections --info <name>
```

### System Status

```sh
# Show full system status (default command)
bun riffs/vector-indexer/src/cli/cli.ts

# Explicit status command
bun riffs/vector-indexer/src/cli/cli.ts status

# JSON output
bun riffs/vector-indexer/src/cli/cli.ts status --json
```

### Service Management

```sh
# Services auto-start by default
# To manually shutdown:

# Shutdown all services
bun riffs/vector-indexer/src/cli/cli.ts shutdown --all

# Shutdown only Docker/Qdrant
bun riffs/vector-indexer/src/cli/cli.ts shutdown --docker

# Shutdown only llama-server processes
bun riffs/vector-indexer/src/cli/cli.ts shutdown --llama

# Shutdown specific service
bun riffs/vector-indexer/src/cli/cli.ts shutdown --service qdrant
```

### Check Prerequisites

```sh
# Check Qdrant connection
bun riffs/vector-indexer/src/cli/cli.ts check --qdrant

# Check all
bun riffs/vector-indexer/src/cli/cli.ts check --all
```

## Configuration

Configuration file: `config/config-vector-indexer.yaml`

Key configurable settings:

- **Provider**: `ollama` or `llama-cpp` for embeddings and reranking
- **Embedding model**: `qwen3-embedding:8b` (primary), `qwen3-embedding:4b` (fallback)
- **Re-ranker**: `dengcao/Qwen3-Reranker-4B:Q5_K_M` (standard), `dengcao/Qwen3-Reranker-8B:Q5_K_M` (high-memory)
- **Dimensions**: Configurable embedding dimensions (1024-4096)
- **Chunking**: Hierarchical by markdown headings with configurable token limits
- **Hybrid weights**: Dense/sparse weighting (default: 70%/30%)
- **Service orchestration**: Auto-start, shutdown behavior, timeouts, health checks
- **Docker**: Container name, compose file path
- **llama-server**: Host binding, GPU layers, logging

## Architecture

Multi-protocol layered architecture:

```tree
src/
├── cli/
│   └── cli.ts                    # CLI entry point (thin adapter)
├── config/
│   └── index.ts                  # Configuration loading and validation
├── core/
│   ├── chunker.ts                # Hierarchical semantic chunking
│   ├── file-scanner.ts           # Directory traversal and file discovery
│   ├── indexer.ts                # Document indexing pipeline
│   ├── manage-services.ts        # Service orchestration (Docker, llama-server)
│   ├── markdown-parser.ts        # Markdown heading structure parsing
│   ├── metadata-extractor.ts     # Regex-based metadata extraction
│   └── searcher.ts               # Hybrid search + re-ranking
├── providers/
│   ├── embeddings.ts             # Embedding provider manager
│   ├── embeddings-ollama.ts      # Ollama embedding implementation
│   ├── embeddings-llama-cpp.ts   # llama.cpp embedding implementation
│   ├── reranker.ts               # Reranker provider manager
│   ├── reranker-ollama.ts        # Ollama reranker implementation
│   ├── reranker-llama-cpp.ts     # llama.cpp reranker implementation
│   ├── qdrant.ts                 # Qdrant client wrapper
│   ├── sparse-vectors.ts         # BM25 sparse vector generation
│   └── wink-bm25-text-search.d.ts # Type definitions for BM25 library
├── types/
│   └── index.ts                  # All interfaces and types
└── utils/
    ├── logger.ts                 # Pino logger factory
    ├── progress.ts               # Progress indicators (ora, chalk)
    └── system-status.ts          # System status reporting
```

## Development

### Type Checking

```sh
bun run vector-indexer:typecheck
```

### Testing

```sh
bun run vector-indexer:test
```

### Linting

```sh
bun run check
```

## Technical Details

### Models

- **Embeddings**: Qwen3-Embedding-8B or 4B (configurable dimensions, 32K context)
- **Re-ranking**: dengcao/Qwen3-Reranker-4B/8B (Q5_K_M quantization)
- **Sparse vectors**: BM25 via wink-bm25-text-search

### Storage

- **Qdrant**: Vector database in `.aria/db/vector-indexer/`
- **Logs**: Structured Pino logs in `.aria/logs/vector-indexer.*.log` (daily rotation with version numbering)

## Roadmap

- [ ] Incremental indexing (only process changed files)
- [ ] Multi-collection search
- [ ] Multi-path search
- [ ] Export/import collections
- [ ] Web UI for search (future GUI layer)
- [ ] MCP server integration (future MCP layer)
- [ ] REST API (future API layer)

## License

Part of the Aria project. See root LICENSE file.
