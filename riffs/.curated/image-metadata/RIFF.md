---
name: image-metadata
description: AI-generated image descriptions embedded as XMP metadata with database tracking
---

# Image Metadata

## Purpose

Processes images using vision-capable LLM providers (Ollama/LLaVA, Anthropic Claude, Google Gemini) to generate detailed descriptions, then embeds them as custom XMP metadata tags (AriaTitle, AriaSubject, AriaKeywords, AriaDescription) using Sharp. Tracks all processed images in a SQLite database with filename sanitization and collision handling. Supports batch processing with progress bars and configurable retry logic.

## When to use

- Adding AI-generated descriptions to image files as embedded XMP metadata
- Batch processing directories of images to generate and embed metadata
- Building a searchable database of image descriptions for asset management
- Checking LLM provider connectivity and available vision models
- Querying database statistics about processed images

## Pipeline

1. Scan input directory for supported image files (png, jpg, jpeg, gif, bmp)
2. For each image: send to configured LLM provider for visual description generation
3. Parse LLM response to extract title, subject, keywords, and description
4. Write custom Aria XMP metadata tags into the image file using Sharp
5. Store image record in SQLite database with original filename, new metadata, and processing status
6. Report progress and statistics

## Parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `command` | `enum(process\|check-connection\|db-stats\|list-models)` | yes | Subcommand to execute |
| `directory` | `string` | no | Directory containing images to process (for process command) |
| `-r` | `flag` | no | Process directory recursively |
| `--prompt` | `string` | no | Custom prompt for LLM description generation |
| `--verbose` | `flag` | no | Enable verbose logging |

## Output

For process: images are modified in place with embedded XMP metadata tags and records stored in SQLite database. For check-connection: displays LLM provider connectivity status. For db-stats: shows database statistics including total images processed and metadata coverage. For list-models: displays available vision models from the configured provider.

## Constraints

- Requires a vision-capable LLM provider: Ollama with LLaVA model, Anthropic Claude, or Google Gemini
- Supported image formats: PNG, JPG, JPEG, GIF, BMP
- Maximum file size: 50MB per image (configurable)
- Sharp library required for XMP metadata writing
- Provider API key required for Anthropic (ANTHROPIC_API_KEY) or Gemini (GOOGLE_API_KEY)
- Ollama must be running with a LLaVA model pulled

## Conventions

- Configuration is in config.yaml co-located in the riff directory
- LLM provider is selected via the image-metadata.llm.provider config key
- Provider-specific settings are in the llmProviders peer section of config.yaml
- Use check-connection to verify provider setup before batch processing
- Custom XMP tags can be read with exifriff: exifriff -ariatitle -ariadescription image.png
- Invocation pattern: $RIFF <command> [args]

## Examples

### Process images in a directory

```sh
$RIFF process .aria/assets/images
```

Generates AI descriptions for each image and embeds them as XMP metadata, tracking results in SQLite

### Process recursively with custom prompt

```sh
$RIFF process -r --prompt "describe briefly" ./images
```

Recursively processes all images using a custom description prompt

### Check LLM provider connectivity

```sh
$RIFF check-connection
```

Tests connection to the configured LLM provider and reports status

### View database statistics

```sh
$RIFF db-stats
```

Shows total images processed, metadata coverage, and processing history
