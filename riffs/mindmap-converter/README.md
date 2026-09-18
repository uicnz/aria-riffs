# Aria Mindmap Converter Riff

Convert OPML and FreeMind (.mm) mindmap files to human-readable Markdown documentation.

## Overview

This riff converts hierarchical mindmap formats (OPML and FreeMind mind maps) into clean, well-structured Markdown documents. It preserves the mindmap hierarchy using proper Markdown heading levels and list formatting.

## Formats Supported

**Input Formats:**

- **OPML** (.opml) - Mindmap Processor Markup Language, an open standard for mindmaps
- **FreeMind** (.mm) - FreeMind/Freeplane mind map format

**Output Format:**

- **Markdown** (.md) - GitHub Flavored Markdown with proper heading hierarchy

## Format Comparison

### OPML vs FreeMind

Both formats represent hierarchical data as XML but with different schemas:

**OPML** - Simpler, more universal standard:

```xml
<mindmap text="Main Topic">
  <mindmap text="Subtopic">
    <mindmap text="Detail"/>
  </mindmap>
</mindmap>
```

**FreeMind** - Application-specific with visual metadata:

```xml
<node TEXT="Main Topic">
  <node TEXT="Subtopic">
    <node TEXT="Detail"/>
  </node>
</node>
```

OPML is recommended for portability and simplicity.

## Usage

### Convert Command

Primary usage - direct bun execution:

```bash
# Convert OPML to Markdown (auto-detect format)
bun riffs/mindmap-converter/src/cli.ts convert input.opml

# Convert FreeMind to Markdown
bun riffs/mindmap-converter/src/cli.ts convert input.mm

# Specify output path
bun riffs/mindmap-converter/src/cli.ts convert input.opml output.md

# Custom options
bun riffs/mindmap-converter/src/cli.ts convert input.opml \
  --max-heading 4 \
  --no-bullets \
  --verbose
```

Alternative - Bun scripts (optional):

```bash
bun run --cwd riffs/mindmap-converter convert -- input.opml
bun run --cwd riffs/mindmap-converter convert -- input.opml output.md
```

### Validate Command

Validate file structure before conversion:

```bash
# Validate OPML file
bun riffs/mindmap-converter/src/cli.ts validate input.opml

# Validate FreeMind file
bun riffs/mindmap-converter/src/cli.ts validate input.mm
```

### Options

**Convert Command Options:**

- `-f, --format <format>` - Input format (opml or mm), auto-detected if not specified
- `-m, --max-heading <level>` - Maximum heading level (1-6, default: 6)
- `--no-bullets` - Disable bullet points after max heading level
- `--no-hierarchy` - Flatten hierarchy instead of preserving it
- `-v, --verbose` - Enable verbose output

## Configuration

The riff uses a YAML configuration file for default settings. Configuration can be customized via:

1. **YAML file**: `config.yaml`
2. **Environment variables**: Override config values with `MINDMAP_*` variables
3. **CLI options**: Command-line flags override both config and env variables

### Configuration File

Location: `config.yaml`

```yaml
# Conversion settings
conversion:
    default_format: 'headers' # Default output format
    max_heading_level: 6 # Maximum heading level (1-6)
    use_bullet_points: true # Use bullets after max heading
    preserve_hierarchy: true # Maintain hierarchical structure

# Output settings
output:
    file_extension: '.md' # Output file extension
    overwrite_existing: false # Allow overwriting existing files
    auto_detect_format: true # Auto-detect input format

# Validation settings
validation:
    strict_mode: false # Strict validation of input files
    require_title: false # Require title in OPML files

# Logging settings
logging:
    level: 'INFO' # Logging level: DEBUG, INFO, WARN, ERROR
    verbose: false # Enable verbose output
```

### Environment Variables

Override configuration values using environment variables:

