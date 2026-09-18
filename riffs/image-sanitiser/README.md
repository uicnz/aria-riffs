# Aria Image Sanitiser Riff

File type detection and extension correction riff that examines file content using magic byte detection and EXIF analysis to fix incorrect extensions.

## Features

- Magic byte detection with `file-type` library
- Image metadata analysis with Sharp
- Smart detection logic with configurable fallback strategies
- Safe file operations with verification
- Support for JPEG, PNG, GIF, BMP, TIFF, WebP formats
- Dry-run mode and detailed analysis reporting

## Prerequisites

- **Node.js**: 18.17+
- **Sharp**: Automatically installed for image processing

## Quick Start

```sh
# Check dependencies
bun riffs/image-sanitiser/src/cli.ts check-deps

# Detect single file format
bun riffs/image-sanitiser/src/cli.ts detect ./image.jpg

# Analyse directory for incorrect extensions (dry-run)
bun riffs/image-sanitiser/src/cli.ts analyse ./images

# Fix incorrect extensions (dry-run first)
bun riffs/image-sanitiser/src/cli.ts sanitise --dry-run ./images
bun riffs/image-sanitiser/src/cli.ts sanitise ./images
```

## Usage Commands

```sh
bun riffs/image-sanitiser/src/cli.ts                    # Interactive CLI
bun riffs/image-sanitiser/src/cli.ts sanitise           # Fix incorrect extensions
bun riffs/image-sanitiser/src/cli.ts sanitise --dry-run # Dry run preview
bun riffs/image-sanitiser/src/cli.ts analyse            # Analyse files (alias for dry-run)
bun riffs/image-sanitiser/src/cli.ts detect             # Detect single file format
bun riffs/image-sanitiser/src/cli.ts check-deps         # Check dependencies

# Examples with flags
bun riffs/image-sanitiser/src/cli.ts sanitise --dry-run ./images      # Dry run
bun riffs/image-sanitiser/src/cli.ts sanitise -r ./images             # Recursive
bun riffs/image-sanitiser/src/cli.ts sanitise -r --dry-run ./images   # Recursive dry run
bun riffs/image-sanitiser/src/cli.ts analyse -r ./images              # Recursive analyse
bun riffs/image-sanitiser/src/cli.ts detect ./image.jpg               # Detect specific file
```

## Development Commands

### Type Checking

```sh
bun run image-sanitiser:typecheck
# Or directly:
tsc --noEmit -p riffs/image-sanitiser/tsconfig.json  # Type check source files only

# Note: Test files are type-checked by Vitest when tests run
```

### Testing

```sh
bun run image-sanitiser:test
# Or directly with vitest:
vitest run --coverage --coverage.reportsDirectory=coverage/image-sanitiser test/image-sanitiser/
# Coverage report: coverage/image-sanitiser/index.html
```

## Configuration

Configuration file: `config/sanitiser-config.yaml`

All settings support environment variable overrides (e.g., `USE_EXIF_DATA`).

## Architecture

### Core Modules (`riffs/image-sanitiser/src/`)

- `core/sanitise-images.ts` - Main sanitization logic
- `core/detect-format.ts` - File type detection with magic bytes and EXIF
- `cli.ts` - Commander.js CLI interface
- `config.ts` - Configuration management
- `types.ts` - TypeScript interfaces
- `utils.ts` - Utility functions

### Error Handling

Custom exception hierarchy with specific error types:

- `imagesanitiseError`
- `FileDetectionError`
- `UnsupportedImageFormat`

## Use Cases

**Perfect for:**

- Fixing files with wrong extensions (e.g., PNG files named .jpg)
- Batch processing directories to ensure correct file types
- Preparing images for metadata riffs that require correct extensions
- Validating image collections for consistency

**Example scenarios:**

- Files downloaded with generic extensions
- Batch uploads that lost original format information
- Migration from systems that changed extensions incorrectly
- Quality assurance for image archives

## Key Dependencies

- **file-type**: Magic byte file type detection
- **sharp**: Image processing, XMP metadata writing, and validation
- **commander**: CLI framework
- **chalk**: Terminal colors
- **cli-progress**: Progress bars
