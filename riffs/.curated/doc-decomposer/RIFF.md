---
name: doc-decomposer
description: RFP document analysis and decomposition into categorized request/response pairs
---

# Doc Decomposer

## Purpose

Decomposes large RFP documents into individual request/response pairs organized by category (standard, hybrid, specific) and department. Matches pairs with metadata for categorization and ownership, handles assets with automatic path updates, and generates comprehensive index files and statistics. This is the primary riff for breaking down monolithic RFP documents into manageable, categorized units for further indexing and response generation.

## When to use

- Breaking down a large RFP markdown document into individual request/response pair files
- Organizing RFP responses by category (standard, hybrid, specific) and department
- Generating statistics and index files for decomposed RFP responses
- Preparing RFP content for downstream indexing by doc-indexer or vector-indexer

## Pipeline

1. Parse metadata classification file to extract categorization and ownership for each requirement
2. Parse RFP markdown file to extract request/response pairs using IMPORTANT and NOTE block patterns
3. Match extracted pairs with metadata by identifier (e.g., BR01, MR27)
4. Organize output by category and department directory structure
5. Copy and update asset references (images, diagrams) with corrected paths
6. Generate per-category and per-department README index files
7. Generate statistics report with counts by category, department, and priority

## Parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `--metadata, -m` | `string` | yes | Path to metadata classification file containing categorization for each requirement |
| `--rfp, -r` | `string` | yes | Path to RFP markdown file containing request/response pairs |
| `--output, -o` | `string` | no | Output directory for decomposed files (default from config) |
| `--descriptions, -d` | `string` | no | Directory containing description files |
| `--verbose, -v` | `flag` | no | Enable verbose logging output |

## Output

A directory tree organized as output/{category}/{department}/{id}-{title}.md with README.md index files at each level and a statistics.md report at the root. Each decomposed file contains full metadata, original request content with IMPORTANT blocks, response content with NOTE blocks, and updated asset references.

## Constraints

- Input metadata file must follow the expected format with numbered entries containing Priority, Category, Department, Leader, and Customise fields
- Input RFP file must use IMPORTANT blocks for request markers and NOTE blocks for response markers
- Requirement identifiers must match regex patterns defined in config (e.g., BR43, MR27)
- Categories must be one of: standard, hybrid, specific (as defined in config)
- Output parent directory must exist or be creatable

## Conventions

- Always use absolute paths for input and output
- Configuration is in config.yaml co-located in the riff directory
- Company name and compliance statement are configurable in config.yaml responseTemplates section
- Invocation pattern: $RIFF [args]
- Run doc-decomposer before doc-indexer to prepare content for indexing

## Examples

### Decompose RFP with metadata and source files

```sh
$RIFF --metadata .aria/exports/rfp-pairs-tagged.md --rfp .aria/exports/rfp-response-form.md --output .aria/exports/rfp-decomposed
```

Creates categorized directory tree with individual request/response files, README indexes, and statistics report

### Decompose with verbose output for debugging

```sh
$RIFF -m metadata.md -r rfp.md -v
```

Runs decomposition with detailed console logging showing each step of the extraction and matching process