```bash
# Conversion settings
export MINDMAP_DEFAULT_FORMAT=headers
export MINDMAP_MAX_HEADING_LEVEL=4
export MINDMAP_USE_BULLET_POINTS=true
export MINDMAP_PRESERVE_HIERARCHY=true

# Output settings
export MINDMAP_FILE_EXTENSION=.md
export MINDMAP_OVERWRITE_EXISTING=false
export MINDMAP_AUTO_DETECT=true

# Validation settings
export MINDMAP_STRICT_MODE=false
export MINDMAP_REQUIRE_TITLE=false

# Logging settings
export MINDMAP_LOG_LEVEL=INFO
export MINDMAP_VERBOSE=true
```

### Custom Config File

Specify a custom configuration file:

```bash
bun riffs/mindmap-converter/src/cli.ts --config /path/to/custom-config.yaml convert input.opml
```

### Configuration Validation

The riff uses Zod schemas to validate configuration at runtime, ensuring type safety and catching configuration errors early.

## Logging

The riff uses Pino for fast, structured logging with dual output.

### Log Outputs

- **Console**: Pretty-printed, colorized, human-readable format
- **File**: JSON format in `.aria/logs/mindmap-converter.log` with automatic rotation

### Log Files

- **Location**: `.aria/logs/` directory at project root
- **Format**: Newline-delimited JSON (NDJSON) for programmatic parsing
- **Rotation**: Daily rotation (new file each day) + size-based rotation (10MB default)
- **Retention**: Keeps last 7 log files by default
- **Naming**: `mindmap-converter.1.log`, `mindmap-converter.2.log`, etc.

### Log Levels

The riff supports four log levels following industry standards:

- **DEBUG**: Detailed diagnostic information (visible with --verbose flag)
- **INFO**: General informational messages (default level)
- **WARN**: Warning messages for potential issues
- **ERROR**: Error messages for failures

### Configuration

Configure logging in `config.yaml`:

```yaml
logging:
    level: 'INFO' # Minimum level to log
    verbose: false # Enable debug logging
    file: 'mindmap-converter.log' # Log file name
    max_file_size_mb: 10 # Rotate when file reaches this size
    max_files: 7 # Number of rotated files to keep
```

### Environment Variables

Override logging settings:

```bash
export MINDMAP_LOG_LEVEL=DEBUG    # Set minimum log level
export MINDMAP_VERBOSE=true       # Enable verbose/debug mode
export MINDMAP_LOG_FILE=custom.log # Change log file name
export MINDMAP_MAX_FILE_SIZE=20   # Rotate at 20MB
export MINDMAP_MAX_FILES=14       # Keep 14 log files
```

### Example Output

**Console (pretty-printed):**

```txt
[18:30:22] INFO: Conversion completed successfully
    input: "docs/logging/example.opml"
    output: "docs/logging/example.md"
    size: "4.56 KB"
    format: "OPML"
```

**Console (verbose mode):**

```txt
[18:30:22] DEBUG: Reading input file
    inputPath: "docs/logging/example.opml"
[18:30:22] DEBUG: Detected format
    format: "OPML"
[18:30:22] DEBUG: Parsing mindmap structure
[18:30:22] DEBUG: Found mindmap title
    title: "12 Logging Best Practices"
[18:30:22] INFO: Conversion completed successfully
    input: "docs/logging/example.opml"
    output: "docs/logging/example.md"
    size: "4.56 KB"
    format: "OPML"
```

**File (JSON):**

```json
{"level":30,"time":1761543022591,"pid":36632,"hostname":"bird.yoyo.io","input":"docs/logging/example.opml","output":"docs/logging/example.md","size":"4.56 KB","format":"OPML","msg":"Conversion completed successfully"}
{"level":30,"time":1761543123673,"pid":38281,"hostname":"bird.yoyo.io","input":"docs/logging/example.opml","format":"OPML","msg":"File validation successful"}
```

### Best Practices Implemented

This logging implementation follows the 12 Logging Best Practices:

1. **Clear objectives** - Logs track conversion operations and errors
2. **Log levels** - DEBUG, INFO, WARN, ERROR hierarchy
3. **Structured logging** - JSON format with contextual fields
4. **Context and detail** - Every log includes relevant data (file paths, formats, sizes)
5. **Performance** - Pino is the fastest Node.js logger (minimal overhead)
6. **Retention** - Daily and size-based rotation with configurable retention

## JSONL Export

