# Aria Image AltText Riff

Process markdown files to add alt text from figure captions.

## Purpose

Extracts figure captions and inserts them as alt text for images with empty alt text. The original captions remain in the document.

## Installation

Part of the Aria monorepo. Use bun commands for direct execution or bun scripts for convenience.

## Usage

### Process Markdown Files

Process a markdown file to add alt text from figure captions:

```sh
bun riffs/image-alttext/src/cli.ts process <file>
```

Process with verbose output:

```sh
bun riffs/image-alttext/src/cli.ts process <file> --verbose
```

Dry run (show what would be changed without making changes):

```sh
bun riffs/image-alttext/src/cli.ts process <file> --dry-run
```

### Analyze Files

Analyze a file without making changes:

```sh
bun riffs/image-alttext/src/cli.ts analyze <file>
```

## Quick Reference: bun Scripts

| bun Command                                         | bun Script Equivalent                  |
| --------------------------------------------------- | -------------------------------------- |
| `bun riffs/image-alttext/src/cli.ts process <file>` | `bun run image-alttext:process <file>` |
| `bun riffs/image-alttext/src/cli.ts`                | `bun run image-alttext:dev`            |
| `tsc --noEmit -p riffs/image-alttext/tsconfig.json` | `bun run image-alttext:typecheck`      |

## Testing

Type checking:

```sh
bun run image-alttext:typecheck
```

Test with provided test cases:

```sh
bun riffs/image-alttext/src/cli.ts process test/image-alttext/image-alttext-test-cases.md
```

## Example

Before:

```markdown
![](media/image1.png)

Figure 1: Network Diagram
```

After:

```markdown
![Figure 1: Network Diagram](media/image1.png)

Figure 1: Network Diagram
```

### Pattern Matching

Matches this pattern:

1. Image with empty alt text: `![](media/imageX.png)`
2. Whitespace and newlines
3. Figure caption starting with "Figure X:"
4. Until double newline or end of file

### Supported Image Types

Supported file extensions:

- .png
- .jpg / .jpeg
- .gif
- .emf

### Debugging

When no changes are made, displays:

- First 100 lines of the file
- All image patterns found

Use this output to diagnose pattern matching issues.

## Test Cases

Test file: `test/image-alttext/image-alttext-test-cases.md`

- Case 1: Empty alt text with figure caption
- Case 2: Existing alt text (ignored)
- Case 3: No figure caption (ignored)
- Case 4: Multiple sequential images
- Case 5: Different file extensions
- Case 6: Varying whitespace patterns
- Case 7: Unsupported file types

## Logging

Logs are written to `.aria/logs/image-alttext.log` by default (JSON format via Pino).

### Configuration

Configure logging via `config/config-image-alttext.yaml`:

```yaml
logging:
    level: 'info' # trace, debug, info, warn, error, fatal
    verbose: false # Enable console output
    file: '.aria/logs/image-alttext.log'
    max_file_size_mb: 10
    max_files: 7
```

### Environment Variables

Override config with environment variables:

- `IMAGE_ALTTEXT_LOG_LEVEL`: Log level (trace/debug/info/warn/error/fatal)
- `IMAGE_ALTTEXT_LOG_VERBOSE`: Enable console output (true/false)
- `IMAGE_ALTTEXT_LOG_FILE`: Log file path

### Verbose Mode

Use `-v` for detailed processing information (includes pino console output):

```sh
bun riffs/image-alttext/src/cli.ts process <file> -v
bun riffs/image-alttext/src/cli.ts analyze <file> -v
```

## Limitations

- Only processes `media/image\d+.ext` path pattern
- Requires "Figure X:" caption format
- Single file processing only
- Limited to png, jpg, jpeg, gif, emf extensions
