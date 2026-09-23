---
name: doc-converter
description: DOCX to Markdown conversion with 18 Aria Rules for normalization
---

# Doc Converter

## Purpose

Converts DOCX files to normalized Markdown through a multi-stage pipeline: Pandoc converts DOCX to HTML, cheerio preprocesses the HTML, Pandoc converts HTML to GFM Markdown, then 18 mandatory Aria Rules (AR001-AR018) normalize headings, lists, tables, images, links, and whitespace. An optional markdownlint pass is available after AR rules. This is the primary document ingestion riff for the Aria platform.

## When to use

- Converting Word documents (.docx) to Markdown for indexing, publishing, or further processing
- Normalizing inconsistent Markdown formatting with the 18 Aria Rules
- Batch converting entire directories of DOCX files with --dirs-recurse
- Cleaning up messy documents with --clean-first (Pandoc round-trip normalization)
- Generating lint reports or auto-fixing Markdown with --lint and --lint-fix

## Pipeline

1. Optional pre-clean via Pandoc DOCX-to-DOCX round-trip (--clean-first)
2. DOCX to HTML5 via Pandoc with --extract-media, --wrap=none, --standalone
3. Extract and rename media files to {docxname}-{N}.{ext}
4. Update image references in HTML to match renamed media
5. HTML preprocessing via cheerio: convert links and tables to Markdown syntax
6. HTML to Markdown via Pandoc GFM with --wrap=none
7. Apply 18 AR rules in fixed order across 4 phases: initial cleanup, basic formatting, structural, final polish
8. Optional markdownlint report or auto-fix
9. Add .gitkeep files to intermediate directories (default behavior)

## Parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `input` | `string` | yes | Path to source DOCX file or directory of DOCX files |
| `output` | `string` | yes | Path for output Markdown file or output directory |
| `--type` | `enum(docx\|pptx\|xlsx\|auto)` | no | Document type, defaults to auto-detect |
| `--clean-first` | `flag` | no | Run Pandoc DOCX-to-DOCX round-trip to normalize before conversion |
| `--lint` | `flag` | no | Run markdownlint validation after AR rules |
| `--lint-fix` | `flag` | no | Auto-fix markdownlint issues after AR rules |
| `--lint-config` | `string` | no | Path to custom .markdownlintrc configuration |
| `--in-place` | `flag` | no | Export next to source document (single files only) |
| `--dirs-recurse` | `flag` | no | Traverse subdirectories recursively |
| `--dirs-preserve` | `flag` | no | Preserve source directory hierarchy in output (requires --dirs-recurse) |
| `--no-gitkeep` | `flag` | no | Disable .gitkeep file generation in intermediate directories |
| `--config` | `string` | no | Path to YAML or JSON configuration file |

## Output

Markdown file(s) at the specified output path. Each DOCX produces one .md file. Media files are extracted and renamed alongside the Markdown. If --lint is used, a lint report is written to stdout. If --in-place is used, output is placed in a directory next to the source file (e.g., sources/my-doc/my-doc.md).

## Constraints

- Pandoc must be installed and on PATH (verify with: pandoc --version)
- Input must be a valid DOCX file or a directory containing DOCX files
- Output parent directory must exist
- Only DOCX is currently supported (PPTX and XLSX are not implemented)
- AR rules are applied in a fixed order and cannot be reordered
- Individual AR rules can be toggled on/off via config.yaml but the order is immutable

## Conventions

- Always use absolute paths for input and output
- Use --clean-first for documents with accumulated formatting cruft or complex styling from multiple editors
- Use --lint-fix for best results on first conversion
- Use --dirs-recurse --dirs-preserve for batch conversions that need to maintain source hierarchy
- Configuration is in config.yaml co-located in the riff directory
- Individual AR rules can be disabled in the ariaRules.rules section of config.yaml
- Invocation pattern: $RIFF [args]

## Examples

### Convert a single DOCX to Markdown

```sh
$RIFF sources/proposal.docx .aria/exports/doc-converter/proposal.md
```

Creates proposal.md with normalized Markdown and extracted media alongside it

### Convert in-place next to source

```sh
$RIFF sources/my-doc.docx --in-place
```

Creates sources/my-doc/my-doc.md with media in the same directory

### Batch convert directory preserving structure

```sh
$RIFF sources/rfp/ vault/ --dirs-recurse --dirs-preserve
```

Converts all DOCX files in sources/rfp/ mirroring the directory structure into vault/

### Convert with auto-fix linting

```sh
$RIFF sources/messy.docx output.md --lint --lint-fix
```

Creates output.md with AR rules applied, then markdownlint auto-fixes remaining issues
