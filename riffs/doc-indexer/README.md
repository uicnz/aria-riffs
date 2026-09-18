# Aria Doc Indexer Riff

> **Document Indexing, Knowledge Graph, and Interactive Visualization Riff**

Aria doc-indexer is a flexible document management and knowledge discovery system for indexing and searching markdown documents. While it includes powerful RFP (Request for Proposal) parsing capabilities, it works equally well as a general-purpose document indexer. It combines semantic search using OpenAI embeddings with traditional lexical search, and generates interactive knowledge graphs for visualization and exploration.

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Commands](#commands)
- [Configuration](#configuration)
- [Search Strategies](#search-strategies)
- [Index Enrichment](#index-enrichment)
- [Benchmarks](#benchmarks)
- [Usage Examples](#usage-examples)
- [Document Types](#document-types)
- [Technical Details](#technical-details)
- [Logging](#logging)

## Features

- **Hybrid Search**: Combines semantic (embeddings-based) and lexical (FTS5) search with multi-pass RRF fusion
- **Multi-Pass Retrieval**: Four-pass search combining semantic, lexical OR, synonym expansion, and phrase proximity
- **Query Expansion**: Automatic abbreviation expansion (SLA -> service level agreement) and synonym matching
- **Index-Time Enrichment**: Contextual embedding prefixes, abbreviation injection, and domain keyword extraction
- **Configurable Scoring**: Tune title, identifier, semantic, lexical, and phrase weights via config
- **Interactive TUI**: Full-featured terminal UI with configurable display modes (snippet/full)
- **Agent-Friendly Output**: JSON output with concise snippets for programmatic consumption
- **Document Indexing**: Indexes markdown documents with metadata extraction
- **Knowledge Graph Generation**: Creates interactive graph visualizations of document relationships
- **OpenAI Embeddings**: Uses embedding models for semantic understanding
- **Interactive HTML Viewer**: Explore your knowledge graph through a web interface
- **Metadata Filtering**: Search and filter by category, department, priority, and custom fields
- **Domain Portability**: All domain-specific values in config for easy adaptation to new domains
- **Optional RFP Parser**: Specialized features for RFP documents when needed
- **Flexible Document Types**: Configure custom requirement patterns and identifiers

## Architecture

doc-indexer consists of several core components:

```tree
riffs/doc-indexer/
├── src/
│   ├── core/           # Core functionality
│   │   ├── database.ts      # SQLite database management
│   │   ├── embeddings.ts    # OpenAI embedding service
│   │   ├── indexer.ts       # Document indexing engine
│   │   └── search.ts        # Hybrid search implementation
│   ├── graph/          # Knowledge graph generation
│   │   ├── exporter.ts      # Graph JSON export
│   │   └── types.ts         # Graph type definitions
│   ├── parsers/        # Document parsing
│   │   ├── markdown.ts      # Markdown parsing
│   │   ├── metadata.ts      # Metadata extraction
│   │   └── rfp.ts           # RFP-specific parsing
│   ├── viewer/         # HTML visualization
│   │   └── template.ts      # HTML template generation
│   └── cli/            # Command-line interface
│       └── terminal-renderer.ts  # Terminal output formatting
```

## Installation

doc-indexer is part of the Aria monorepo and comes pre-built. No additional installation is required.

### Prerequisites

- Node.js 20+
- OpenAI API key (for embedding generation)
- SQLite3 support

## Quick Start

1. **Index your documents**:

    ```sh
    bun riffs/doc-indexer/src/cli.ts index
    ```

2. **Search for information**:

    ```sh
    bun riffs/doc-indexer/src/cli.ts search "authentication"
    ```

3. **Generate a knowledge graph**:

    ```sh
    bun riffs/doc-indexer/src/cli.ts graph
    ```

4. **Create an interactive HTML viewer**:

    ```sh
    bun riffs/doc-indexer/src/cli.ts graph:html
    ```

## Commands

### `index` - Index Documents

Indexes markdown documents and generates embeddings for semantic search.

```sh
bun riffs/doc-indexer/src/cli.ts index [directory] [options]
```

**Options:**

- `-f, --file <path>` - SQLite database file (overrides config)
- `-r, --reset` - Clear existing documents before indexing
- `-k, --api-key <key>` - OpenAI API key
- `-c, --config <path>` - Configuration file path
- `-v, --verbose` - Enable verbose logging output
- `--model <name>` - Embedding model (default: `text-embedding-3-large`)
- `--dimensions <n>` - Embedding dimensions (default: 3072)
- `--max-embed-chars <n>` - Max characters per embedding (default: 20000)
- `--sections <mode>` - Index mode: `response`, `request`, `both`, or `full`
- `--weight-response <x>` - Bias embeddings toward responses (default: 1.8)

### `search` - Search Documents

Perform hybrid semantic and lexical searches across indexed documents.

```sh
bun riffs/doc-indexer/src/cli.ts search <query> [options]
```

**Database Path:** By default, doc-indexer uses the database path from `config.yaml`. You can override this in two ways:

- Use `-f <path>` to specify a different database file directly
- Use `-c <path>` to specify a different config file

Example with explicit database path:

```sh
bun riffs/doc-indexer/src/cli.ts search "authentication" -f .aria/db/doc-indexer/vectors.sqlite
```

**Options:**

- `-f, --file <path>` - SQLite database file
- `-k, --api-key <key>` - OpenAI API key
- `-n, --results <num>` - Number of results (default: 5)
- `-c, --config <path>` - Configuration file path
- `-v, --verbose` - Enable verbose logging output
- `--hybrid` / `--no-hybrid` - Enable/disable hybrid search
- `--alpha <x>` - Lexical weight (0-1) for hybrid search (default: 0.2)
- `--category <val>` - Filter by category
- `--department <val>` - Filter by department
- `--priority <val>` - Filter by priority
- `--identifier <val>` - Filter by identifier
- `--no-metadata` - Hide metadata in results
- `--no-highlight` - Disable query term highlighting
- `--json` - Output raw JSON
- `--include-full` - Include FTS-only results

### `graph` - Export Knowledge Graph

Generate a JSON representation of the document knowledge graph.

```sh
bun riffs/doc-indexer/src/cli.ts graph [options]
```

**Options:**

- `-f, --file <path>` - SQLite database file
- `-o, --out <file>` - Output graph JSON file (default: `.aria/db/graph.json`)
- `-c, --config <path>` - Configuration file path
- `-v, --verbose` - Enable verbose logging output
- `--include-content` - Include document content (larger file)
- `--no-assets` - Exclude asset nodes

### `graph:html` - Generate HTML Viewer

Create an interactive HTML visualization of the knowledge graph.

```sh
bun riffs/doc-indexer/src/cli.ts graph:html [graphJson] [options]
```

**Options:**

- `-o, --out <file>` - Output HTML file (default: `.aria/db/graph.html`)
- `-c, --config <path>` - Configuration file path
- `-v, --verbose` - Enable verbose logging output
- `--mode <mode>` - Initial view mode: `dim` or `hide` (default: `dim`)
- `--rfp <name>` - Initial RFP scope or `all` (default: `all`)
- `--title <title>` - Page title (default: `RFP Knowledge Graph`)

### `graph:validate` - Validate Graph JSON

Validate the integrity of a graph JSON file.

```sh
bun riffs/doc-indexer/src/cli.ts graph:validate <graphJson>
```

### `tui` - Interactive Terminal Interface

Launch the interactive TUI for document search with real-time configuration.

```sh
bun riffs/doc-indexer/src/cli.ts tui [options]
```

**Options:**

- `-c, --config <path>` - Configuration file path

**TUI Features:**

- **Config Screen**: Adjust hybrid search, alpha, sections, metadata display, and highlighting
- **Display Mode**: Toggle between `snippet` (concise) and `full` (complete document) views
- **Real-time Search**: Interactive search with immediate results
- **Keyboard Navigation**: `[S]` for search, `[Q/ESC]` to quit/back

## Configuration

doc-indexer supports configuration through YAML files following monorepo conventions. The config file is located at `config.yaml`:

```yaml
doc-indexer:
    # Path settings
    paths:
        database: '.aria/db/doc-indexer/vectors.sqlite'
        outputDir: '.aria/db/doc-indexer'
        graph: 'graph.json'
        documents: 'documents.jsonl'
        viewer: 'viewer.html'
        defaultIndexDir: '.aria/exports/your-org/documents'
        fullRfpPath: '.aria/exports/your-org/full-rfp.md'

    # RFP parser configuration (optional - omit for non-RFP documents)
    rfp:
        # Static metadata (overrides extraction if both provided)
        metadata:
            vendor: 'Your Company Name'
            client: 'Client Name'
            rfpName: 'Project Name'

        # Dynamic metadata extraction patterns (applied to first file)
        extraction:
            vendor:
                pattern: '\|\s*Business website:\s*\|\s*<([^>]+)>'
                fallback: 'Your Company Name'
            client:
                pattern: 'Client:\s*(.+)'
                fallback: null
            rfpName:
                pattern: 'RFP Name:\s*(.+)'
                fallback: null
            proposalDate:
                pattern: 'Date of this proposal:\s*([\d-]+)'
                dateFormat: 'DD-MM-YY'

        # Requirement identifier patterns (regex-based)
        requirements:
            patterns:
                - '\b(BR\d{1,4})\b' # Business Requirements
                - '\b(MR\d{1,4})\b' # Mandatory Requirements
                - '\b(SR\d{1,4})\b' # Security Requirements
                - '\b(PR\d{1,4})\b' # Performance Requirements

    # OpenAI embedding configuration
    model: 'text-embedding-3-large'
    dimensions: 3072
    maxEmbedChars: 20000
    sections: 'both'
    weightResponse: 1.8
    useFts: true
    hybrid: true
    alpha: 0.2
    showMetadata: true
    highlight: true
```

**Configuration Precedence:**

1. Defaults (lowest priority) - Hardcoded in cli.ts
2. Config file - Values from config.yaml
3. CLI arguments (highest priority) - Override everything

### Configuration Options

#### Core Settings

- **`paths`** - File path configurations
    - `database` - SQLite database location
    - `outputDir` - Output directory for graph and documents
    - `graph` - Graph JSON filename
    - `documents` - Documents JSONL filename
    - `viewer` - HTML viewer filename
    - `defaultIndexDir` - Default directory for indexing
    - `fullRfpPath` - Full RFP source file path (optional)

- **`model`** - OpenAI embedding model name
- **`dimensions`** - Embedding vector dimensions
- **`maxEmbedChars`** - Maximum characters per embedding chunk
- **`sections`** - Which document sections to index (`response`, `request`, `both`, `full`)
- **`weightResponse`** - Response bias factor (>1 favors responses)
- **`useFts`** - Enable Full-Text Search (FTS5) indexing
- **`hybrid`** - Enable hybrid search by default
- **`alpha`** - Lexical weight in hybrid search (0=pure semantic, 1=pure lexical)
- **`showMetadata`** - Display metadata in search results
- **`highlight`** - Highlight search terms in results

#### Search Configuration

The `search` section controls query expansion, scoring, and snippet extraction:

- **`search.abbreviations`** - Abbreviation expansions (e.g., `sla: ['service', 'level', 'agreement']`)
- **`search.synonyms`** - Synonym groups for matching (e.g., `['incident', 'issue', 'ticket', 'problem']`)
- **`search.stopWords`** - Words to filter from queries
- **`search.identifierExpansions`** - Identifier prefix expansions (e.g., `MR: ['management', 'requirement']`)
- **`search.domainProducts`** - Domain-specific product names for keyword extraction
- **`search.domainConcepts`** - Domain-specific concepts for keyword extraction
- **`search.snippetContextLines`** - Lines of context around snippet matches (default: 1)
- **`search.weights`** - Scoring weights for hybrid search ranking:
    - `title` - Weight for title match score (default: 0.25)
    - `identifier` - Weight for identifier match score (default: 0.15)
    - `semantic` - Weight for semantic similarity (default: 0.30)
    - `lexical` - Weight for lexical/RRF score (default: 0.20)
    - `phrase` - Weight for exact phrase match (default: 0.10)
    - `identifierBoost` - Bonus for exact identifier matches (default: 0.20)
    - `phraseBoost` - Bonus for phrase matches (default: 0.15)
    - `passBonus` - Bonus per retrieval pass (default: 0.025)

#### RFP Parser Configuration (Optional)

The `rfp` section enables RFP-specific features. **Omit this entire section for general document indexing.**

- **`rfp.metadata`** - Static metadata values (highest priority)
    - `vendor` - Vendor/provider company name
    - `client` - Client/customer organization name
    - `rfpName` - RFP project name

- **`rfp.extraction`** - Dynamic metadata extraction from documents
    - `vendor.pattern` - Regex to extract vendor name
    - `vendor.fallback` - Fallback value if pattern fails
    - `client.pattern` - Regex to extract client name
    - `client.fallback` - Fallback value if pattern fails
    - `rfpName.pattern` - Regex to extract RFP name
    - `rfpName.fallback` - Fallback value if pattern fails
    - `proposalDate.pattern` - Regex to extract proposal date
    - `proposalDate.dateFormat` - Date format for parsing (e.g., `DD-MM-YY`)

- **`rfp.requirements`** - Document type/requirement pattern matching
    - `patterns` - Array of regex patterns for requirement identifiers
    - Each pattern should have a capture group for the identifier
    - Examples: `\b(BR\d{1,4})\b`, `\b(REQ-\d+)\b`, `\b(FUNC\d{3})\b`

## Usage Examples

### Basic Indexing

Index documents with default settings:

```sh
bun riffs/doc-indexer/src/cli.ts index
```

### Reset and Re-index

Clear the database and index fresh:

```sh
bun riffs/doc-indexer/src/cli.ts index --reset
```

### Custom Directory Indexing

Index a specific directory:

```sh
bun riffs/doc-indexer/src/cli.ts index ./my-documents --reset
```

### Semantic Search Examples

Search for WiFi coverage requirements in meeting rooms:

```sh
bun riffs/doc-indexer/src/cli.ts search "wifi coverage meeting rooms"
```

Search for network redundancy and high availability:

```sh
bun riffs/doc-indexer/src/cli.ts search "network redundancy failover high availability"
```

Search for security and authentication protocols:

```sh
bun riffs/doc-indexer/src/cli.ts search "authentication and security WPA3 encryption"
```

### Filtered Search

Search for IP addressing and VLAN requirements with priority filter:

```sh
bun riffs/doc-indexer/src/cli.ts search "IP addressing VLAN subnet overlap" --priority "Must Fully Comply"
```

Search for specific department requirements:

```sh
bun riffs/doc-indexer/src/cli.ts search "cabling UPS power redundancy" --department operations-engineering-noc
```

### JSON Output

Export network infrastructure requirements as JSON for analysis:

```sh
bun riffs/doc-indexer/src/cli.ts search "Meraki switches access points infrastructure" --json > network-requirements.json
```

### Generate Complete Workflow

Full indexing, graph generation, and HTML viewer creation:

```sh
# Index documents
bun riffs/doc-indexer/src/cli.ts index --reset

# Generate knowledge graph
bun riffs/doc-indexer/src/cli.ts graph

# Create HTML viewer
bun riffs/doc-indexer/src/cli.ts graph:html

# Open the viewer
open .aria/db/graph.html
```

## Document Types

doc-indexer supports flexible document type categorization through configuration. Document types are defined by regex patterns in the `rfp.requirements.patterns` configuration section.

### Default RFP Types

When using the RFP parser with the default configuration, documents are categorized as:

- **BR** - Business Requirements
- **MR** - Mandatory Requirements
- **SR** - Security Requirements
- **PR** - Performance Requirements

### Custom Document Types

You can define custom document types by configuring your own requirement patterns:

```yaml
rfp:
    requirements:
        patterns:
            - '\b(REQ-\d+)\b' # General requirements (REQ-001, REQ-123)
            - '\b(FUNC\d{3})\b' # Functional specs (FUNC001, FUNC042)
            - '\b(NFR\d+)\b' # Non-functional requirements
            - '\b(SEC-[A-Z]+)\b' # Security requirements (SEC-AUTH, SEC-ENCRYPT)
```

### General Documents

For non-RFP documents, simply omit the `rfp` configuration section entirely. Documents will be indexed without type categorization, making the riff suitable for any markdown documentation.

## Configuration Examples

### Example 1: General Documentation (No RFP Features)

For indexing general markdown documentation without RFP-specific features:

```yaml
doc-indexer:
    paths:
        database: '.aria/db/doc-indexer/vectors.sqlite'
        outputDir: '.aria/db/doc-indexer'
        defaultIndexDir: 'docs'

    model: 'text-embedding-3-large'
    dimensions: 3072
    maxEmbedChars: 20000
    sections: 'full'
    weightResponse: 1.0
    useFts: true
    hybrid: true
    alpha: 0.2
    showMetadata: true
    highlight: true
    # Note: No 'rfp' section - riff works as general document indexer
```

### Example 2: RFP with Static Metadata

For RFP responses where you want to hard-code vendor/client information:

```yaml
doc-indexer:
    paths:
        database: '.aria/db/doc-indexer/vectors.sqlite'
        defaultIndexDir: 'rfp-responses'
        fullRfpPath: 'full-rfp/source.md'

    rfp:
        metadata:
            vendor: 'Acme Corporation'
            client: 'Example Industries'
            rfpName: 'Cloud Infrastructure Project'
        requirements:
            patterns:
                - '\b(REQ\d{3})\b'
                - '\b(TECH\d{2})\b'

    model: 'text-embedding-3-large'
    dimensions: 3072
    useFts: true
    hybrid: true
```

### Example 3: RFP with Dynamic Extraction

For RFPs where metadata should be extracted from document content:

```yaml
doc-indexer:
    rfp:
        extraction:
            vendor:
                pattern: 'Submitted by:\s*([^\n]+)'
                fallback: 'Unknown Vendor'
            client:
                pattern: 'Client Organization:\s*([^\n]+)'
                fallback: null
            proposalDate:
                pattern: 'Proposal Date:\s*(\d{4}-\d{2}-\d{2})'
                dateFormat: 'YYYY-MM-DD'
        requirements:
            patterns:
                - '\b(BR\d{1,4})\b'
                - '\b(FR\d{1,4})\b' # Functional Requirements
                - '\b(NF\d{1,4})\b' # Non-Functional Requirements
```

### Example 4: Custom Document Classification

For technical specifications with custom identifier schemes:

```yaml
doc-indexer:
    paths:
        defaultIndexDir: 'specs'

    rfp:
        requirements:
            patterns:
                - '\b(API-\d+)\b' # API specifications
                - '\b(DB-SCHEMA-\d+)\b' # Database schemas
                - '\b(UI-\d+[A-Z]?)\b' # UI components
                - '\b(ARCH-[A-Z]+-\d+)\b' # Architecture decisions

    model: 'text-embedding-3-small'
    dimensions: 1536
    sections: 'full'
```

## Search Strategies

doc-indexer implements a sophisticated multi-pass retrieval system with Reciprocal Rank Fusion (RRF) for robust ranking.

### Multi-Pass RRF Fusion

The search engine performs four retrieval passes and fuses results using RRF:

1. **Pass 1 - Semantic Search**: Cosine similarity between query embedding and document embeddings
2. **Pass 2 - Lexical OR Query**: FTS5 search with cleaned query terms (stop words removed)
3. **Pass 3 - Synonym Expansion**: FTS5 search with expanded abbreviations and synonyms
4. **Pass 4 - Phrase Proximity**: FTS5 NEAR query for multi-term phrases (within 5 words)

RRF fusion combines rankings from all passes using the formula:

```text
RRF_score = sum(1 / (k + rank_i)) for each pass
```

Where `k=60` (standard RRF constant) and `rank_i` is the document's rank in pass `i`.

### Query Processing Pipeline

Queries go through several transformations:

1. **Stop Word Removal**: Common words (the, is, are, etc.) are filtered
2. **Abbreviation Expansion**: Domain abbreviations expand to full terms (SLA -> service level agreement)
3. **Synonym Matching**: Queries match related terms (incident, issue, ticket, problem)
4. **Phrase Detection**: Multi-word queries trigger proximity matching

### Scoring Formula

Final document scores combine multiple signals:

```text
score = (0.25 * title_score) +
        (0.15 * identifier_score) +
        (0.30 * semantic_score) +
        (0.20 * lexical_score) +
        (0.10 * phrase_score) +
        bonuses
```

**Bonuses:**

- **Identifier Boost** (0.20): When identifier matches exactly (e.g., query "MR27" matches document MR27)
- **Phrase Boost** (0.15): When exact query phrase appears in document content
- **Pass Bonus** (0.025 per pass, max 0.10): Documents appearing in multiple retrieval passes

All weights are configurable via `search.weights` in the config file.

### When to Use Hybrid vs Pure Semantic

- **Hybrid (default)**: Best for general queries mixing concepts and keywords
- **Pure Semantic** (`--no-hybrid`): Better for conceptual queries without specific terms
- **High Alpha** (`--alpha 0.6+`): When exact keyword matches are critical

## Index Enrichment

doc-indexer enriches documents at index time to improve semantic search accuracy.

### Contextual Embedding Prefixes

Each document section gets a contextual prefix before embedding:

```text
[CATEGORY: specific] [DEPT: operations-engineering-noc] [ID: BR10] [TITLE: Meraki Dashboard]
Actual document content follows here...
```

This helps the embedding model understand document context and improves retrieval for category/department-specific queries.

### Abbreviation Injection

Common abbreviations found in content are expanded inline:

- Original: "Implement SLA monitoring"
- Enriched: "Implement SLA (service level agreement) monitoring"

This improves both semantic and lexical matching for abbreviation queries.

### Domain Keyword Extraction

Domain-specific products and concepts are identified and highlighted:

- **Products**: Meraki, Cisco, Sentinel, ServiceNow, etc.
- **Concepts**: zero trust, disaster recovery, high availability, etc.

Keywords are extracted from content and added as searchable metadata.

### Configuration for Domain Portability

All enrichment values are configurable for domain portability:

```yaml
search:
    # Abbreviation expansions
    abbreviations:
        sla: ['service', 'level', 'agreement']
        siem: ['security', 'information', 'event', 'management']

    # Identifier prefix expansions
    identifierExpansions:
        MR: ['management', 'requirement', 'managed']
        BR: ['business', 'requirement']
        SR: ['security', 'requirement']

    # Domain-specific products
    domainProducts:
        - 'meraki'
        - 'cisco'
        - 'servicenow'

    # Domain-specific concepts
    domainConcepts:
        - 'zero trust'
        - 'disaster recovery'
        - 'high availability'
```

This makes doc-indexer adaptable to any domain (law, construction, healthcare, etc.) by updating config values.

## Benchmarks

doc-indexer includes a benchmark suite to measure search accuracy across representative queries.

### Running Benchmarks

```sh
# Run the full benchmark suite
bun benchmarks/doc-indexer/run.ts

# View benchmark results
cat benchmarks/doc-indexer/results.md
```

### Current Results (Run 5)

The latest benchmark run achieved **100% pass rate (15/15 queries)**.

| Query                                         | Expected | Actual Rank | Pass |
| --------------------------------------------- | -------- | ----------- | ---- |
| wifi coverage meeting rooms                   | MR27     | 1           | YES  |
| network redundancy failover high availability | BR5      | 1           | YES  |
| authentication and security WPA3 encryption   | SR2      | 1           | YES  |
| IP addressing VLAN subnet overlap             | BR16     | 1           | YES  |
| incident management ticketing tracking        | BR14     | 1           | YES  |
| bandwidth throughput requirements             | BR8      | 1           | YES  |
| firewall and access control                   | SR1      | 1           | YES  |
| cabling UPS power redundancy                  | BR12     | 1           | YES  |
| MR27                                          | MR27     | 1           | YES  |
| service level agreement                       | BR7      | 1           | YES  |
| disaster recovery backup                      | BR6      | 1           | YES  |
| SIEM                                          | SR1      | 1           | YES  |
| network monitoring and management             | MR2      | 1           | YES  |
| Meraki dashboard                              | BR10     | 1           | YES  |
| zero trust                                    | SR9      | 1           | YES  |

### Benchmark Query Categories

The benchmark suite tests various query types:

1. **Conceptual queries**: "network redundancy failover high availability"
2. **Technical terms**: "authentication and security WPA3 encryption"
3. **Abbreviations**: "SIEM", "SLA"
4. **Exact identifiers**: "MR27"
5. **Product names**: "Meraki dashboard"
6. **Domain concepts**: "zero trust", "disaster recovery"

### Interpreting Results

- **Rank 1**: Query returned expected document as top result (ideal)
- **Rank 2-3**: Expected document in top 3 (acceptable for some queries)
- **Rank 4+**: May indicate need for config tuning or reindexing

### Tuning for Better Results

If benchmarks show failures:

1. **Re-index with fresh embeddings**: `bun riffs/doc-indexer/src/cli.ts index --reset`
2. **Adjust scoring weights**: Modify `search.weights` in config
3. **Add domain terms**: Expand `abbreviations`, `domainProducts`, `domainConcepts`
4. **Check content**: Verify expected documents actually contain query-relevant content

## Technical Details

### Database Schema

doc-indexer uses SQLite with the following main tables:

- `documents` - Stores document content and metadata
- `embeddings` - Stores OpenAI embedding vectors
- `fts_documents` - Full-text search index (FTS5)

### Embedding Process

1. Documents are parsed to extract metadata and content sections
2. Content is chunked to fit within embedding model limits
3. OpenAI's embedding API generates vectors for each chunk
4. Vectors are stored with document references for retrieval

### Hybrid Search Algorithm

The hybrid search combines:

- **Semantic Search**: Cosine similarity between query and document embeddings
- **Lexical Search**: FTS5 BM25 ranking for keyword matching
- **Score Fusion**: Weighted combination using the alpha parameter

Formula: `final_score = (1 - alpha) * semantic_score + alpha * lexical_score`

### Graph Visualization

The interactive HTML viewer provides:

- Node-based document visualization
- Color coding by document type and category
- Interactive filtering and search
- Zoom and pan controls
- Document detail panels
- Export capabilities

## Logging

Logs are written to `.aria/logs/doc-indexer.log` by default (JSON format via Pino).

### Configuration

Configure logging in `config.yaml`:

```yaml
doc-indexer:
    logging:
        level: 'info' # trace, debug, info, warn, error, fatal
        verbose: false # Enable console output
        file: '.aria/logs/doc-indexer.log'
        max_file_size_mb: 10
        max_files: 7
```

### Environment Variables

Override config with environment variables:

- `DOC_INDEXER_LOG_LEVEL`: Log level (trace/debug/info/warn/error/fatal)
- `DOC_INDEXER_LOG_VERBOSE`: Enable console output (true/false)
- `DOC_INDEXER_LOG_FILE`: Log file path

### Verbose Mode

All commands support `-v, --verbose` for real-time console output:

```sh
bun riffs/doc-indexer/src/cli.ts index -v
bun riffs/doc-indexer/src/cli.ts search "network security" -v
bun riffs/doc-indexer/src/cli.ts graph -v
```

## Troubleshooting

### Common Issues

1. **Missing API Key**: Set your OpenAI API key:

    ```sh
    export OPENAI_API_KEY="your-key-here"
    ```

2. **Database Lock**: If the database is locked, ensure no other processes are accessing it.

3. **Memory Issues**: For large document sets, consider indexing in batches.

4. **Graph Not Loading**: Ensure the graph JSON was generated successfully before creating the HTML viewer.

## Performance Tips

- Use `--weight-response 1.8` to prioritize response content in RFP scenarios
- Adjust `--alpha` to balance semantic vs lexical search (lower = more semantic)
- Enable `--hybrid` to combine semantic and lexical search
- Use metadata filters to narrow search scope and improve speed
- Set appropriate `--max-embed-chars` based on your document sizes

## Advanced Features

### Batch Processing

For large document collections, process in batches:

```sh
# Index first batch
bun riffs/doc-indexer/src/cli.ts index ./batch1 --reset

# Add subsequent batches
bun riffs/doc-indexer/src/cli.ts index ./batch2
bun riffs/doc-indexer/src/cli.ts index ./batch3
```

### Custom Embedding Models

Use different OpenAI models for different use cases:

```sh
# Faster, smaller embeddings
bun riffs/doc-indexer/src/cli.ts index --model text-embedding-3-small --dimensions 1536

# Higher quality embeddings
bun riffs/doc-indexer/src/cli.ts index --model text-embedding-3-large --dimensions 3072
```

### Export for Analysis

Export search results for further analysis:

```sh
# Export to JSON
bun riffs/doc-indexer/src/cli.ts search "compliance" --json > compliance.json

# Export graph for custom visualization
bun riffs/doc-indexer/src/cli.ts graph --include-content -o full-graph.json
```

## Support

For issues or questions about doc-indexer, please refer to the main Aria documentation or contact the development team.
