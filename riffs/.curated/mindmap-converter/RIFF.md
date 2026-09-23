---
name: mindmap-converter
description: OPML and FreeMind mindmap to Markdown and JSONL conversion
---

# Mindmap Converter

## Purpose

Converts hierarchical mindmap files (OPML and FreeMind .mm format) into clean, well-structured Markdown documents. Preserves the mindmap hierarchy using proper heading levels (h1-h6) and switches to bullet points after the maximum heading depth. Also supports batch processing with JSONL export for portable, searchable storage, and SQLite database storage for querying. Output follows project Markdown standards including blank lines around headings (MD022), proper list formatting (MD032), and single trailing newline (MD047).

## When to use

- Converting OPML mindmap exports into readable Markdown documentation
- Converting FreeMind (.mm) mindmap files into Markdown
- Batch processing a directory of mindmap files into Markdown with preserved directory structure
- Exporting mindmaps to JSONL format for searchable, appendable storage
- Building a mindmap knowledge base with SQLite database storage for querying
- Validating mindmap file structure before conversion

## Pipeline

1. Auto-detect input format from file extension (.opml or .mm) or use --format flag
2. Parse XML structure using fast-xml-parser
3. Build hierarchical node tree from parsed data
4. Convert tree to Markdown using heading levels (h1 through configurable max, default h6)
5. Switch to bullet points for nodes beyond the maximum heading level
6. Apply project Markdown standards (blank lines around headings, proper list formatting)
7. Write output Markdown file with single trailing newline
8. Optionally store results in SQLite database and/or export to JSONL

## Parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `command` | `enum(convert\|validate\|batch\|export\|export-jsonl\|jsonl-search\|db-stats\|db-list\|db-search)` | yes | Action to perform |
| `input` | `string` | yes | Path to input mindmap file (.opml or .mm) or directory for batch processing |
| `output` | `string` | no | Path for output Markdown file or output directory |
| `-f, --format` | `enum(opml\|mm)` | no | Input format, auto-detected from extension if not specified |
| `-m, --max-heading` | `number` | no | Maximum heading level before switching to bullets (1-6, default: 6) |
| `--no-bullets` | `flag` | no | Disable bullet points after max heading level |
| `--no-hierarchy` | `flag` | no | Flatten hierarchy instead of preserving it |
| `-v, --verbose` | `flag` | no | Enable verbose debug output |

## Output

Markdown file(s) with proper heading hierarchy and formatting. For batch mode, preserves source directory structure. JSONL export produces one JSON record per line with complete tree structure. Database commands output query results to stdout.

## Constraints

- Input must be valid OPML or FreeMind XML format
- Maximum heading depth is 6 levels (h1-h6) before switching to bullet points
- OPML is the recommended format over FreeMind for portability
- Existing output files are not overwritten by default (configurable)

## Conventions

- Use validate command to check file structure before converting
- Use OPML format over FreeMind when possible for better portability
- Use batch command for processing entire directories with database tracking
- JSONL exports append by default - use --no-append to overwrite
- Configuration is in config.yaml co-located in the riff directory
- Invocation pattern: $RIFF [command] [args]

## Examples

### Convert an OPML file to Markdown

```sh
$RIFF convert input.opml output.md
```

Creates output.md with headings reflecting the mindmap hierarchy

### Convert with limited heading depth

```sh
$RIFF convert input.opml --max-heading 3 --verbose
```

Uses h1-h3 headings then switches to bullet points for deeper nodes

### Export directory of mindmaps to JSONL

```sh
$RIFF export-jsonl sources/mindmaps
```

Appends all mindmap structures to the master JSONL file for searchable storage
