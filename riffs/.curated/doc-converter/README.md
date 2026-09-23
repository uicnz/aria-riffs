# Aria Doc Converter Riff

Convert DOCX files to Markdown with 18 Aria Rules for normalization.

## Purpose

Converts DOCX → HTML (Pandoc) → Markdown (Pandoc), then applies 18 mandatory AR rules to normalize and fix Markdown formatting. Optional markdownlint pass available after AR rules.

## Design Principles

- Determinism over performance: identical inputs produce identical outputs
- AR rules are part of conversion, run by default in strict, fixed order
- Can disable individual rules via configuration
- Keeps intermediate HTML for troubleshooting

## Prerequisites

- Pandoc installed and on PATH: `pandoc --version`
- Node.js 24+

## Installation

Part of the Aria monorepo. Use bun commands for direct execution or bun scripts for convenience.

## Usage

### Basic Conversion

Convert DOCX to Markdown:

```sh
bun riffs/doc-converter/src/cli.ts <input> <output>
```

### In-Place Conversion

Convert single file next to source document:

```sh
bun riffs/doc-converter/src/cli.ts sources/my-doc.docx --in-place
# Result: sources/my-doc/my-doc.md
```

### Recursive Directory Conversion

Convert nested directory tree with flat output:

```sh
bun riffs/doc-converter/src/cli.ts sources/nested/ vault/ --dirs-recurse
# Result: vault/doc-a/, vault/doc-b/, vault/doc-c/ (all at same level)
```

Convert nested directory tree preserving structure:

```sh
bun riffs/doc-converter/src/cli.ts sources/nested/ vault/ --dirs-recurse --dirs-preserve
# Result: vault/dept-a/project-1/doc/, vault/dept-b/doc/ (mirrors source structure)
```

### With Linting

Convert with markdownlint report:

```sh
bun riffs/doc-converter/src/cli.ts <input> <output> --lint
```

Convert with markdownlint auto-fix:

```sh
bun riffs/doc-converter/src/cli.ts <input> <output> --lint --lint-fix
```

### With Clean-First

Clean document before conversion (Pandoc docx→docx round-trip):

```sh
bun riffs/doc-converter/src/cli.ts <input> <output> --clean-first
```

The `--clean-first` option runs the DOCX file through Pandoc's normalization process before the main conversion pipeline. It executes `pandoc input.docx -f docx -t docx -o cleaned.docx --standalone`, which converts DOCX → Pandoc's internal AST → DOCX. This round-trip simplifies the document by:

- Converting it through Pandoc's less-expressive intermediate representation
- Preserving structural elements (headings, lists, tables, paragraphs)
- Removing formatting details that don't map to Pandoc's document model (precise margins, complex nested styles)
- Normalizing document elements to fit Pandoc's simpler structure

This is useful for documents with accumulated formatting cruft, complex styling from multiple editors, or malformed internal structures that cause conversion issues. The cleaned DOCX is saved as `{filename}_cleaned.docx` and used for the rest of the pipeline.

## Quick Reference: Bun Scripts

| bun Command                                           | Bun Script Equivalent                         |
| ----------------------------------------------------- | --------------------------------------------- |
| `bun riffs/doc-converter/src/cli.ts <input> <output>` | Direct bun only                               |
| `bun riffs/doc-converter/src/lib/generate-config.ts`  | `bun run --cwd riffs/doc-converter config`    |
| `tsc --noEmit -p riffs/doc-converter/tsconfig.json`   | `bun run --cwd riffs/doc-converter typecheck` |

## CLI Options

- `--type <docx|pptx|xlsx|auto>` - Document type (default: auto)
- `--clean-first` - Run Pandoc round-trip clean before conversion
- `--config <path>` - Load doc-converter configuration (YAML or JSON)
- `--lint` - Run markdownlint after AR rules
- `--lint-fix` - Auto-fix markdownlint issues
- `--lint-config <path>` - Path to .markdownlintrc
- `--in-place` - Export next to source document (single files only)
- `--dirs-recurse` - Traverse subdirectories recursively
- `--dirs-preserve` - Preserve source directory hierarchy in output (requires --dirs-recurse)
- `--no-gitkeep` - Disable .gitkeep file generation in intermediate directories (default: enabled)

## Processing Pipeline

1. DOCX → HTML5 (Pandoc with `--extract-media`, `--wrap=none`, `--standalone`)
2. Extract and rename media files to `{docxname}-{N}.{ext}`
3. Update image references in HTML
4. HTML preprocessing (Cheerio): convert links and tables to Markdown
5. HTML → Markdown (Pandoc GFM with `--wrap=none`)
6. Apply 18 AR rules in fixed order
7. Optional markdownlint report or auto-fix
8. Add .gitkeep files to intermediate directories (directories containing only subdirectories)

## AR Rule Execution Order

Applied in 4 phases:

### Phase 1: Initial Cleanup

- AR014: Remove residual basic HTML tags (excluding `<br>`)
- AR015: Remove HTML comments
- AR013: Unescape Markdown links and auto-link bare URLs
- AR016: Remove lines with only hashes and inline stray hashes

### Phase 2: Basic Formatting

- AR008: Remove leading spaces from Markdown table lines
- AR009: Insert a horizontal rule between consecutive tables
- AR006: Ensure single space after list markers
- AR017: Remove trailing whitespace at end of lines

### Phase 3: Structural

- AR001: Ensure document starts with a single H1; add from filename if missing
- AR002: Demote subsequent H1 headings and their subheadings
- AR010: Insert missing Markdown image references found in HTML
- AR011: Move any image references before the first H1 to immediately after it
- AR012: Set image alt text to nearest preceding heading text

