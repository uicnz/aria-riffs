# Aria Image Meta Riff

Agent managed image metadata embedding riff that uses Ollama LLaVA models to
generate descriptions and embed them as XMP metadata into images with SQLite
database storage.

## Features

- XMP metadata writing with Sharp
- SQLite database with automatic schema creation
- Filename sanitization and collision handling
- Progress bars and comprehensive error handling

## Prerequisites

- **Node.js**: 18.17+
- **Ollama**: Running with LLaVA models
- **Sharp**: Automatically installed for image processing and XMP metadata

```sh
# Install required Ollama models
ollama pull llava
ollama pull llava-llama3:latest
```

## Quick Start

```sh
# Test Ollama connection
bun riffs/image-metadata/src/cli.ts check-connection

# Process images with metadata
bun riffs/image-metadata/src/cli.ts process ./images
```

## Usage Commands

```sh
bun riffs/image-metadata/src/cli.ts                                               # Interactive CLI
bun riffs/image-metadata/src/cli.ts process                                       # Process images
bun riffs/image-metadata/src/cli.ts check-connection                              # Check Ollama connection
bun riffs/image-metadata/src/cli.ts db-stats                                      # Database statistics
bun riffs/image-metadata/src/cli.ts list-models                                   # List available models

# Examples with flags
bun riffs/image-metadata/src/cli.ts process -r ./images                           # Recursive processing
bun riffs/image-metadata/src/cli.ts process --prompt "describe briefly" ./images  # Custom prompt

# View updated custom tags in image metadata with exifriff
exifriff -ariatitle -ariasubject -ariakeywords -ariadescription riffs/image-metadata/images/File-02-12-2024-12-32-25-AM.png
# dump all XMP tags
exifriff -xmp -b riffs/image-metadata/images/File-02-12-2024-12-32-25-AM.png
```

## Development Commands

### Type Checking

```sh
bun run image-metadata:typecheck
# Or directly:
tsc --noEmit -p riffs/image-metadata/tsconfig.json       # Type check source files only

# Note: Test files are type-checked by Vitest when tests run
```

### Testing

```sh
bun run image-metadata:test
# Or directly with vitest:
vitest run --coverage --coverage.reportsDirectory=coverage/image-metadata test/image-metadata/
# Coverage report: coverage/image-metadata/index.html
```

## Configuration

Configuration file: `config/meta-config.yaml`

All settings support environment variable overrides (e.g., `IMAGE_METADATA_OLLAMA_ENDPOINT`,
`IMAGE_METADATA_OLLAMA_MODEL`).

## Architecture

### Core Modules (`riffs/image-metadata/src/`)

- `core/metadata.ts` - XMP metadata writing
- `core/process-images.ts` - Main processing logic
- `api/ollama.ts` - Ollama API integration
- `.aria/db/database.ts` - SQLite operations
- `config.ts` - Configuration management
- `cli.ts` - Commander.js CLI interface
- `types.ts` - TypeScript interfaces
- `utils.ts` - Utility functions

### Error Handling

Custom exception hierarchy with specific error types:

- `ImageProcessorError`
- `OllamaConnectionError`
- `DatabaseError`

## Key Dependencies

- **sharp**: Image processing, XMP metadata writing, and validation
- **libsql**: SQLite database (synchronous API)
- **commander**: CLI framework
- **Bun fetch**: Native HTTP client for provider model discovery
- **chalk**: Terminal colors
- **cli-progress**: Progress bars

## Future Refactoring Work

TODO:

- [ ] refactor cli.ts to look more like imagetranscode's cli.ts module (no module globals)
- [ ] refactor config.ts to look more like imagetranscode's config.ts module (no module globals)
- [ ] global config is imported in multiple modules - just create once and inject dependency
- [ ] move findImageFiles and isSupportedImage from utils.ts to describe-images.ts
- [ ] move directory sanitise function to another riff - image-sanitiser?
