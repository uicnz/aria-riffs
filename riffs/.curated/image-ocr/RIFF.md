---
name: image-ocr
description: OCR text extraction from images and PDFs with Markdown output
---

# Image Ocr

## Purpose

Extracts text from images and PDF files using the scribe.js OCR library with configurable language support, confidence thresholds, and output formatting. Produces Markdown output with optional metadata headers. Supports batch processing with progress bars, concurrent execution, and multiple languages. No external API calls required -- all OCR processing happens locally.

## When to use

- Extracting text content from scanned images or photographs of documents
- Converting PDF files to searchable text with OCR
- Batch processing directories of images to extract text content
- Extracting text in non-English languages (configurable language support)
- Verifying OCR setup and dependencies before processing

## Pipeline

1. Scan input path for supported files (png, jpg, jpeg, gif, bmp, tiff, pdf)
2. Validate OCR setup and Aria-provided OCR runtime availability
3. For each file: run OCR engine with configured language and confidence threshold
4. Filter extracted text blocks by confidence score
5. Format output as Markdown with optional metadata headers
6. Write text output files alongside or in configured output directory
7. Report processing statistics and any errors

## Parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `command` | `enum(process\|check-setup\|config)` | yes | Subcommand to execute |
| `path` | `string` | no | File or directory to process (required for process command) |
| `-r` | `flag` | no | Process directory recursively |
| `--force` | `flag` | no | Overwrite existing output files |
| `--language` | `string` | no | OCR language code (default: eng) |
| `--confidence` | `number` | no | Confidence threshold for text extraction, 0.0 to 1.0 (default: 0.5) |
| `--verbose` | `flag` | no | Enable verbose logging |

## Output

Text files (.txt) containing extracted text in Markdown format with optional metadata headers (source file, language, confidence threshold, extraction date). For check-setup: reports OCR library status and configuration. For config: displays current configuration values.

## Constraints

- Requires the Aria runtime package store to provide OCR sidecar assets
- Supported file formats: PNG, JPG, JPEG, GIF, BMP, TIFF, PDF
- Maximum file size: 100MB per file (configurable)
- OCR accuracy depends on image quality and resolution
- Language support depends on scribe.js available language packs
- Concurrent job limit: 2 by default (configurable)

## Conventions

- Configuration is in config.yaml co-located in the riff directory
- Use check-setup to verify OCR dependencies before batch processing
- Output files use .txt extension by default (configurable)
- Higher confidence thresholds produce fewer but more reliable text extractions
- Invocation pattern: $RIFF <command> [args]

## Examples

### Extract text from a single image

```sh
$RIFF process ./scanned-document.jpg
```

Creates scanned-document.txt with extracted text content in Markdown format

### Batch process a directory recursively

```sh
$RIFF process -r ./scanned-pages
```

Processes all supported files in the directory tree, creating .txt output files for each

### Process with Spanish language OCR and high confidence

```sh
$RIFF process --language spa --confidence 0.8 ./images
```

Extracts only high-confidence Spanish text from images in the directory

### Check OCR setup

```sh
$RIFF check-setup
```

Verifies the OCR runtime package is available and reports OCR configuration status
