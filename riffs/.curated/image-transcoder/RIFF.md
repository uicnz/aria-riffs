---
name: image-transcoder
description: Image resize and WebP conversion to fit within LLM provider input size limits
---

# Image Transcoder

## Purpose

Transcodes and resizes images to meet file size thresholds required by LLM providers. Converts images to WebP format with configurable quality, then iteratively reduces dimensions by 10% using Lanczos3 resampling until the file fits within the target size (default 5MB). Supports JPG, PNG, WebP, and BMP input formats. Processes single files or entire directories with optional custom output paths.

## When to use

- Preparing images for LLM vision APIs that have input size limits
- Batch converting a directory of large images to optimized WebP format
- Reducing image file sizes while maintaining acceptable visual quality
- Converting BMP or PNG screenshots to smaller WebP files for processing

## Pipeline

1. Check input file size against threshold (default 5MB)
2. Convert to WebP format using Sharp if not already WebP
3. If still over threshold, iteratively reduce dimensions by 10% with Lanczos3 resampling
4. Write output to same directory or custom output directory

## Parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `command` | `enum(process)` | yes | Action to perform: process transcodes the image(s) |
| `file-or-directory` | `string` | yes | Path to image file or directory of images to process |
| `--output, -o` | `string` | no | Custom output directory for processed images |
| `--verbose, -v` | `flag` | no | Enable verbose debug logging |

## Output

WebP image file(s) at the output location, each guaranteed to be under the configured size threshold. Original files are not modified when an output directory is specified.

## Constraints

- Sharp must be installed for image processing
- Input formats limited to JPG, JPEG, PNG, WebP, and BMP
- Output format is always WebP
- Output path must differ from input path to prevent overwriting source files
- Default size threshold is 5MB (configurable via TRANSCODE_MAX_SIZE or config.yaml)

## Conventions

- Use --output to keep originals intact when batch processing
- Environment variables TRANSCODE_MAX_SIZE and TRANSCODE_QUALITY override config defaults
- Configuration is in config.yaml co-located in the riff directory
- Invocation pattern: $RIFF process [path] [options]

## Examples

### Process a single image with default settings

```sh
$RIFF process ./large-image.png
```

Converts to WebP at quality 85 and reduces dimensions until under 5MB

### Process directory with custom output location

```sh
$RIFF process ./source-images/ --output ./optimized/
```

Converts all supported images in the directory to WebP in the optimized/ folder

### Process with environment variable overrides

```sh
TRANSCODE_MAX_SIZE=10 TRANSCODE_QUALITY=90 $RIFF process ./image.jpg
```

Converts image with 10MB threshold and quality 90 instead of defaults
