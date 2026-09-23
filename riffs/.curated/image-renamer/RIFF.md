---
name: image-renamer
description: Batch image renaming with AI-generated descriptive filenames
---

# Image Renamer

## Purpose

Renames image files using AI-generated descriptive filenames from multiple LLM providers (Ollama with LLaVA, Anthropic Claude, Google Gemini) via the Vercel AI SDK. Uses a safe copy-then-delete strategy with verification to prevent data loss. Supports dry-run previews, recursive directory processing, file system watching for new images, and filename sanitization with configurable patterns (case conversion, punctuation removal, separator character). Tracks all renames in a SQLite database.

## When to use

- Renaming generic image filenames (IMG_001.jpg, screenshot.png) to descriptive names
- Batch renaming images in a directory using AI-generated descriptions
- Monitoring a directory for new images and auto-renaming them as they arrive
- Previewing rename operations with dry-run before committing changes
- Generating consistent, SEO-friendly filenames for image assets

## Pipeline

1. Scan input directory for supported image files (png, jpg, jpeg, gif, bmp)
2. For each image: send to configured LLM provider for visual analysis
3. Provider generates a 4-5 word description of the image content
4. Sanitize description into filename: lowercase, remove punctuation, replace spaces with dashes
5. Handle filename collisions by appending numeric suffixes
6. Perform safe rename: copy to new name, verify copy, delete original
7. Record rename operation in SQLite database
8. Report results with before/after filenames

## Parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `command` | `enum(rename\|watch\|check-connection\|list-models)` | yes | Subcommand to execute |
| `directory` | `string` | no | Directory containing images to process |
| `--dry-run` | `flag` | no | Preview changes without renaming files |
| `-r` | `flag` | no | Process directory recursively |
| `--prompt` | `string` | no | Custom prompt for filename generation |
| `--verbose` | `flag` | no | Enable verbose logging |

## Output

For rename: files renamed in place with descriptive names, summary table showing original and new filenames. For dry-run: preview table of proposed changes without modifying files. For watch: continuous monitoring with real-time renaming of new files. For check-connection: LLM provider connectivity status. All operations logged to SQLite database.

## Constraints

- Requires a vision-capable LLM provider: Ollama with LLaVA model, Anthropic Claude, or Google Gemini
- Supported image formats: PNG, JPG, JPEG, GIF, BMP
- Maximum file size: 50MB per image (configurable)
- Provider API key required for Anthropic (ANTHROPIC_API_KEY) or Gemini (GOOGLE_API_KEY)
- Safe rename uses copy-then-delete -- requires sufficient disk space for temporary duplicates
- Maximum filename length: 100 characters (configurable)

## Conventions

- Always use --dry-run first to preview changes before committing
- Configuration is in config.yaml co-located in the riff directory
- Provider is selected via the image-renamer.llm.provider config key or LLM_PROVIDER env var
- Each provider can have its own optimized prompt for filename generation
- Filenames are lowercased with dashes by default (configurable case and separator)
- Invocation pattern: $RIFF <command> [args]

## Examples

### Dry run to preview renames

```sh
$RIFF rename --dry-run ./images
```

Shows a table of proposed filename changes without modifying any files

### Rename images recursively

```sh
$RIFF rename -r ./images
```

Renames all supported images in the directory tree using AI-generated descriptive filenames

### Watch directory for new images

```sh
$RIFF watch ./images
```

Monitors the directory and auto-renames new images as they are added

### Check LLM provider connectivity

```sh
$RIFF check-connection
```

Tests connection to the configured LLM provider and reports status
