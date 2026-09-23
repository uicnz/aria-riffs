# Aria Dir Differ Riff

Aria DirDiffer compares two directories and displays differences with color-coded output. It's designed to work with A/B testing workflows and directory comparison tasks.

## Purpose

Aria DirDiffer provides a visual comparison of two directories, highlighting differences with color-coded output. It supports content comparison, exclusion patterns, and summary-only output modes.

## Installation

This riff is part of the Aria monorepo and is not published as a standalone package. For AI agents and direct execution, use bun commands. For convenience, Bun scripts are also available.

## Usage

### Basic Usage

Compare two directories:

```sh
bun riffs/dir-differ/src/cli.ts <dir1> <dir2>
```

### Advanced Usage

Compare with content differences shown:

```sh
bun riffs/dir-differ/src/cli.ts <dir1> <dir2> --content
```

Show only summary (no detailed file list):

```sh
bun riffs/dir-differ/src/cli.ts <dir1> <dir2> --summary-only
```

Exclude specific patterns:

```sh
bun riffs/dir-differ/src/cli.ts <dir1> <dir2> --exclude "*.log" --exclude "temp*"
```

Disable colored output:

```sh
bun riffs/dir-differ/src/cli.ts <dir1> <dir2> --no-color
```

## Quick Reference: Bun Scripts

For convenience, these commands are also available as Bun scripts:

| bun Command                                                    | Bun Script Equivalent                      |
| -------------------------------------------------------------- | ------------------------------------------ |
| `bun riffs/dir-differ/src/cli.ts <dir1> <dir2>`                | `bun run diff <dir1> <dir2>`               |
| `bun riffs/dir-differ/src/cli.ts <dir1> <dir2> --content`      | `bun run diff:content <dir1> <dir2>`       |
| `bun riffs/dir-differ/src/cli.ts <dir1> <dir2> --summary-only` | `bun run diff:summary <dir1> <dir2>`       |
| `tsc --noEmit -p riffs/dir-differ/tsconfig.json`               | `bun run --cwd riffs/dir-differ typecheck` |
| `bun run --cwd riffs/dir-differ test`                          | `bun run --cwd riffs/dir-differ test`      |

**For AI agents:** Use bun commands for immediate execution without compilation delays.
**For humans:** Choose your preference - bun commands are more explicit, Bun scripts are shorter.

### Options

- `--exclude <pattern>` - Exclude files matching pattern (can be used multiple times)
- `--content` - Show content differences for changed files
- `--summary-only` - Show only the summary, not individual files
- `--no-color` - Disable colored output
- `-v, --verbose` - Enable verbose logging output (debug level to console)

## Logging

The riff uses Pino for structured logging. Logs are written to file by default, with optional console output in verbose mode.

### Configuration

Logging is configured via `config.yaml`:

```yaml
logging:
    level: "INFO"
    verbose: false
    file: ".aria/logs/dir-differ.log"
    max_file_size_mb: 10
    max_files: 7
```

### Environment Variables

Override configuration with environment variables:

- `DIR_DIFFER_LOG_LEVEL` - Log level (DEBUG, INFO, WARN, ERROR)
- `DIR_DIFFER_LOG_VERBOSE` - Enable verbose mode (true/false)
- `DIR_DIFFER_LOG_FILE` - Log file path

### Verbose Mode

Use `--verbose` flag for debug-level console output:

```sh
bun riffs/dir-differ/src/cli.ts --verbose <dir1> <dir2>
```

### Default Exclusions

The riff automatically excludes common system files and directories:

- `.DS_Store`
- `*.md.bak`
- `.git`
- `node_modules`

## Output Format

The riff displays:

1. **Header**: Directories being compared and exclusion patterns
2. **Summary**: File and directory counts, difference statistics
3. **Details**: List of differences by type:
    - Files only in directory 1 (red)
    - Files only in directory 2 (magenta)
    - Changed files (yellow)
4. **Content Differences**: Line-by-line changes when `--content` option is used
5. **Result**: PASS (identical) or FAIL (different)

## Exit Codes

- `0`: Directories are identical
- `1`: Directories are different

## Example Output

```markdown
Comparing directories:
1: ./test/dir1
2: ./test/dir2
Excluding: .DS_Store, \*.md.bak, .git, node_modules

## Summary:

Directories: 2 : 2
Files: 4 : 3
Identical files: 1
Changed files: 1
Files only in directory 1: 1
Files only in directory 2: 1

## Details:

Only in ./test/dir1: only-in-dir1.txt
Only in ./test/dir2: only-in-dir2.txt
Changed: different-content.txt

[FAIL] The directories are different
```

## Testing

Test the riff using the provided test directories:

Using bun (recommended for AI agents):

```sh
bun riffs/dir-differ/src/cli.ts riffs/dir-differ/test/fixtures/nested riffs/dir-differ/test/fixtures/dir2
```

Using Bun scripts:

```sh
bun run --cwd riffs/dir-differ start riffs/dir-differ/test/fixtures/nested riffs/dir-differ/test/fixtures/dir2
```

Run the automated test suite:

```sh
bun run --cwd riffs/dir-differ test
```

The test directories contain various scenarios:

- Identical files
- Files with different content
- Files only in one directory
- Nested directory structures
