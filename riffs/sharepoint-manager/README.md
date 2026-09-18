# Aria SharePoint Riff

Multi-Strategy Link Extractor with Database and AppleScript Methods

Extracts SharePoint web view links from OneDrive-synced files using two methods: instant database extraction (2,160x faster) or AppleScript UI automation (100% reliable fallback). Features clean 3-layer architecture with automatic fallback between extraction strategies.

## Extraction Methods

### Database Method (Recommended - Instant)

Queries OneDrive's local `SyncEngineDatabase.db` for resourceIDs and constructs SharePoint URLs instantly.

**Performance**: ~1ms per file (2,160x faster than AppleScript)

**Advantages**:

- Instant extraction (2,597 files in ~3 seconds)
- No UI automation overhead
- Cross-platform ready (Windows/macOS/Linux paths configurable)
- Zero authentication required

**Limitations**:

- Requires OneDrive database path configuration
- Files must be synced by OneDrive to appear in database

### AppleScript Method (macOS Fallback)

Uses macOS UI automation to trigger OneDrive's "Copy Link" feature via Finder.

**Performance**: ~2.5 seconds per file

**Advantages**:

- 100% reliable (proven on 2,597 files)
- No database configuration needed
- Handles files not yet in OneDrive database
- Uses OneDrive's official link generation

**Limitations**:

- macOS only
- Slow (UI automation overhead)
- Requires accessibility permissions

### Auto Method (Best of Both)

Tries database first for speed, automatically falls back to AppleScript if needed.

## Installation

This riff is part of the Aria monorepo and is not published as a standalone package. For AI agents and direct execution, use bun commands. For convenience, npm scripts are also available.

## Status

Production-ready. Both extraction methods fully functional and tested.

## Requirements

**For Database Method (Recommended)**:

- OneDrive installed and synced
- Node.js 24+
- OneDrive database path configured in config file

**For AppleScript Method (Fallback)**:

- macOS with OneDrive installed
- Visual Studio Code with Accessibility permissions
- Run `bun riffs/sharepoint/src/cli.ts setup` to configure permissions

## Configuration

### Config File

The riff respects a YAML config file at `config/config-sharepoint-manager.yaml`:

```yaml
sharepoint:
    paths:
        syncFolder: '/path/to/OneDrive/folder'
        outputCsv: '.aria/db/sharepoint/sharepoint.csv'
        outputSqlite: '.aria/db/sharepoint/sharepoint.db'

    links:
        sharePointBase: 'https://yourcompany.sharepoint.com/my'
        extractionDelay: 1500

    database:
        oneDriveDbPath: '~/Library/Containers/com.microsoft.OneDrive-mac/Data/Library/Application Support/OneDrive/settings/Business1/SyncEngineDatabase.db'
        sharePointWebBasePath: 'personal/your_email_company/Documents/YourFolder'
        method: 'auto' # Options: 'auto', 'database', 'applescript'

    output:
        format: 'both' # Options: 'csv', 'sqlite', or 'both'
        saveInterval: 10

    processing:
        batchSize: 50
        retryFailed: false
```

### Configuration Precedence

Configuration follows standard CLI behavior with three levels:

1. **Defaults** (lowest priority) - Hardcoded defaults in config.ts
2. **Config file** - Values from config-sharepoint-manager.yaml
3. **CLI arguments** (highest priority) - Override everything

Example - CLI overrides config file:

```sh
# Config file says outputFormat: 'csv'
# This command overrides to use sqlite only:
bun riffs/sharepoint/src/cli.ts init --output-format sqlite
```

### Storage Options

Three storage formats available:

- **CSV** - Traditional CSV file (backward compatible)
- **SQLite** - libsql database with indexes
- **Both** - Maintains both formats simultaneously

SQLite offers:

- ACID transactions for reliability
- Indexed queries for faster lookups
- Status filtering without loading all records
- Concurrent access with WAL mode

## Setup

Set up accessibility permissions for VS Code:

```sh
bun riffs/sharepoint/src/cli.ts setup
```

Create initial storage with all files (takes seconds):

```sh
bun riffs/sharepoint/src/cli.ts init
```

## Usage

### Available Commands

Check current status and progress:

```sh
bun riffs/sharepoint/src/cli.ts status
```

Process all pending files (database method - instant):

```sh
bun riffs/sharepoint/src/cli.ts process --method database
```

Process with automatic fallback (database first, AppleScript if needed):

```sh
bun riffs/sharepoint/src/cli.ts process --method auto
```

Process with AppleScript only (slow but reliable):

```sh
bun riffs/sharepoint/src/cli.ts process --method applescript
```

Process specific batch sizes:

```sh
bun riffs/sharepoint/src/cli.ts process --method database --batch 10
bun riffs/sharepoint/src/cli.ts process --method database --batch 100
bun riffs/sharepoint/src/cli.ts process --method auto --batch 500
```

Retry failed files with auto fallback:

```sh
bun riffs/sharepoint/src/cli.ts retry-failed --method auto
```

### CLI Options

