---
name: hr-staffer
description: Staff directory parsing with org chart generation and semantic search
---

# Hr Staffer

## Purpose

Parses CSV staff directory files, validates and sanitizes employee data with Zod schemas, builds hierarchical organizational trees, and generates org charts in multiple formats (plain text, Markdown, Mermaid diagrams). Stores employee data in SQLite for querying. Supports decomposing org chart markdown into sections for indexing and semantic search across staff directory data. Mermaid output includes configurable team breakdowns for targeted sub-team diagrams.

## When to use

- Generating org charts from a CSV staff directory export
- Visualizing team structure with Mermaid diagrams including sub-team breakdowns
- Querying staff data by department, manager, title, or other fields
- Indexing and searching org chart content with semantic search
- Validating and sanitizing CSV staff directory data before processing

## Pipeline

1. Parse CSV staff directory file validating the exact 11-column structure
2. Sanitize data: trim whitespace, normalize manager references, fix name mismatches
3. Validate employee data: check for duplicates, circular references, orphaned employees, single root
4. Build hierarchical organizational tree from manager relationships
5. Store employee data in SQLite database
6. Generate output formats: plain text (indented tree), Markdown (headings), Mermaid (diagrams with team breakdowns)
7. For search: decompose org chart markdown into sections, index with embeddings, and enable semantic search

## Parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `csvFile` | `string` | no | Path to CSV staff directory file (positional argument, defaults to config path) |
| `-c, --config` | `string` | no | Path to config file |
| `-o, --output` | `string` | no | Output directory for generated files (overrides config) |
| `--text-only` | `flag` | no | Generate only text output |
| `--markdown-only` | `flag` | no | Generate only markdown output |
| `--mermaid-only` | `flag` | no | Generate only mermaid diagram |
| `--no-title` | `flag` | no | Exclude job titles from output |
| `--no-department` | `flag` | no | Exclude departments from output |
| `--include-email` | `flag` | no | Include email addresses in output |
| `--max-depth` | `number` | no | Maximum tree depth to display |

## Output

Multiple files in the output directory: org-chart.txt (plain text hierarchy), org-chart.md (Markdown with headings), org-chart.mermaid (combined Mermaid diagram), executive-leadership.mermaid (top-level diagram), and individual team-{leader}.mermaid files. SQLite database with employee records. For search: ranked results from indexed org chart content.

## Constraints

- Input CSV must have exactly 11 columns in the required order: Display Name, First Name, Last Name, Email Address, Title, Department, Manager, Mobile, Street Address, City, Country
- Column headers must match exactly (case-sensitive)
- Display Name and Email Address must be unique across all employees
- Manager field must reference an existing Display Name or be "No Manager" for the root employee
- Exactly one root employee (No Manager) is required
- No circular reporting relationships allowed

## Conventions

- Configuration is in config.yaml co-located in the riff directory
- Team breakdowns for Mermaid are configured in the mermaid.breakDownTeams section
- Embedding provider is configurable: openai, gemini, or ollama
- Invocation pattern: $RIFF [csvFile] [options]
- Run without arguments to use the CSV path from config

## Examples

### Generate org charts from staff directory

```sh
$RIFF sources/cello/staff/cello-staff-active-directory.csv
```

Creates org-chart.txt, org-chart.md, and Mermaid diagram files in the configured output directory

### Generate only Mermaid diagrams limited to 3 levels

```sh
$RIFF sources/staff.csv --mermaid-only --max-depth 3
```

Creates Mermaid diagram files showing only the top 3 levels of the org hierarchy

### Search indexed org chart content

```sh
$RIFF search "engineering team leads"
```

Returns relevant org chart sections matching the query about engineering team leadership
