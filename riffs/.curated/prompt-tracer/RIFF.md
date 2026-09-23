---
name: prompt-tracer
description: Anthropic coding CLI system prompt extraction and version comparison
---

# Prompt Tracer

## Purpose

Extracts and captures upstream coding CLI system prompts, user message formats, and available riffs from any installed or npm-published version. Works by downloading the specified Claude Code version from npm, patching the version check to prevent auto-updates, running with an integrated traffic interceptor to capture API requests, and parsing the captured data to extract system prompt content. Supports comparing prompts across versions, testing custom/local builds, and building a version history trace database in JSONL format.

## When to use

- Extracting the system prompt and riffs list from the current or a specific upstream CLI version
- Comparing system prompts between two upstream CLI versions to see what changed
- Testing a local/custom upstream CLI build to inspect its prompt configuration
- Building a historical record of upstream prompt evolution across releases

## Pipeline

1. Download specified upstream CLI version from npm (or use --binary-path for custom builds)
2. Patch version check to prevent auto-update interference
3. Launch the upstream CLI with integrated traffic interceptor
4. Send a test haiku request to trigger an API call
5. Capture the API request/response including system prompt and riff definitions
6. Parse captured data to extract user message format, system prompt, and riffs (excluding MCP riffs)
7. Save trace to JSONL file (append mode by default) and Markdown report with timestamp

## Parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `version` | `string` | no | Upstream CLI version to extract (e.g., 2.0.0). Uses the system-installed version if omitted |
| `--latest` | `flag` | no | Extract all versions from specified version to latest |
| `--binary-path` | `string` | no | Path to a custom upstream CLI binary (skips npm download) |
| `--claude-args` | `string` | no | Additional arguments to pass to the upstream CLI |
| `--separate-trace` | `flag` | no | Create separate timestamped trace file instead of appending to the main file |
| `-v, --verbose` | `flag` | no | Enable verbose debug output |

## Output

JSONL trace file at .aria/db/prompt-tracer/prompt-tracer.jsonl (or timestamped separate file) containing the raw API capture. Markdown report at the configured output directory containing the user message format, system prompt text, and available riffs with descriptions and schemas.

## Constraints

- Must be logged in to the upstream CLI (authentication required)
- Each version extraction sends one API request to the provider (may incur costs)
- Shell commands are sanitized via shell-quote to prevent injection
- Existing output files are skipped to avoid redundant API calls

## Conventions

- Use --separate-trace when capturing many versions to keep individual trace files
- Default append mode builds up a consolidated trace database in a single JSONL file
- Compare Markdown output files across versions to track prompt changes
- Use --binary-path for testing local development builds
- Configuration is in config.yaml co-located in the riff directory
- Invocation pattern: $RIFF [version] [options]

## Examples

### Extract prompts from the system-installed upstream CLI

```sh
$RIFF
```

Captures system prompt and riffs from the currently installed version, saves trace and Markdown report

### Extract from a specific version

```sh
$RIFF 2.0.0
```

Downloads the specified upstream CLI version from npm, extracts prompts, and saves results

### Extract all versions from 2.0.0 to latest

```sh
$RIFF 2.0.0 --latest
```

Iterates through all published versions from 2.0.0 onward, extracting prompts from each
