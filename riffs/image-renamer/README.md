# Aria Image Rename Riff

Agent managed image renaming riff that generates descriptive filenames using multiple LLM providers (Ollama, Anthropic Claude) with optional file watching capabilities.

## Features

- **Multi-Provider LLM Support**: Both Ollama and Anthropic Claude via AI SDK
- **Provider Switching**: Easy configuration via environment variables or YAML
- **Safe File Operations**: Copy-then-delete strategy with verification
- **File System Watching**: Monitor directories for new images
- **Filename Sanitization**: Clean, unique filenames with configurable patterns
- **Dry-Run Mode**: Preview changes before applying

## Prerequisites

- **Node.js**: 18.17+
- **LLM Provider**: Either Ollama (local) or Anthropic Claude (cloud)

### Ollama Setup (Local)

```sh
# Install and run Ollama
ollama pull llava-llama3  # or llava:latest
ollama serve
```

### Anthropic Setup (Cloud)

```sh
# Set API key
export ANTHROPIC_API_KEY="your-key-here"
export LLM_PROVIDER="anthropic"
```

## Quick Start

```sh
# Test connection to current provider
bun riffs/image-renamer/src/cli.ts check-connection

# Switch providers (optional)
export LLM_PROVIDER="anthropic"  # or "ollama" (default)

# Rename images (dry run first recommended)
bun riffs/image-renamer/src/cli.ts rename --dry-run ./images
bun riffs/image-renamer/src/cli.ts rename ./images

# Watch directory for new images
bun riffs/image-renamer/src/cli.ts watch ./images
```

## Usage Commands

```sh
bun riffs/image-renamer/src/cli.ts                      # Interactive CLI
bun riffs/image-renamer/src/cli.ts rename               # Rename images
bun riffs/image-renamer/src/cli.ts rename --dry-run     # Dry run preview
bun riffs/image-renamer/src/cli.ts watch                # Watch directory
bun riffs/image-renamer/src/cli.ts check-connection     # Check connection
bun riffs/image-renamer/src/cli.ts list-models          # List models

# Examples with flags
bun riffs/image-renamer/src/cli.ts rename --dry-run ./images          # Dry run
bun riffs/image-renamer/src/cli.ts rename -r ./images                 # Recursive
bun riffs/image-renamer/src/cli.ts rename -r --dry-run ./images       # Recursive dry run
bun riffs/image-renamer/src/cli.ts rename --prompt "short name" ./images  # Custom prompt
bun riffs/image-renamer/src/cli.ts watch -r ./images                  # Watch recursively
```

## Development Commands

### Type Checking

```sh
bun run image-renamer:typecheck
# Or directly:
tsc --noEmit -p riffs/image-renamer/tsconfig.json    # Type check source files only

# Note: Test files are type-checked by Vitest when tests run
```

### Testing

```sh
bun run image-renamer:test
# Or directly with vitest:
vitest run --coverage --coverage.reportsDirectory=coverage/image-renamer test/image-renamer/
# Coverage report: coverage/image-renamer/index.html
```

## Configuration

Configuration file: `config/name-config.yaml`

### Provider Selection

Choose your LLM provider via environment variable or config file:

```sh
# Ollama (default)
export IMAGE_RENAMER_LLM_PROVIDER="ollama"

# Anthropic Claude
export IMAGE_RENAMER_LLM_PROVIDER="anthropic"
export ANTHROPIC_API_KEY="your-key-here"
```

### Environment Variable Overrides

All configuration supports environment variable overrides:

**Ollama Settings:**

- `IMAGE_RENAMER_OLLAMA_ENDPOINT`, `IMAGE_RENAMER_OLLAMA_MODEL`, `IMAGE_RENAMER_OLLAMA_TIMEOUT`
- `IMAGE_RENAMER_OLLAMA_PROMPT` - Custom prompt for Ollama provider

**Anthropic Settings:**

- `ANTHROPIC_API_KEY`, `IMAGE_RENAMER_ANTHROPIC_MODEL`, `IMAGE_RENAMER_ANTHROPIC_MAX_TOKENS`
- `IMAGE_RENAMER_ANTHROPIC_PROMPT` - Custom prompt for Anthropic provider

**General:**

- `IMAGE_RENAMER_LLM_PROVIDER` - Switch between `ollama`, `anthropic`, and `gemini`

### Per-Provider Prompt Customization

Each provider can have its own optimized prompt:

```sh
# Ollama-specific prompt
export IMAGE_RENAMER_OLLAMA_PROMPT="Brief filename description in 3 words"

# Anthropic-specific prompt
export IMAGE_RENAMER_ANTHROPIC_PROMPT="Generate a concise, SEO-friendly filename for this image"
```

## Architecture

### Core Modules (`riffs/image-renamer/src/`)

- `core/rename-images.ts` - Main renaming logic with LLMClient interface
- `core/watch-files.ts` - File system watching functionality
- `api/llm-client.ts` - **Unified LLM client using AI SDK** (supports Ollama + Anthropic)
- `cli.ts` - Commander.js CLI interface with provider-agnostic commands
- `config.ts` - Multi-provider configuration management
- `types.ts` - TypeScript interfaces including discriminated unions
- `utils.ts` - Utility functions for file operations

### Error Handling

Custom exception hierarchy with specific error types:

- `ImageRenameError` - General image processing errors
- `LlmConnectionError` - LLM provider connection issues (replaces OllamaConnectionError)
- `FileOperationError` - File system operation failures
- `WatcherError` - File watching errors

## Key Dependencies

- **ai**: Vercel AI SDK for unified LLM interface
- **@ai-sdk/anthropic**: Anthropic Claude provider
- **ai-sdk-ollama**: Ollama provider for AI SDK
- **commander**: CLI framework with TypeScript support
- **watcher**: File system watching (TypeScript-first)
- **Bun fetch**: Native HTTP client for provider diagnostics
- **cli-progress**: Progress bars for batch operations
