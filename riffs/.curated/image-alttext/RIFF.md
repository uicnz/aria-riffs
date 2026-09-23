---
name: image-alttext
description: Populate empty image alt text from figure captions in Markdown files
---

# Image Alttext

## Purpose

Processes Markdown files to find images with empty alt text and inserts the corresponding figure caption as alt text for accessibility compliance. Matches the pattern of an image with empty alt text followed by a "Figure X:" caption, then copies the caption into the alt text attribute. The original figure captions remain in the document. This is a deterministic text-processing riff that does not use AI -- it extracts existing captions from the document structure.

## When to use

- After doc-converter has produced Markdown with empty alt text and figure captions below images
- Improving accessibility of Markdown documents by populating missing alt text attributes
- Batch processing converted documents that follow the "Figure X:" caption convention
- Auditing Markdown files to identify images missing alt text (analyze mode)

## Pipeline

1. Read the input Markdown file
2. Scan for image patterns matching: empty alt text image followed by "Figure X:" caption
3. For each match, copy the figure caption text into the alt text attribute
4. Write the modified Markdown back to the file (or report changes in dry-run mode)

## Parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `command` | `enum(process\|analyze)` | yes | Subcommand: process (modify file) or analyze (report only) |
| `file` | `string` | yes | Path to the Markdown file to process or analyze |
| `--dry-run` | `flag` | no | Show what would be changed without modifying the file |
| `--verbose, -v` | `flag` | no | Enable verbose output with detailed processing information |

## Output

For process: modifies the Markdown file in place, inserting figure captions as alt text. Reports the number of images updated. For analyze: displays all image patterns found and their alt text status without making changes. For dry-run: shows proposed changes without writing to the file.

## Constraints

- Only matches images using the media/imageN.ext path pattern
- Requires figure captions in "Figure X:" format immediately following the image
- Limited to png, jpg, jpeg, gif, emf file extensions
- Single file processing only (no directory batch mode)
- Does not generate alt text from image content -- only extracts existing figure captions

## Conventions

- Run after doc-converter to fix alt text in converted documents
- Use analyze mode first to audit before processing
- Use --dry-run to preview changes before committing them
- Configuration is in config.yaml co-located in the riff directory
- Invocation pattern: $RIFF <command> <file> [options]

## Examples

### Process a Markdown file to add alt text

```sh
$RIFF process .aria/exports/rfp-response.md
```

Updates all images with empty alt text by inserting their figure captions, reports count of changes

### Dry run to preview changes

```sh
$RIFF process .aria/exports/rfp-response.md --dry-run
```

Shows which images would be updated and what alt text would be inserted, without modifying the file

### Analyze a file for missing alt text

```sh
$RIFF analyze .aria/exports/rfp-response.md
```

Reports all image references found, their current alt text status, and any matching figure captions