### Phase 4: Final Polish

- AR005: Add a colon after emphasized-only lines used as headings
- AR004: Remove trailing punctuation from headings
- AR003: Ensure exactly one blank line before and after each heading
- AR007: Indent nested bullet lists under ordered lists by 4 spaces
- AR018: Collapse multiple blank lines to a single blank line

## AR Rules Reference

- **AR001** (ensure-h1-header): Ensure document starts with a single H1; add from filename if missing
- **AR002** (demote-subsequent-h1): Demote subsequent H1 headings and their subheadings
- **AR003** (ensure-blank-lines-around-headings): Ensure exactly one blank line before and after each heading
- **AR004** (remove-trailing-punctuation-from-headings): Remove trailing punctuation from headings
- **AR005** (fix-emphasis-as-heading): Add a colon after emphasized-only lines used as headings
- **AR006** (fix-list-marker-spacing): Ensure single space after list markers
- **AR007** (indent-nested-lists): Indent nested bullet lists under ordered lists by 4 spaces
- **AR008** (unindent-tables): Remove leading spaces from Markdown table lines
- **AR009** (insert-table-separators): Insert a horizontal rule between consecutive tables
- **AR010** (extract-missing-images): Insert missing Markdown image references found in HTML
- **AR011** (ensure-images-after-h1): Move any image references before the first H1 to immediately after it
- **AR012** (update-image-alt-text): Set image alt text to nearest preceding heading text
- **AR013** (format-links): Unescape Markdown links and auto-link bare URLs
- **AR014** (remove-html-tags): Remove residual basic HTML tags (excluding `<br>`)
- **AR015** (remove-html-comments): Remove HTML comments
- **AR016** (remove-stray-hashes): Remove lines with only hashes and inline stray hashes
- **AR017** (remove-trailing-whitespace): Remove trailing whitespace at end of lines
- **AR018** (normalize-blank-lines): Collapse multiple blank lines to a single blank line

## Configuration

YAML or JSON config file structure:

```yaml
converter:
    type: docx
    cleanFirst: false
    outputDirectory: .aria/exports/doc-converter
    inPlace: false
    dirsRecurse: false
    dirsPreserve: false
    gitkeep: true

ariaRules:
    enabled: true
    rules:
        AR001: true
        AR002: true
        # ... all 18 AR rules with individual toggles

markdownlint:
    enabled: true
    fix: false
    configPath: .markdownlintrc

markdownlintRules:
    enabled: true
    rules:
        MD001: true # Heading levels should only increment by one level at a time
        MD003: true # Heading style
        MD013: false # Line length (disabled by default)
        # ... 50+ markdownlint rule toggles
```

Location: `config.yaml`

Generate default config with all rules documented:

```sh
bun run --cwd riffs/doc-converter config
```

### Configuration Sections

- **doc-converter**: Basic conversion settings (type, cleanFirst, outputDirectory, inPlace, dirsRecurse, dirsPreserve, gitkeep)
- **ariaRules**: Enable/disable ariaRules system and toggle 18 individual rules (AR001-AR018)
- **markdownlint**: Enable/disable markdownlint validation and set fix mode
- **markdownlintRules**: Enable/disable markdownlintRules system and toggle 50+ individual rules (MD001-MD058)

## Media Handling

- Renames extracted images to `{docxname}-{N}.{ext}` in output directory
- Updates HTML image `src` before HTML→Markdown conversion
- Non-image media kept with original names

## Architecture

### Core Modules

Location: `riffs/doc-converter/`

Key files:

- `src/cli.ts` - Commander.js CLI interface
- `src/lib/types.ts` - TypeScript interfaces
- `src/lib/config.ts` - Configuration management
- `src/lib/schema.ts` - Zod validation schemas
- `src/processors/docx/process-docx.ts` - Main orchestration
- `src/processors/docx/convert-docx.ts` - Pandoc wrappers
- `src/processors/docx/clean-docx.ts` - Clean-first implementation
- `src/rules/ar001.ts` through `src/rules/ar018.ts` - Individual rules
- `src/rules/index.ts` - Rule registry
- `src/shared/apply-rules.ts` - Rule execution engine
- `src/shared/apply-lint.ts` - Markdownlint integration
- `src/shared/extract-media.ts` - Media file handling
- `src/shared/process-html.ts` - HTML preprocessing

### Dependencies

- `pandoc` - Core conversion engine (system dependency)
- `cheerio` - HTML parsing and preprocessing
- `markdownlint` - Markdown validation
- `commander` - CLI framework
- `zod` - Schema validation
- `yaml` - Configuration parsing

## Troubleshooting

### Pandoc not found

Install Pandoc and verify `pandoc --version` works:

```sh
# macOS
brew install pandoc

# Ubuntu/Debian
sudo apt-get install pandoc

# Windows
choco install pandoc
```

### Images not appearing

- Confirm `--resource-path` points to output directory (automatic)
- Check renamed media files exist in output directory
- Review intermediate HTML for image paths

### Table formatting issues

- Check Pandoc table conversion is working
- Verify AR008 and AR009 are enabled
- Review HTML preprocessing stage

## Limitations

- Only DOCX supported (PPTX/XLSX not implemented)
- Single file or directory processing only
- No watch mode
- No API mode
- Requires Pandoc system dependency

## Testing

Type checking only:

```sh
bun run --cwd riffs/doc-converter typecheck
```

No test suite currently exists.
