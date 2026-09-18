# Aria Prompt Tracer Riff

Extract and compare system prompts and riffs from Anthropic coding CLI.

## Overview

Part of the ARIA monorepo riffset. Captures and analyzes Anthropic coding CLI's system prompts, user message formats, and available riffs across different versions.

## Prerequisites

- You must be logged in to Anthropic coding CLI (authentication required)
- Bun 1.4.2 or newer
- Each version tested sends a single haiku request to Claude (may incur costs)

## Configuration

Configuration is managed by the co-located `config.yaml`:

```yaml
aria-riff:
    name: prompt-tracer
    description: Anthropic coding CLI prompt extraction and analysis
    category: development

prompt-tracer:
    paths:
        output:
            reports: '~/.aria/db/prompt-tracer/reports'
            traces: '~/.aria/db/prompt-tracer/traces'

logging:
    level: info
    verbose: false
    file: '~/.aria/logs/prompt-tracer.log'
    maxFileSizeMb: 10
    maxFiles: 7
```

**Environment variable overrides:**

- `PROMPT_TRACER_LOG_LEVEL` - Override log level
- `PROMPT_TRACER_LOG_VERBOSE` - Enable verbose logging
- `PROMPT_TRACER_OUTPUT_DIRECTORY` - Override report output directory
- `PROMPT_TRACER_TRACE_DIRECTORY` - Override trace directory

## Usage

**IMPORTANT FOR AI AGENTS**: This project uses bun commands exclusively. All documentation and examples use direct bun execution, not npm scripts.

Run from ARIA monorepo root:

```bash
# bun execution (primary method)
bun riffs/prompt-tracer/src/cli.ts [version] [options]

# Root Bun script
bun run prompt-tracer -- [version] [options]
```

### Options

- `version` - Anthropic coding CLI version to extract (e.g., `2.0.0`)
- `--latest` - Extract all versions from specified version to latest
- `--binary-path <path>` - Use custom Anthropic coding CLI binary
- `--claude-args "<args>"` - Pass arguments to Anthropic coding CLI
- `--separate-trace` - Create separate timestamped trace file (default: append to single file)
- `-v, --verbose` - Enable verbose debug output
- `-V, --version` - Show prompt-tracer version
- `-h, --help` - Show help message

### Examples

```bash
# Extract from system-installed Anthropic coding CLI
bun riffs/prompt-tracer/src/cli.ts

# Extract from specific version
bun riffs/prompt-tracer/src/cli.ts 2.0.0

# Extract multiple versions (2.0.0 to latest)
bun riffs/prompt-tracer/src/cli.ts 2.0.0 --latest

# Test custom/local build
bun riffs/prompt-tracer/src/cli.ts --binary-path /path/to/custom/cli.js

# Create separate trace file (don't append to main file)
bun riffs/prompt-tracer/src/cli.ts --separate-trace

# Using the root Bun script
bun run prompt-tracer                    # System Claude
bun run prompt-tracer -- 2.0.0
bun run prompt-tracer -- --separate-trace
```

## How It Works

### Standard Mode (registry versions)

1. Downloads specified Anthropic coding CLI version from npm
2. Patches version check to prevent auto-updates
3. Runs with integrated traffic interceptor
4. Sends test haiku request to trigger API call
5. Captures request/response to trace file
6. Extracts system prompt, user format, and riffs
7. Saves to configured locations

### Custom Binary Mode (`--binary-path`)

1. Uses specified binary directly (no download/patching)
2. Runs with traffic interceptor
3. Sends test haiku request
4. Captures and extracts prompts
5. Saves to configured locations

### File Output

**Trace files (JSONL):**

- Default: Appends to `.aria/db/prompt-tracer/prompt-tracer.jsonl` (builds up trace database)
- With `--separate-trace`: Creates `.aria/db/prompt-tracer/prompt-tracer-{timestamp}.jsonl`

**Output files (Markdown):**

- Always creates unique timestamped files: `output/prompt-tracer/prompt-tracer-{timestamp}.md`
- Contains: User message format, System prompt, Available riffs

Existing files are automatically skipped to avoid redundant API calls.

## Output Format

Each `prompt-tracer-*.md` file contains:

- **User Message**: Format of user messages sent to Claude
- **System Prompt**: System instructions Claude receives
- **Riffs**: Available riffs with descriptions and schemas (excludes MCP riffs)

## Advanced Usage

### Testing Local Development Builds

```bash
# Test your local Anthropic coding CLI fork
bun riffs/prompt-tracer/src/cli.ts --binary-path /path/to/your/fork/cli.js

# Compare with released version
bun riffs/prompt-tracer/src/cli.ts 2.0.0
# Now compare output/prompt-tracer/*.md files
```

### Passing Arguments to Anthropic coding CLI

```bash
# Test with MCP server configuration
bun riffs/prompt-tracer/src/cli.ts --claude-args "--mcp-config ~/.config/claude/mcp.json"

# Test with verbose logging
bun riffs/prompt-tracer/src/cli.ts --claude-args "--verbose"

# Multiple flags
bun riffs/prompt-tracer/src/cli.ts --claude-args "--debug --no-cache"
```

Arguments are safely parsed using shell-quote to prevent command injection.

### Debugging

Enable verbose output:

```bash
bun riffs/prompt-tracer/src/cli.ts -v
# or
bun run prompt-tracer -- -v
```

Shows detailed information about:

- API requests found in trace
- Model names and riff counts
- Processing steps and errors

## Directory Structure

```tree
output/prompt-tracer/          # Markdown reports
  └── prompt-tracer-*.md

.aria/db/prompt-tracer/              # API trace data
  ├── prompt-tracer.jsonl      # Consolidated trace (default)
  └── prompt-tracer-*.jsonl    # Separate traces (with --separate-trace)

.aria/logs/                          # Operational logs
  └── prompt-tracer.log
```

## Security

- Shell commands use proper escaping via `shell-quote`
- `--claude-args` filters shell operators for safety
- Version patching only modifies version check function
- Custom binaries executed without modification
- Sensitive headers redacted in traces

## Future Enhancements

See [multi-provider plan](docs/plan-multi-provider.md) for planned additions:

- Gemini CLI support
- OpenAI CLI support
- Additional codec options
