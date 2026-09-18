# Aria HR Staffer Riff

A TypeScript utility for generating organizational charts from staff directory data in multiple formats.

## Features

- Parse CSV staff directory files
- Validate and sanitize employee data with Zod schemas
- Build hierarchical organizational tree
- Store employee data in SQLite database (libsql)
- Generate multiple output formats:
    - Plain text with indentation
    - Markdown with hierarchical headings
    - Mermaid diagrams with team breakdowns
- Query organizational data from database
- Modular and reusable TypeScript utilities

## Installation

This riff is part of the Aria monorepo and is not published as a standalone package. For AI agents and direct execution, use bun commands. For convenience, Bun scripts are also available.

```sh
bun install
```

## Configuration

The Riff uses `config.yaml`. See `riffs/hr-staffer/fixtures/config.yaml` for an example configuration.

**Key configuration sections:**

- `paths.input.staff` - Path to staff directory CSV file
- `paths.input.chart` - Path to input markdown file for decomposer
- `paths.input.sections` - Directory containing decomposed sections for indexer
- `paths.output.chart` - Output directory for generated charts
- `paths.output.sections` - Output directory for decomposed section files
- `paths.database.file` - Path to SQLite database file
- `output.formats` - Toggle text/markdown/mermaid outputs
- `display` - Control what information appears in outputs
- `mermaid.breakDownTeams` - Generate separate diagrams for specific teams
- `database` - SQLite database storage settings

## Usage

### Direct Execution (bun)

Run the generator with config file settings:

```sh
bun riffs/hr-staffer/src/cli.ts
```

Specify a custom CSV file:

```sh
bun riffs/hr-staffer/src/cli.ts path/to/your-file.csv
```

View all available options:

```sh
bun riffs/hr-staffer/src/cli.ts --help
```

### Convenience Scripts (npm)

Alternatively, use Bun scripts:

```sh
bun run --cwd riffs/hr-staffer start
bun run --cwd riffs/hr-staffer start path/to/your-file.csv
bun run --cwd riffs/hr-staffer start -- --help
```

### CLI Options

```sh
Options:
  -V, --version             Output the version number
  -c, --config <path>       Path to config file (default: config.yaml)
  -o, --output <directory>  Output directory for generated files (overrides config)
  --text-only               Generate only text output
  --markdown-only           Generate only markdown output
  --mermaid-only            Generate only mermaid diagram
  --no-title                Exclude job titles from output (overrides config)
  --no-department           Exclude departments from output (overrides config)
  --include-email           Include email addresses in output (overrides config)
  --max-depth <levels>      Maximum tree depth to display (overrides config)
  -h, --help                Display help for command
```

### Examples

Generate only text output:

```sh
bun riffs/hr-staffer/src/cli.ts path/to/staff.csv --text-only
```

Generate chart without departments, limited to 3 levels:

```sh
bun riffs/hr-staffer/src/cli.ts path/to/staff.csv --no-department --max-depth 3
```

Include email addresses in all outputs:

```sh
bun riffs/hr-staffer/src/cli.ts path/to/staff.csv --include-email
```

Specify custom output directory:

```sh
bun riffs/hr-staffer/src/cli.ts path/to/staff.csv --output custom/output/dir
```

Use custom config file:

```sh
bun riffs/hr-staffer/src/cli.ts --config /path/to/custom-config.yaml
```

### Output Files

The generator creates multiple files in the configured output directory:

1. `org-chart.txt` - Plain text hierarchy
2. `org-chart.md` - Markdown document with headings
3. `org-chart.mermaid` - Combined Mermaid diagram with markdown wrappers
4. `executive-leadership.mermaid` - Top-level executive diagram
5. Individual team files: `team-{leader-name}.mermaid` for each team
6. Optional breakdown files: `overview-{leader-name}.mermaid` and `subteam-{leader-name}.mermaid` when configured

## Database Storage

The riff stores employee data in a SQLite database (using libsql) for efficient querying and analysis.

### Database Configuration

Enable database storage in `config.yaml`:

