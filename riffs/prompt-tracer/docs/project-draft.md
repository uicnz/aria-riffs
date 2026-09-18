# Aria prompt-tracer riff - extract and analyze Anthropic coding CLI system prompts across versions

**Labels:** enhancement, riff

## Summary

Add a new riff to extract, capture, and analyze Anthropic coding CLI's system prompts, user message formats, and available riffs across different versions. Intercepts API traffic to capture exact prompts sent to Claude API, enabling version comparison and debugging.

## Motivation

- **Version tracking**: No automated way to track how Anthropic coding CLI's system prompts evolve across releases
- **Debugging capabilities**: Developers need to see exact prompts and riffs available in different versions
- **Comparison analysis**: Comparing prompts between versions reveals feature changes and improvements
- **Custom build testing**: Testing local modifications requires capturing their prompts without publishing
- **API transparency**: Understanding what's actually sent to the Claude API helps with debugging and optimization
- **Historical record**: Building a database of all prompt changes over time for reference

## Proposed Features

### 1. Traffic Interception

Capture Claude API requests/responses:

- Intercepts fetch() and Node HTTP/HTTPS requests
- Filters only Claude API traffic (api.anthropic.com)
- Captures full request body (prompts, riffs, messages)
- Captures response headers and metadata
- Redacts sensitive headers (API keys, auth tokens)
- Stores as JSONL for parsing

### 2. Multi-Version Support

Extract prompts from any Anthropic coding CLI version:

- Download and test specific npm versions (e.g., 2.0.0)
- Extract from system-installed Anthropic coding CLI
- Test custom/local binaries without publishing
- Batch extract from version range (--latest flag)
- Version check patching to prevent auto-updates
- Temporary workspace management for npm versions

### 3. Prompt Extraction

Parse API traffic to extract structured data:

- System prompt text
- User message format/template
- Available riffs with descriptions
- Riff input schemas
- Request filtering (best request selection)
- Content validation and error handling

### 4. Output Generation

Formatted Markdown reports:

- Clear sections for each component
- Timestamped filenames for tracking
- Riff-prefixed naming (prompt-tracer-\*)
- Configurable output directory
- Automatic skipping of existing files

### 5. Trace Database

JSONL trace file management:

- Append to single consolidated file by default
- Builds database of all API traces over time
- Optional separate timestamped files (--separate-trace flag)
- Configurable trace directory
- Preserves raw request/response data

### 6. Configuration System

YAML-based configuration:

- Logging settings (level, file, rotation)
- Output directory configuration
- Trace directory configuration
- Environment variable overrides
- Follows ARIA config patterns

### 7. Pino Logging

Production-grade structured logging:

- Dual transport (console + rotating file)
- JSON structured logs
- Configurable log levels
- Verbose debug mode
- Size and time-based rotation

## Technical Requirements

### Dependencies

- **commander** - CLI interface
- **pino** - Structured logging
- **shell-quote** - Safe shell argument parsing
- **js-yaml** - YAML config parsing

### File Structure

```tree
riffs/prompt-tracer/src/
  cli.ts                      - CLI entry point with Commander
  config.ts                   - YAML config loading
  logger.ts                   - Pino logger factory
  interceptor.ts              - Traffic interception
  interceptor-loader.ts       - Loader for --require flag
  core/
    cli-patcher.ts            - Version check patching
    content-extractor.ts      - Prompt extraction
    jsonl-parser.ts           - JSONL parsing
    output-formatter.ts       - Markdown formatting
    request-filter.ts         - Request selection logic
    version-utils.ts          - Version comparison utilities
  services/
    file-service.ts           - File I/O operations
    npm-service.ts            - NPM package management
    shell-service.ts          - Shell command execution
    temp-service.ts           - Temporary directory management
  types/
    request.ts                - Request/response types
    trace-types.ts            - Traffic trace types
```

### Configuration Files

- `config.yaml` - Runtime configuration
- `.aria/db/prompt-tracer/prompt-tracer.jsonl` - Consolidated trace database
- `.aria/logs/prompt-tracer.log` - Operational logs
- `output/prompt-tracer/` - Markdown output directory

## CLI Commands

### Basic Usage

```bash
# Extract from system-installed Anthropic coding CLI
bun riffs/prompt-tracer/src/cli.ts

# Extract from specific npm version
bun riffs/prompt-tracer/src/cli.ts 2.0.0

# Extract version range (2.0.0 to latest)
bun riffs/prompt-tracer/src/cli.ts 2.0.0 --latest

# Test custom binary
bun riffs/prompt-tracer/src/cli.ts --binary-path /path/to/cli.js

# Create separate trace file
bun riffs/prompt-tracer/src/cli.ts --separate-trace

# Verbose debug output
bun riffs/prompt-tracer/src/cli.ts -v
```

