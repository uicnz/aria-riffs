---
name: dir-differ
description: Directory and file comparison with color-coded difference output
---

# Dir Differ

## Purpose

Compares two directories and displays differences with color-coded terminal output. Shows files unique to each directory, files with changed content, and identical files. Supports content-level diff display, exclusion patterns, and summary-only output. Designed for A/B testing workflows, migration verification, and directory synchronization checks. Automatically excludes common system files (.DS_Store, .git, node_modules).

## When to use

- Comparing two directories to find structural differences (missing or extra files)
- Verifying that a migration or conversion produced identical output
- A/B testing directory contents after running different processing pipelines
- Checking content-level changes between two versions of a document set

## Pipeline

1. Validate both input directories exist and are accessible
2. Scan both directories, applying exclusion patterns
3. Compare file lists to find files unique to each directory
4. Compare content of files present in both directories
5. Display color-coded summary and details (red=only-in-dir1, magenta=only-in-dir2, yellow=changed)
6. Optionally show line-by-line content differences with --content flag
7. Exit with code 0 (identical) or 1 (different)

## Parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `dir1` | `string` | yes | First directory path to compare |
| `dir2` | `string` | yes | Second directory path to compare |
| `--content` | `flag` | no | Show content differences for changed files |
| `--summary-only` | `flag` | no | Show only the summary without individual file listings |
| `--exclude` | `string` | no | Exclude files matching pattern (can be used multiple times) |
| `--no-color` | `flag` | no | Disable colored terminal output |
| `-v, --verbose` | `flag` | no | Enable verbose debug logging |

## Output

Color-coded terminal output showing: header with directories and exclusions, summary statistics (file counts, identical, changed, unique), detailed file listings by category, optional content diffs, and final PASS/FAIL result. Exit code 0 means identical, 1 means different.

## Constraints

- Both directories must exist and be readable
- Comparison is file-level by default (content comparison requires --content flag)
- Default exclusions always apply: .DS_Store, *.md.bak, .git, node_modules

## Conventions

- Use --summary-only for quick pass/fail checks in CI pipelines
- Use --content when you need to see exactly what changed within files
- Configuration is in config.yaml co-located in the riff directory
- Invocation pattern: $RIFF <dir1> <dir2> [options]

## Examples

### Basic directory comparison

```sh
$RIFF ./expected/ ./actual/
```

Shows summary of differences and lists files unique to each directory or changed between them

### Compare with content differences

```sh
$RIFF ./v1/ ./v2/ --content
```

Shows file-level differences plus line-by-line content changes for modified files

### Compare with custom exclusions

```sh
$RIFF ./src/ ./backup/ --exclude "*.log" --exclude "temp*"
```

Compares directories while ignoring log files and temp files