All config values can be overridden via CLI:

```sh
bun riffs/sharepoint/src/cli.ts [command] [options]

Global Options:
  -c, --config <path>          Path to config file
  -v, --verbose                Enable verbose logging output
  --sync-folder <path>         OneDrive sync folder path
  --output-csv <path>          CSV output file path
  --output-sqlite <path>       SQLite database path
  --sharepoint-base <url>      Base SharePoint URL
  --output-format <format>     Output format: csv, sqlite, or both
  --batch-size <number>        Default batch size
  --save-interval <number>     Save progress every N files
  --extraction-delay <ms>      Clipboard extraction delay in ms

Process Command Options:
  -b, --batch <number>         Process N files in this session
  -m, --method <method>        Extraction method: auto, database, applescript
```

Example with custom config:

```sh
bun riffs/sharepoint/src/cli.ts init --config /path/to/custom-config.yaml
```

Example with CLI overrides:

```sh
bun riffs/sharepoint/src/cli.ts process --method database \
  --output-format sqlite \
  --batch 100 \
  --save-interval 25
```

## Quick Reference: npm Scripts

For convenience, these commands are also available as npm scripts:

| bun Command                                                            | npm Script Equivalent                    |
| ---------------------------------------------------------------------- | ---------------------------------------- |
| `bun riffs/sharepoint/src/cli.ts setup`                                | `bun run sharepoint:setup`               |
| `bun riffs/sharepoint/src/cli.ts init`                                 | `bun run sharepoint:init`                |
| `bun riffs/sharepoint/src/cli.ts status`                               | `bun run sharepoint:status`              |
| `bun riffs/sharepoint/src/cli.ts process --method database`            | `bun run sharepoint:process`             |
| `bun riffs/sharepoint/src/cli.ts process --method database --batch 50` | `bun run sharepoint:process:batch`       |
| `bun riffs/sharepoint/src/cli.ts process --method auto`                | `bun run sharepoint:process:auto`        |
| `bun riffs/sharepoint/src/cli.ts process --method applescript`         | `bun run sharepoint:process:applescript` |
| `bun riffs/sharepoint/src/cli.ts retry-failed --method auto`           | `bun run sharepoint:retry`               |
| `tsc --noEmit -p riffs/sharepoint/tsconfig.json`                       | `bun run sharepoint:typecheck`           |

For AI agents: Use bun commands for explicit control over extraction method.

For humans: npm scripts provide convenient defaults (database method for speed).

## Special Character Support

The script handles all types of special characters in file and folder names:

- **Apostrophes**: `Hall's Group Ltd`, `McDonald's Report.docx` SUPPORTED
- **Brackets**: `[Draft] Document.pdf`, `Report [Final].xlsx` SUPPORTED
- **Quotes**: `"Important" File.doc`, `Contract "Version 2".pdf` SUPPORTED
- **Symbols**: `Report & Analysis.xlsx`, `Cost @ 50%.docx` SUPPORTED
- **Unicode**: `Café Menu.pdf`, `Résumé.doc` SUPPORTED
- **Spaces**: `Multi Word Document Name.pptx` SUPPORTED

Technical Implementation: Uses temporary AppleScript files and JSON.stringify() to avoid shell escaping issues that previously caused failures.

## Common Workflows

Using bun commands:

```sh
# Process all files with database method (instant)
bun riffs/sharepoint/src/cli.ts process --method database

# Process with automatic fallback
bun riffs/sharepoint/src/cli.ts process --method auto

# Process specific batch with database method
bun riffs/sharepoint/src/cli.ts process --method database --batch 100

# Retry failed files with fallback
bun riffs/sharepoint/src/cli.ts retry-failed --method auto
```

Using npm scripts:

```sh
# Process all files with database method
bun run sharepoint:process

# Process batch with database method
bun run sharepoint:process:batch

# Process with automatic fallback
bun run sharepoint:process:auto

# Retry failed files
bun run sharepoint:retry
```

## How It Works

### Phase 1: Initial Scan (Instant)

Creates storage with basic file information:

- File names and paths
- Download links (direct download URLs)
- Directory view links (opens folder in SharePoint)
- Empty web view links (to be filled in Phase 2)

### Phase 2: Link Extraction

**Database Method** (Recommended):

1. Query OneDrive's local `SyncEngineDatabase.db` for file's resourceID
2. Construct SharePoint URL using resourceID and file path
3. Save URL and metadata to storage

**AppleScript Method** (Fallback):

1. Use AppleScript to select file in Finder
2. Trigger OneDrive's "Copy Link" via Control+Click
3. Extract SharePoint URL from clipboard
4. Save URL to storage

### Processing Time

**Database method**: ~1ms per file (instant queries)

**AppleScript method**: ~2.5 seconds per file (UI automation)

Both methods are fully interruptible with Ctrl+C.

## Storage Schema

Both CSV and SQLite store the same data fields:

**File Identity**:

- `name` - Filename
- `path` - Relative path from sync folder
- `full_path` - Absolute local file path (unique key in SQLite)
- `file_extension` - File extension in lowercase

