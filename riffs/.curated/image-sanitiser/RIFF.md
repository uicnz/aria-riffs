---
name: image-sanitiser
description: Image file extension verification and correction via magic byte detection
---

# Image Sanitiser

## Purpose

Detects actual image file formats by reading magic bytes and EXIF metadata, then corrects mismatched file extensions. Uses the file-type library for magic byte detection and Sharp for image metadata analysis. Supports JPEG, PNG, GIF, BMP, TIFF, and WebP formats. Stores results in a SQLite database for tracking. Essential for preparing image collections where files may have incorrect extensions from downloads, migrations, or batch uploads.

## When to use

- Fixing files with wrong extensions (e.g., a PNG file incorrectly named .jpg)
- Batch processing directories to verify and correct image file types
- Preparing images for downstream riffs that require correct extensions (such as image-metadata or image-alttext)
- Validating image collections for format consistency before archival or publishing
- Auditing image directories after migration from systems that changed extensions incorrectly

## Pipeline

1. Scan input directory for image files matching supported extensions
2. Read magic bytes from each file using file-type library
3. Optionally verify format via Sharp image metadata analysis
4. Compare detected format against current file extension
5. Report mismatches (in dry-run or analyse mode) or rename files to correct extension
6. Verify renamed files are still readable (when verifyAfterRename is enabled)
7. Record results in SQLite database

## Parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `command` | `enum(sanitise\|analyse\|detect\|check-deps)` | yes | Action to perform: sanitise fixes extensions, analyse is dry-run, detect checks a single file, check-deps verifies prerequisites |
| `path` | `string` | no | Path to image file (for detect) or directory (for sanitise/analyse) |
| `--dry-run` | `flag` | no | Preview changes without renaming files |
| `-r, --recursive` | `flag` | no | Process subdirectories recursively |
| `-v, --verbose` | `flag` | no | Enable verbose debug logging |

## Output

Console report of detected vs expected formats per file. Files with mismatched extensions are renamed in-place (unless --dry-run). Results stored in .aria/db/image-sanitiser/image-sanitiser.sqlite.

## Constraints

- Sharp must be installed (automatically included via dependencies)
- Input path must contain image files with supported extensions (.jpg, .jpeg, .png, .gif, .bmp, .tiff, .tif, .webp)
- Maximum file size is 100MB by default (configurable)
- File rename operations use safe-move with retries to avoid data loss

## Conventions

- Always run analyse or --dry-run first to preview changes before sanitising
- Use detect for single-file inspection when debugging format issues
- Configuration is in config.yaml co-located in the riff directory
- Invocation pattern: $RIFF [command] [args]

## Examples

### Detect format of a single image file

```sh
$RIFF detect ./image.jpg
```

Reports the actual format detected via magic bytes and whether the extension matches

### Analyse directory for mismatched extensions (dry-run)

```sh
$RIFF analyse -r ./images
```

Scans all images recursively and reports which files have incorrect extensions without changing anything

### Fix incorrect extensions in a directory

```sh
$RIFF sanitise -r ./images
```

Renames files with mismatched extensions to their correct format and records changes in the database