### Package-local Bun Scripts

```bash
bun run --cwd riffs/prompt-tracer start                    # System Claude
bun run --cwd riffs/prompt-tracer start -- 2.0.0          # Specific version
bun run --cwd riffs/prompt-tracer start -- --separate-trace
```

## Configuration Example

```yaml
# Logging settings
logging:
    level: 'INFO'
    verbose: false
    file: 'prompt-tracer.log'
    max_file_size_mb: 10
    max_files: 7

# Output settings
output:
    directory: 'output/prompt-tracer'

# Processing settings
processing:
    trace_directory: '.aria/db/prompt-tracer'
```

## Environment Variable Overrides

```bash
export PROMPT_TRACER_LOG_LEVEL=debug
export PROMPT_TRACER_LOG_VERBOSE=true
export PROMPT_TRACER_OUTPUT_DIRECTORY=custom/output
export PROMPT_TRACER_TRACE_DIRECTORY=custom/traces
```

## Output Files

### Trace Files (JSONL)

**Default behavior** - Single consolidated file:

```sh
.aria/db/prompt-tracer/prompt-tracer.jsonl
```

Appends each run, building a database of all captured API traffic.

**With --separate-trace flag** - Individual files:

```sh
.aria/db/prompt-tracer/prompt-tracer-2025-10-29T03-04-22-571Z.jsonl
```

### Output Files (Markdown)

Unique timestamped files for each run:

```sh
output/prompt-tracer/prompt-tracer-2025-10-29T03-04-22-571Z.md
```

Each contains:

- User message format
- System prompt text
- Available riffs with schemas

## Use Cases

### Version Comparison

Compare system prompts across Anthropic coding CLI releases:

```bash
bun riffs/prompt-tracer/src/cli.ts 2.0.0
bun riffs/prompt-tracer/src/cli.ts 2.1.0
# Compare the two .md files
```

### Custom Build Validation

Test local modifications before publishing:

```bash
bun riffs/prompt-tracer/src/cli.ts --binary-path ./my-fork/cli.js
# Verify prompts match expectations
```

### Debugging

Understand exact prompts for troubleshooting:

```bash
bun riffs/prompt-tracer/src/cli.ts -v
# See all API traffic and extraction details
```

### Historical Analysis

Build trace database over time:

```bash
# Each run appends to prompt-tracer.jsonl
# Over weeks/months, build complete history
# Query JSONL for patterns and changes
```

## Benefits

- **Version transparency**: See exactly what prompts Anthropic coding CLI uses
- **Debugging support**: Understand API interactions for troubleshooting
- **Change tracking**: Monitor how prompts evolve across versions
- **Custom build testing**: Validate modifications without publishing
- **Historical record**: JSONL database of all captured traffic
- **Config-driven**: Flexible directory and behavior configuration
- **Production logging**: Pino integration with rotation and levels
- **Safe execution**: Shell escaping and filtered arguments
- **Standards compliant**: Follows all ARIA project standards

## Testing Checklist

- [ ] System Anthropic coding CLI extraction
- [ ] NPM version download and extraction
- [ ] Version range extraction (--latest)
- [ ] Custom binary testing (--binary-path)
- [ ] Traffic interception (fetch and Node HTTP)
- [ ] API request filtering
- [ ] Sensitive header redaction
- [ ] JSONL append mode (default)
- [ ] JSONL separate files (--separate-trace)
- [ ] Markdown output formatting
- [ ] Version check patching
- [ ] Temporary directory cleanup
- [ ] Configuration loading from YAML
- [ ] Environment variable overrides
- [ ] Pino console logging
- [ ] Pino file rotation
- [ ] CLI argument parsing
- [ ] Error handling and recovery
- [ ] File existence checking (skip duplicates)
- [ ] TypeScript strict mode compliance

## Documentation Requirements

- [ ] Riff README with all commands and examples
- [ ] Configuration documentation
- [ ] JSONL format specification
- [ ] Output format specification
- [ ] Environment variable reference
- [ ] Use case examples
- [ ] Security notes on shell escaping

## Future Enhancements

After initial implementation, planned additions include:

- Gemini CLI support for prompt extraction
- OpenAI CLI support for prompt extraction
- Additional codec/format options
- Comparative analysis features across providers

These are future enhancements and not requirements for the initial version.