```yaml
hr-staffer:
    database:
        enabled: true
        dbPath: '.aria/db/hr-staffer/hr-staffer.db'
```

### Database Schema

**employees table:**

- All 11 employee fields from CSV
- UNIQUE constraints on display_name and email
- Indexes on key fields (manager, department, title)
- Timestamps (created_at, updated_at)

**import_metadata table:**

- Tracks each CSV import with date, employee count, tree depth

### Querying the Database

```sh
# Get employee count
sqlite3 .aria/db/hr-staffer/hr-staffer.db "SELECT COUNT(*) FROM employees;"

# Department statistics
sqlite3 .aria/db/hr-staffer/hr-staffer.db "SELECT department, COUNT(*) FROM employees GROUP BY department;"

# Get direct reports for a manager
sqlite3 .aria/db/hr-staffer/hr-staffer.db "SELECT display_name, title FROM employees WHERE manager = 'Manager Name';"
```

## CSV Format

### Required Columns

The input CSV **must** have exactly these 11 columns in this exact order:

1. Display Name
2. First Name
3. Last Name
4. Email Address
5. Title
6. Department
7. Manager
8. Mobile
9. Street Address
10. City
11. Country

**Important:**

- Column headers must match exactly (case-sensitive)
- All 11 columns are required
- Columns must be in the order shown above
- The CSV header will be validated before processing

### Field Requirements

- **Display Name**: Unique identifier for each employee (must be unique)
- **Email Address**: Valid email format (must be unique)
- **Manager**: Display name of employee's manager, or "No Manager" for the CEO/root
- **Title**: Job title (recommended but can be empty)
- **Department**: Department name (recommended but can be empty)
- **Mobile**: Phone number (can be empty or "Unlisted")
- Other fields: Can be empty but column must exist

### CSV Template

```csv
Display Name,First Name,Last Name,Email Address,Title,Department,Manager,Mobile,Street Address,City,Country
Alex Johnson,Alex,Johnson,alex.johnson@example.com,CEO,Executive,No Manager,555-0001,100 Business Ave,Capital City,Country
Sam Taylor,Sam,Taylor,sam.taylor@example.com,CTO,Technology,Alex Johnson,555-0002,200 Tech Blvd,Major City,Country
```

## Data Validation

The generator performs two levels of validation:

### CSV Structure Validation

Before processing data, the CSV structure is validated:

- Correct number of columns (exactly 11)
- Column headers match required names exactly
- CSV contains at least one data row

If CSV structure validation fails, processing stops immediately with a clear error message showing what's wrong and what's required.

### Data Content Validation

After parsing, employee data is validated for:

- Missing required fields (display name, email)
- Duplicate employee names
- Duplicate email addresses
- Invalid manager references
- Circular reporting relationships
- Orphaned employees (not connected to org tree)
- Invalid email formats
- Single root employee requirement

Validation errors will prevent chart generation, while warnings are displayed but don't block output.

## Data Sanitization

Before validation, data is automatically sanitized:

- Trim whitespace from all fields
- Normalize "No Manager" variations (none, n/a, etc.)
- Remove quotes from addresses
- Normalize line breaks
- Fix manager name mismatches
- Standardize department names

## Format Options

All formatters accept optional configuration:

```typescript
const options = {
    includeTitle: true, // Include job titles
    includeDepartment: true, // Include department names
    includeEmail: false, // Include email addresses
    maxDepth: 3, // Limit tree depth
};

formatAsText(orgTree, options);
```

## Project Structure

```txt
src/
  cli.ts                    - CLI entry point (Commander.js)
  config.ts                 - Configuration loading with Zod validation
  schema.ts                 - Zod schemas for validation
  types.ts                  - TypeScript type definitions
  database.ts               - SQLite database operations (libsql)
  parse-csv.ts              - CSV parsing utilities
  sanitize-data.ts          - Data sanitization utilities
  validate-employees.ts     - Employee data validation
  build-tree.ts             - Organizational tree construction
  formatters/
    format-text.ts          - Plain text formatter
    format-markdown.ts      - Markdown formatter
    format-mermaid.ts       - Mermaid diagram formatter
```