**Generated Links**:

- `download_link` - Direct download URL
- `directory_view_link` - Opens containing folder in SharePoint
- `web_view_link` - SharePoint web view with document ID

**Processing Status**:

- `web_view_status` - pending, completed, or failed
- `error_message` - Error details for failed extractions
- `extraction_method` - Method used: database, applescript
- `resource_id` - OneDrive resourceID (32-character hex string)
- `parent_resource_id` - Parent folder resourceID
- `etag` - Entity tag for versioning

**File Metadata**:

- `size_mb` - File size in megabytes
- `modified` - Last modified timestamp (ISO 8601)

SQLite additional fields:

- `id` - Auto-increment primary key
- `created_at` - Record creation timestamp
- `updated_at` - Last update timestamp

SQLite indexes for fast queries:

- `idx_web_view_status` - Fast filtering by status
- `idx_full_path` - Fast lookups by file path
- `idx_name` - Fast searches by filename
- `idx_file_extension` - Fast filtering by file type
- `idx_resource_id` - Fast lookups by OneDrive resourceID

### File Type Filtering

Query files by extension using SQLite:

```sql
-- Get all PDF files
SELECT name, path FROM sharepoint_files WHERE file_extension = '.pdf';

-- Count files by type
SELECT file_extension, COUNT(*) as count
FROM sharepoint_files
GROUP BY file_extension
ORDER BY count DESC;
```

Common file types in SharePoint:

- `.pdf` - PDF documents
- `.docx` - Word documents
- `.xlsx` - Excel spreadsheets
- `.pptx` - PowerPoint presentations
- `.png`, `.jpg`, `.jpeg` - Images
- `.vsdx` - Visio diagrams

## Project Structure

```tree
riffs/sharepoint/
├── README.md                    # Documentation
├── tsconfig.json                # TypeScript configuration
├── src/                         # Source code (3-layer architecture)
│   ├── cli.ts                   # CLI entry point
│   ├── config.ts                # Configuration management
│   ├── schema.ts                # Zod validation schemas
│   ├── types.ts                 # TypeScript interfaces
│   ├── storage/                 # Persistence layer
│   │   ├── store-csv.ts        # CSV operations
│   │   └── store-sqlite.ts     # SQLite database operations
│   ├── core/                    # Business logic
│   │   ├── scan-files.ts       # Directory traversal
│   │   └── process-links.ts    # Link processor orchestrator
│   └── extractors/              # Extraction strategies
│       ├── define-extractor.ts  # Base extractor interface
│       ├── orchestrate-extraction.ts # Strategy coordinator
│       ├── extract-database.ts  # Database extraction
│       └── extract-applescript.ts # AppleScript extraction
└── docs/
    ├── link-extraction-strategies.md # Technical deep-dive on extraction methods
    └── plans/                   # Implementation plans

config/
└── config-sharepoint-manager.yaml       # User configuration

.aria/db/sharepoint/
├── sharepoint.csv               # CSV storage (if enabled)
└── sharepoint.db                # SQLite storage (if enabled)
```

## Architecture

Clean 3-layer architecture with pluggable extraction strategies:

**Storage Layer** (`storage/`):

- Persistence adapters for CSV and SQLite
- Abstracted for future backends (PostgreSQL, MongoDB)

**Core Layer** (`core/`):

- Business logic independent of extraction method
- Link processor orchestrates scanning and extraction
- File scanning with URL construction

**Extraction Layer** (`extractors/`):

- Pluggable strategies implementing BaseExtractor interface
- Database extractor (queries OneDrive DB)
- AppleScript extractor (UI automation)
- Orchestrator with automatic fallback

All files follow action-noun naming pattern for consistency.

## Logging

Logs are written to `.aria/logs/sharepoint.log` by default (JSON format via Pino).

### Configuration

Configure logging in `config/config-sharepoint-manager.yaml`:

```yaml
sharepoint:
    logging:
        level: 'info' # trace, debug, info, warn, error, fatal
        verbose: false # Enable console output
        file: '.aria/logs/sharepoint.log'
        max_file_size_mb: 10
        max_files: 7
```

### Environment Variables

Override config with environment variables:

- `SHAREPOINT_LOG_LEVEL`: Log level (trace/debug/info/warn/error/fatal)
- `SHAREPOINT_LOG_VERBOSE`: Enable console output (true/false)
- `SHAREPOINT_LOG_FILE`: Log file path

### Verbose Mode

Use `-v` for real-time console output (useful for debugging):

```sh
bun riffs/sharepoint/src/cli.ts status -v
bun riffs/sharepoint/src/cli.ts process -v
bun riffs/sharepoint/src/cli.ts init -v
```

## Future Development

Planned features:

- File normalization (lowercase, dashes, no special characters)
- Directory reorganization capabilities
- Rollback and mapping functionality
- Sync between original and clean file systems
- REST API endpoints for programmatic access
- Additional storage backends (PostgreSQL, MongoDB)
