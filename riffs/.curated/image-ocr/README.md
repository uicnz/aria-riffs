# Aria Image OCR Riff

Text extraction riff that uses OCR technology to extract text from images and PDFs with markdown output and metadata preservation.

## Features

- OCR processing using Aria-supplied OCR runtime assets
- Support for multiple languages with configurable settings
- Confidence threshold filtering for text extraction
- Markdown output format with metadata headers
- Batch processing with progress bars and concurrent execution
- Configuration via YAML with environment variable overrides

## Prerequisites

- **Bun runtime**: supplied by Aria for installed riff copies
- **scribe.js-ocr**: OCR runtime package supplied by Aria

```sh
# Aria-managed runtime package store
Aria supplies the OCR runtime package automatically for installed riff copies.
```

## Quick Start

```sh
# Check OCR setup and dependencies
bun riffs/image-ocr/src/cli.ts check-setup

# Extract text from single image/PDF
bun riffs/image-ocr/src/cli.ts process ./image.jpg

# Process directory recursively
bun riffs/image-ocr/src/cli.ts process -r ./images
```

## Usage Commands

```sh
bun riffs/image-ocr/src/cli.ts                                                      # Interactive CLI
bun riffs/image-ocr/src/cli.ts process                                              # Extract text from images/PDFs
bun riffs/image-ocr/src/cli.ts check-setup                                          # Check OCR setup and dependencies
bun riffs/image-ocr/src/cli.ts config                                               # Show current configuration

# Examples with flags
bun riffs/image-ocr/src/cli.ts process -r ./images                                  # Process recursively
bun riffs/image-ocr/src/cli.ts process --force ./images                             # Overwrite existing output
bun riffs/image-ocr/src/cli.ts process --language spa ./images                      # Use Spanish OCR
bun riffs/image-ocr/src/cli.ts process --confidence 0.8 ./images                    # Set confidence threshold
bun riffs/image-ocr/src/cli.ts process -r --language fra --confidence 0.7 ./images  # Combined options
```

## Development Commands

### Type Checking

```sh
bun run --cwd riffs/image-ocr typecheck
# Or directly:
tsc --noEmit -p riffs/image-ocr/tsconfig.json        # Type check source files only

# Note: Test files are type-checked by Vitest when tests run
```

### Testing

```sh
bun run --cwd riffs/image-ocr test
# Or directly with vitest:
vitest run --coverage --coverage.reportsDirectory=coverage/image-ocr test/image-ocr/
# Coverage report: coverage/image-ocr/index.html
```

## Configuration

Configuration file: `config.yaml`

All settings support environment variable overrides for language settings, confidence thresholds, and output preferences.

## Architecture

### Core Modules (`riffs/image-ocr/src/`)

- `cli.ts` - Commander.js CLI interface
- `core/ocr.ts` - Main OCR processing logic
- `types.ts` - TypeScript interfaces and error classes
- `config.ts` - Configuration management
- `utils.ts` - Utility functions

### Error Handling

Custom exception hierarchy with specific error types:

- `ImageOcrError`
- `OcrProcessingError`
- `UnsupportedFileFormat`

## Key Dependencies

- **scribe.js-ocr**: OCR runtime package supplied by Aria
- **commander**: CLI framework
- **chalk**: Terminal colors
- **cli-progress**: Progress bars