The riff can export mindmaps to JSONL (JSON Lines) format for portable, appendable storage.

### Why JSONL

JSONL format provides:

- **Appendable** - New conversions add lines without rewriting entire file
- **Streamable** - Process one mindmap at a time (memory efficient)
- **Searchable** - Use standard Unix riffs (grep, jq) to query
- **Universal** - Works with any mindmap structure (RFPs, logging guides, org charts, etc.)
- **Complete** - Each line contains full hierarchical tree as blob
- **Portable** - Share between systems, version control friendly

### JSONL Record Format

Each line contains one complete mindmap:

```json
{
    "file_path": "sources/mindmaps/example.opml",
    "format": "opml",
    "title": "Example Mindmap",
    "node_count": 50,
    "tree": {
        "text": "Root Node",
        "children": [
            {
                "text": "Child Node",
                "children": []
            }
        ]
    },
    "exported_at": "2025-10-27T18:00:00Z"
}
```

**Schema-agnostic:** The `tree` field stores the complete nested structure as a blob - no assumptions about content or depth.

### Export Commands

Export mindmaps to JSONL file:

```bash
# Export to master file (appends by default)
bun riffs/mindmap-converter/src/cli.ts export-jsonl sources/mindmaps

# Export to custom file
bun riffs/mindmap-converter/src/cli.ts export-jsonl sources/mindmaps \
  --output custom.jsonl

# Overwrite instead of append
bun riffs/mindmap-converter/src/cli.ts export-jsonl sources/mindmaps --no-append

# Verbose mode
bun riffs/mindmap-converter/src/cli.ts export-jsonl sources/mindmaps --verbose
```

### Search JSONL

Search exported mindmaps:

```bash
# Search by title or content
bun riffs/mindmap-converter/src/cli.ts jsonl-search "Logging"

# Search in custom file
bun riffs/mindmap-converter/src/cli.ts jsonl-search "RFP" \
  --file custom.jsonl
```

### Query with Standard Riffs

JSONL files work with standard Unix riffs:

```bash
# Count total mindmaps
wc -l .aria/exports/mindmap/mindmaps.jsonl

# Extract all titles
cat .aria/exports/mindmap/mindmaps.jsonl | jq -r '.title'

# Filter by format
cat .aria/exports/mindmap/mindmaps.jsonl | jq 'select(.format == "opml")'

# Get node counts
cat .aria/exports/mindmap/mindmaps.jsonl | jq '.node_count'

# Search for text in trees
grep -i "logging" .aria/exports/mindmap/mindmaps.jsonl

# Pretty-print specific record
sed -n '1p' .aria/exports/mindmap/mindmaps.jsonl | jq '.'
```

### Configuration

Configure JSONL export in `config.yaml`:

```yaml
jsonl:
    master_file: '.aria/exports/mindmap/mindmaps.jsonl'
    append_mode: true # Append by default
```

### Environment Variables

Override JSONL settings:

```bash
export MINDMAP_JSONL_FILE=custom.jsonl
export MINDMAP_JSONL_APPEND=false  # Overwrite mode
```

### Use Cases

**RFP Documentation:**

- Export thousands of RFP mindmaps to master file
- Search by keywords, topics, requirements
- Track all RFP structures in one place

**Knowledge Base:**

- Convert documentation mindmaps to searchable format
- Append new documents as they're created
- Query entire knowledge base with jq

**Content Analysis:**

- Export all mindmaps for analysis
- Count nodes across all documents
- Find patterns and common structures

## Database Storage

The riff can store mindmap records in an SQLite database for querying and batch management.

### Database Commands

**Export to database:**

```bash
# Export mindmaps to database (no markdown files created)
bun riffs/mindmap-converter/src/cli.ts export sources/mindmaps

# Batch convert and save to database
bun riffs/mindmap-converter/src/cli.ts batch sources/mindmaps .aria/exports/mindmap
```

**Query database:**

```bash
# Show database statistics
bun riffs/mindmap-converter/src/cli.ts db-stats

# List all records
bun riffs/mindmap-converter/src/cli.ts db-list

# Filter by status
bun riffs/mindmap-converter/src/cli.ts db-list --status completed

# Filter by format
bun riffs/mindmap-converter/src/cli.ts db-list --format opml

# Search by title or content
bun riffs/mindmap-converter/src/cli.ts db-search "Logging"
```

