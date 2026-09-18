# Aria Doc Decomposer Riff

Decomposes large RFP documents into individual request/response pairs, organized by category and department with full metadata tracking.

> [!IMPORTANT]
> Currently, this is a file system based database. This will and must be replicated an sqlite database asap

## What it does

- Extracts request/response pairs from markdown RFP documents
- Matches pairs with metadata for categorization and ownership
- Organizes output by category (`standard`, `hybrid`, `specific`) and department
- Handles assets (images, diagrams) with automatic path updates
- Generates comprehensive index files and statistics

## Installation

This riff is part of the Aria monorepo and is not published as a standalone package. For AI agents and direct execution, use bun commands. For convenience, npm scripts are also available.

## Usage

### Basic Usage

Decompose RFP documents into categorized request/response pairs:

```sh
bun riffs/doc-decomposer/src/cli.ts --metadata <metadata-file> --rfp <rfp-file> --output <output-dir>
```

### Example Command

Using bun (recommended for AI agents):

```sh
bun riffs/doc-decomposer/src/cli.ts \
    --metadata ~/git/_sources/_uicnz/aria/.aria/exports/cello/clients/inland-revenue-department/response/rfp-responses-original/rfp-request-response-pairs-tagged.md \
    --rfp ~/git/_sources/_uicnz/aria/.aria/exports/cello/clients/inland-revenue-department/response/rfp-responses-original/rfp-wifi-and-internet-rfp-appendix-a-response-form.md \
    --output ~/git/_sources/_uicnz/aria/.aria/exports/cello/clients/inland-revenue-department/response/rfp-responses-decomposed
```

Using npm scripts:

```sh
bun run doc-decomposer:dev -- \
  --metadata ~/git/_sources/_uicnz/aria/.aria/exports/cello/clients/inland-revenue-department/response/rfp-responses-original/rfp-request-response-pairs-tagged.md \
  --rfp ~/git/_sources/_uicnz/aria/.aria/exports/cello/clients/inland-revenue-department/response/rfp-responses-original/rfp-wifi-and-internet-rfp-appendix-a-response-form.md \
  --output ~/git/_sources/_uicnz/aria/.aria/exports/cello/clients/inland-revenue-department/response/rfp-responses-decomposed
```

## Quick Reference: npm Scripts

For convenience, these commands are also available as npm scripts:

| bun Command                                          | npm Script Equivalent                    |
| ---------------------------------------------------- | ---------------------------------------- |
| `bun riffs/doc-decomposer/src/cli.ts <options>`      | `bun run doc-decomposer:dev <options>`   |
| `bun riffs/doc-decomposer/src/cli.ts <options>`      | `bun run doc-decomposer:start <options>` |
| `tsc --noEmit -p riffs/doc-decomposer/tsconfig.json` | `bun run doc-decomposer:typecheck`       |

**For AI agents:** Use bun commands for immediate execution without compilation delays.
**For humans:** Choose your preference - bun commands are more explicit, npm scripts are shorter.

## Input Files

**Metadata File**: Contains categorization and ownership information for each requirement

```markdown
1. **Title (Identifier)**
    - Priority: `Must Fully Comply`
    - Category: `standard`
    - Department: `core-services`
    - Leader: `Ivan Walker`
    - Customise: `no`
```

**RFP File**: Main RFP document with request/response pairs

```markdown
#### Section Title

> [!IMPORTANT]
>
> - Priority: `Must Fully Comply`
> - BR1

Request content...

> [!NOTE]
>
> - Cello agrees to fully comply
> - See Cello response to BR1

Response content...
```

## Output Structure

```tree
output/
├── README.md                 # Main index
├── statistics.md             # Statistics report
├── standard/                 # Standard responses
│   ├── README.md
│   └── <department>/
│       ├── README.md
│       ├── <id>-<title>.md
│       └── assets/<id>/
├── hybrid/                   # Hybrid responses
└── specific/                 # Client-specific responses
```

## Generated Files

Each decomposed file contains:

- Complete metadata (identifier, category, department, leader, etc.)
- Original request content with IMPORTANT blocks
- Response content with NOTE blocks
- Asset references with updated paths

## Options

- `--metadata, -m`: Path to metadata classification file
- `--rfp, -r`: Path to RFP markdown file
- `--output, -o`: Output directory (default: `.aria/exports/rfp-responses-decomposed`)
- `--descriptions, -d`: Directory containing description files
- `--verbose, -v`: Enable verbose logging output
- `--help, -h`: Show help message

## Logging

Logs are written to `.aria/logs/doc-decomposer.log` by default (JSON format via Pino).

### Configuration

Configure logging via `config/config-doc-decomposer.yaml`:

```yaml
logging:
    level: 'info' # trace, debug, info, warn, error, fatal
    verbose: false # Enable console output
    file: '.aria/logs/doc-decomposer.log'
    max_file_size_mb: 10
    max_files: 7
```

### Environment Variables

Override config with environment variables:

- `DOC_DECOMPOSER_LOG_LEVEL`: Log level (trace/debug/info/warn/error/fatal)
- `DOC_DECOMPOSER_LOG_VERBOSE`: Enable console output (true/false)
- `DOC_DECOMPOSER_LOG_FILE`: Log file path

### Verbose Mode

Use `-v` for real-time console output (useful for debugging):

```sh
bun riffs/doc-decomposer/src/cli.ts -m metadata.md -r rfp.md -v
```
