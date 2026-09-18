# Aria HR Policy Riff

Document decomposer, indexing, and semantic search riff for HR policies and similar structured documents.

## Usage

```sh
bun riffs/hr-policy/src/cli.ts decompose -i [directory] -o [directory]
bun riffs/hr-policy/src/cli.ts index [directory]
bun riffs/hr-policy/src/cli.ts search <query>
```

### Index Command

Index documents in a directory:

```sh
bun riffs/hr-policy/src/cli.ts index sources/cello/hr-policies/
```

Options:

- `-f, --file <path>` - SQLite database file
- `-r, --reset` - Reset and clear existing documents
- `-k, --api-key <key>` - OpenAI API key
- `-c, --config <path>` - Configuration file path
- `-v, --verbose` - Enable verbose/debug output
- `--model <name>` - Embedding model name
- `--dimensions <n>` - Embedding dimensions
- `--max-embed-chars <n>` - Max characters per embedding
- `--sections <mode>` - Section mode: response|request|both|full
- `--weight-response <x>` - Bias embeddings toward Response

### Search Command

Search indexed documents:

```sh
bun riffs/hr-policy/src/cli.ts search "policy question"
```

Options:

- `-f, --file <path>` - SQLite database file
- `-k, --api-key <key>` - OpenAI API key
- `-n, --results <num>` - Number of results (default: 5)
- `-c, --config <path>` - Configuration file path
- `-v, --verbose` - Enable verbose/debug output
- `--hybrid` - Enable hybrid lexical+semantic search
- `--no-hybrid` - Disable hybrid search
- `--alpha <x>` - Lexical weight when hybrid enabled (0..1)
- `--category <val>` - Filter by category
- `--department <val>` - Filter by department
- `--priority <val>` - Filter by priority
- `--identifier <val>` - Filter by identifier
- `--no-metadata` - Hide metadata in results
- `--no-highlight` - Disable query term highlighting
- `--json` - Output raw JSON instead of formatted display

## Logging

The hr-policy riff uses Pino for structured, production-grade logging.

### Console Output

Normal operation logs to console with pretty-printed format:

```txt
[18:30:22] INFO: Indexed documents
    count: 125
```

### Log Files

All logs are written to `.aria/logs/hr-policy.1.log` (rotating daily, max 10 files by default).

Log files contain newline-delimited JSON for machine consumption:

```json
{
    "level": 30,
    "time": 1761543022591,
    "count": 125,
    "msg": "Indexed documents"
}
```

### Configuration

Logging is configured in `config.yaml`:

```yaml
logging:
    level: 'INFO' # DEBUG, INFO, WARN, ERROR
    verbose: false # Enable DEBUG via --verbose flag
    file: 'hr-policy.log'
    max_file_size_mb: 10
    max_files: 7
```

### Verbose Mode

Enable debug-level logging with the `--verbose` flag:

```sh
bun riffs/hr-policy/src/cli.ts index sources/cello/hr-policies/ --verbose
```

This enables DEBUG logging, showing detailed step-by-step operation information.

### Observability Platform Integration

Logs are compatible with observability platforms like LangSmith and LangFuse:

1. JSON logs in `.aria/logs/hr-policy.*.log` can be ingested directly
2. Add trace context using child loggers:

    ```typescript
    const childLogger = logger.child({ traceId: 'xyz123' });
    ```

3. Future enhancement: dedicated transports for each platform

## Configuration

See `config.yaml` for all configuration options including:

- Paths: database, output directories
- Embedding: model, dimensions, character limits
- Search: sections, weighting, FTS settings
- Display: metadata, highlighting options
- Logging: levels, file rotation, retention
