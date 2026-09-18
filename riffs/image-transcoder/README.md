# Aria Image Transcoder Riff

Image transcoding and resizing riff for optimizing images to fit within LLM provider input size limits.

## Features

- Converts images to WebP format with configurable quality
- Iterative dimension reduction until file size meets threshold
- Processes single files or entire directories
- Supports multiple input formats: JPG, PNG, WebP, BMP
- Custom output directory support
- Configurable via YAML, .env files, or environment variables
- Sensible defaults (5MB limit, quality 85) - works without configuration
- Structured logging with Pino (console + rotating file output)
- Verbose mode for debugging (`--verbose` flag)

## Prerequisites

- **Node.js**: 24+
- **Sharp**: Automatically installed for image processing

## Quick Start

```sh
# Process a single image (uses default 5MB threshold)
bun riffs/image-transcoder/src/cli.ts process ./image.jpg

# Process entire directory
bun riffs/image-transcoder/src/cli.ts process ./images/

# Process with custom output directory
bun riffs/image-transcoder/src/cli.ts process ./images/ --output ./converted/
```

## Usage Commands

```sh
bun riffs/image-transcoder/src/cli.ts process <file-or-directory>  # Process image(s)

# Examples with flags
bun riffs/image-transcoder/src/cli.ts process ./image.jpg --output ./converted/
bun riffs/image-transcoder/src/cli.ts process ./images/ -o ./output/
```

### Command Options

- `<file-or-directory>` - Path to image file or directory (required)
- `--output, -o <path>` - Custom output directory (optional)
- `--verbose, -v` - Enable verbose (debug) logging

## Development Commands

### Type Checking

```sh
bun run image-transcoder:typecheck
# Or directly:
tsc --noEmit -p riffs/image-transcoder/tsconfig.json
```

### Testing

```sh
bun run image-transcoder:test
# Or directly with vitest:
vitest run --coverage --coverage.reportsDirectory=coverage/image-transcoder test/image-transcoder/
# Coverage report: coverage/image-transcoder/index.html
```

### Linting

```sh
bun run image-transcoder:lint
# Or directly:
eslint riffs/image-transcoder test/image-transcoder
```

### Formatting

```sh
bun run image-transcoder:format
# Or check formatting:
npx prettier --check "riffs/image-transcoder/**/*.ts" "test/image-transcoder/**/*.ts"
```

## Configuration

Configuration file: `config/config-image-transcoder.yaml` (optional)

### Default Configuration

```yaml
transcoding:
    max_file_size: 5242880 # 5MB in bytes
    quality: 85 # WebP/JPEG quality (0-100)

logging:
    level: 'INFO' # Log level: DEBUG, INFO, WARN, ERROR
    verbose: false # Enable verbose (debug) logging
    file: 'image-transcoder.log' # Log file name (stored in .aria/logs/ directory)
    max_file_size_mb: 10 # Maximum log file size in MB before rotation
    max_files: 7 # Maximum number of rotated log files to keep
```

### Configuration Priority (Highest to Lowest)

1. **Environment variables** - Direct `process.env` values
2. **Aria environment files** - Loaded with process, project `.aria/.env`, then user `~/.aria/.env` precedence
3. **YAML config file** - Loaded from `config/config-image-transcoder.yaml`
4. **Default values** - Hardcoded sensible defaults (5MB, quality 85)

### Environment Variable Overrides

```sh
# Transcoding settings
export TRANSCODE_MAX_SIZE=8      # Size in megabytes
export TRANSCODE_QUALITY=75      # Quality 0-100

# Logging settings
export TRANSCODE_LOG_LEVEL=DEBUG # Log level: DEBUG, INFO, WARN, ERROR
export TRANSCODE_LOG_VERBOSE=true # Enable verbose logging
export TRANSCODE_LOG_FILE=custom.log # Custom log filename
```

### .env File Support

Create a `.env` file with configuration:

```env
TRANSCODE_MAX_SIZE=8
TRANSCODE_QUALITY=75
TRANSCODE_LOG_LEVEL=DEBUG
TRANSCODE_LOG_VERBOSE=true
```

### Partial Configuration

You can specify only the values you want to override. Missing values use defaults:

```yaml
# Only override quality, use default max_file_size
transcoding:
    quality: 90
```

## How It Works

1. **Check file size** - Compares against threshold (default 5MB)
2. **Convert format** - Converts to WebP (or JPEG with `--format` flag) if not already in target format
3. **Reduce dimensions** - If still over threshold, iteratively reduces dimensions by 10% using Lanczos3 resampling
4. **Write output** - Saves to same directory or custom output directory

## Supported Formats

### Input Formats

- `.jpg` / `.jpeg` - JPEG images
- `.png` - PNG images
- `.webp` - WebP images (can still be processed for size reduction)
- `.bmp` - Bitmap images

### Output Format

- Default: WebP (quality 85)
- All conversions use Sharp library with Lanczos3 resampling for dimension reduction

## Architecture

### Core Modules (`riffs/image-transcoder/src/`)

- `core/image-transcoder.ts` - Main transcoding logic and image processing
- `config.ts` - Configuration management with defaults, YAML, and .env support
- `cli.ts` - Commander.js CLI interface
- `logger.ts` - Pino logger configuration with dual transports (console + file)

### Error Handling

- Validates file paths to prevent overwriting input files
- Provides clear error messages for missing files or invalid paths
- Handles directory vs file processing automatically

## Key Dependencies

- **sharp**: Image processing, format conversion, and dimension reduction
- **commander**: CLI framework
- **yaml**: YAML configuration parsing
- **pino**: Structured logging with JSON output

## Examples

### Process with Default Settings

```sh
# Uses 5MB threshold and quality 85
bun riffs/image-transcoder/src/cli.ts process ./large-image.png
```

### Process with Environment Variables

```sh
# Override defaults via environment
TRANSCODE_MAX_SIZE=10 TRANSCODE_QUALITY=90 bun riffs/image-transcoder/src/cli.ts process ./image.jpg
```

### Process with Verbose Logging

```sh
# Enable debug-level logging for troubleshooting
bun riffs/image-transcoder/src/cli.ts process ./image.jpg --verbose
```

### Process Directory with Custom Output

```sh
# Process all images in directory, output to different location
bun riffs/image-transcoder/src/cli.ts process ./source-images/ --output ./optimized/
```

### Batch Processing

```sh
# Process multiple directories
for dir in photo-set-*; do
  bun riffs/image-transcoder/src/cli.ts process "$dir" --output ./processed/
done
```

## Testing

The riff has comprehensive test coverage:

- **Unit tests** (12 tests) - Mock-based tests for error handling and method orchestration
- **Integration tests** (33 tests) - Real file I/O tests proving actual functionality
- **Combined coverage**: 99.34% statements, 94% branches, 100% functions

Tests follow Given-When-Then naming convention for self-documenting behaviour.

## Development Philosophy

This riff was built using strict Test-Driven Development (TDD):

- All code written test-first with RED-GREEN-REFACTOR cycles
- Tests verify behaviour through public interface, not implementation details
- 100% test coverage maintained throughout development
- Vitest hooks enforce TDD discipline during development