### Database Schema

Location: `.aria/db/mindmap/mindmaps.db`

```sql
CREATE TABLE mindmaps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_path TEXT NOT NULL UNIQUE,
    format TEXT NOT NULL,
    title TEXT,
    node_count INTEGER NOT NULL,
    content_json TEXT NOT NULL,
    converted_path TEXT,
    status TEXT DEFAULT 'pending',
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

**Features:**

- Stores complete tree structure as JSON
- Tracks conversion status (pending, completed, failed)
- Indexed on file_path, status, format, title
- WAL journal mode for faster reads

### Configuration

```yaml
database:
    path: '.aria/db/mindmap/mindmaps.db'
    table_name: 'mindmaps'
    journal_mode: 'WAL'

batch:
    default_directory: 'sources/mindmaps'
    output_directory: '.aria/exports/mindmap'
    batch_size: 50
    save_interval: 10
    preserve_structure: true
```

## Examples

### Basic Conversion

```bash
# Convert logging best practices OPML to Markdown
bun riffs/mindmap-converter/src/cli.ts convert \
  docs/logging/logging-best-practices.opml

# Output: docs/logging/logging-best-practices.md
```

### Custom Heading Levels

```bash
# Limit to h3 headings, use bullets after that
bun riffs/mindmap-converter/src/cli.ts convert \
  input.opml \
  --max-heading 3 \
  --verbose
```

### Validation

```bash
# Check if file is valid before converting
bun riffs/mindmap-converter/src/cli.ts validate input.opml

# If valid, convert it
bun riffs/mindmap-converter/src/cli.ts convert input.opml
```

## Output Format

The riff generates clean Markdown following these conventions:

- Root node becomes h1 heading
- Child nodes become h2, h3, etc. based on hierarchy
- After max heading level (default h6), uses bullet points
- Blank lines around headings (MD022 compliant)
- Single trailing newline (MD047 compliant)
- Proper list formatting (MD032 compliant)

Example output:

```markdown
# 12 Logging Best Practices

## 1. Have a Clear Game Plan

### Avoid throwing logs everywhere

### Before logging, ask key questions

- Application's main goals
- Critical operations to monitor
- KPIs that matter
```

## Architecture

### Module Structure

```tree
riffs/mindmap-converter/src/
├── cli.ts              # Commander.js CLI interface
├── types.ts            # TypeScript type definitions
├── config.ts           # Configuration constants
├── parse-opml.ts       # OPML parser
├── parse-mm.ts         # FreeMind parser
├── convert-markdown.ts # Markdown converter
└── utils.ts            # Utility functions
```

### Design Principles

- **Modular** - Each module has single responsibility
- **Type-safe** - Full TypeScript strict mode
- **Zero server** - Runs locally without dependencies
- **CLI-first** - Commander.js interface
- **ESM modules** - Modern ES module imports

## Development

### Type Checking

```bash
bun run --cwd riffs/mindmap-converter typecheck
```

### Running Tests

```bash
bun run --cwd riffs/mindmap-converter test
```

### Direct Execution

All modules use ESM with .js extensions in imports for direct bun execution:

```bash
bun riffs/mindmap-converter/src/cli.ts --help
```

## Dependencies

- **fast-xml-parser** - Fast, modern XML parsing
- **commander** - CLI interface and argument parsing

## Related Riffs

- **converter** - DOCX to Markdown conversion with Aria Rules
- **doc-indexer** - Document indexing and knowledge graph generation

## Technical Notes

### Why OPML Over FreeMind

While both formats work, OPML is recommended because:

1. Open standard vs application-specific
2. Simpler XML structure
3. Better portability
4. Wider riff support
5. No visual metadata clutter

### Markdown Standards

Output follows project Markdown standards:

- Blank lines around headings (MD022)
- Lists surrounded by blank lines (MD032)
- Single trailing newline (MD047)
- No duplicate headings (MD024)
- Proper heading hierarchy (MD001)
