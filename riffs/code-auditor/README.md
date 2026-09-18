# Aria Code Auditor Riff

Advanced dependency audit and update riff with rollback capability for Node.js projects.

## Features

- **Dependency Auditing**: Find outdated and unused dependencies
- **Safe Updates**: Automatic backup and rollback on test failures
- **Selective Updates**: Choose which dependencies to update
- **Test Integration**: Verify updates don't break functionality
- **Multiple Output Formats**: JSON and text file outputs
- **Dry Run Mode**: Preview updates without making changes
- **TypeScript Support**: Full type safety and modern architecture

## Installation

This riff is part of the Aria monorepo and is not published as a standalone package. For AI agents and direct execution, use bun commands. For convenience, bun scripts are also available.

## Usage

### Audit Dependencies

Analyze your project's dependencies:

```sh
bun riffs/code-auditor/src/cli.ts audit
```

For JSON output:

```sh
bun riffs/code-auditor/src/cli.ts audit --json
```

Options available via direct CLI:

- `-j, --json` - Output results in JSON format
- `-v, --verbose` - Enable verbose logging (debug to console)
- `-o, --output-dir <dir>` - Custom output directory

### Update Dependencies

Safely update dependencies with automatic rollback:

```sh
bun riffs/code-auditor/src/cli.ts update
```

For dry run (recommended first):

```sh
bun riffs/code-auditor/src/cli.ts update --dry-run
```

For selective updates:

```sh
bun riffs/code-auditor/src/cli.ts update --selective
```

For development dependencies only:

```sh
bun riffs/code-auditor/src/cli.ts update --dev-only
```

Options available via direct CLI:

- `-d, --dry-run` - Show what would be updated without making changes
- `-s, --selective` - Prompt for each outdated dependency
- `--dev-only` - Only update devDependencies
- `--skip-tests` - Skip test verification (not recommended)
- `-b, --backup-dir <dir>` - Custom backup directory
- `-t, --test-command <cmd>` - Test command to run (default: "test")
- `-p, --package-manager <mgr>` - Package manager to use (default: "bun")
- `-j, --json` - Output results in JSON format
- `-v, --verbose` - Enable verbose logging (debug to console)

### Check Status

View environment and riff status:

```sh
bun riffs/code-auditor/src/cli.ts status
```

## Quick Reference: bun Scripts

For convenience, these commands are also available as bun scripts:

| bun Command                                            | bun Script Equivalent                   |
| ------------------------------------------------------ | --------------------------------------- |
| `bun riffs/code-auditor/src/cli.ts audit`              | `bun run code-auditor:audit`            |
| `bun riffs/code-auditor/src/cli.ts audit --json`       | `bun run code-auditor:audit:json`       |
| `bun riffs/code-auditor/src/cli.ts update`             | `bun run code-auditor:update`           |
| `bun riffs/code-auditor/src/cli.ts update --dry-run`   | `bun run code-auditor:update:dry`       |
| `bun riffs/code-auditor/src/cli.ts update --selective` | `bun run code-auditor:update:selective` |
| `bun riffs/code-auditor/src/cli.ts update --dev-only`  | `bun run code-auditor:update:dev`       |
| `tsc --noEmit -p riffs/code-auditor/tsconfig.json`     | `bun run code-auditor:typecheck`        |
| `bun test/code-auditor-test/run-tests.ts`              | `bun run code-auditor:test`             |

**For AI agents:** Use bun commands for immediate execution without compilation delays.
**For humans:** Choose your preference - bun commands are more explicit, bun scripts are shorter.

## Examples

### Basic audit

```sh
bun riffs/code-auditor/src/cli.ts audit
```

### Audit with JSON output

```sh
bun riffs/code-auditor/src/cli.ts audit --json
```

Or with custom output directory:

```sh
bun riffs/code-auditor/src/cli.ts audit --json --output-dir ./reports
```

### Safe update with backup

```sh
bun riffs/code-auditor/src/cli.ts update --test-command "bun run test"
```

### Selective updates (choose which to update)

```sh
bun riffs/code-auditor/src/cli.ts update --selective
```

### Dry run to preview updates

```sh
bun riffs/code-auditor/src/cli.ts update --dry-run
```

### Update only development dependencies

```sh
bun riffs/code-auditor/src/cli.ts update --dev-only
```

Or with custom backup directory:

```sh
bun riffs/code-auditor/src/cli.ts update --dev-only --backup-dir ./backups
```

## Output Files

### Audit Output

- `audit-summary.json` - Complete audit results (with --json)
- `deps.txt` - List of all installed dependencies
- `outdated.txt` - List of outdated dependencies

### Update Output

- `update-summary.json` - Complete update results (with --json)
- `backups/` - Automatic backups of package files

## Architecture

The riff uses a modular TypeScript architecture:

```tree
src/
├── cli.ts              # Commander.js CLI interface
├── audit-engine.ts     # Core audit functionality
├── update-engine.ts    # Safe update with rollback
├── bun-cmd.ts          # bun command execution
├── backup-manager.ts   # Backup creation/restoration
├── reporter.ts         # Output formatting
└── types.ts           # TypeScript type definitions
```

## Safety Features

### Automatic Backup

- Creates timestamped backups of `package.json` and `bun.lockb`
- Stores backups in organized directory structure
- Validates backup integrity before proceeding

### Test Verification

- Runs tests before updates to establish baseline
- Runs tests after updates to verify functionality
- Automatically rolls back if tests fail

### Rollback Capability

- Automatic rollback on test failures
- Manual rollback from any backup
- Preserves original state until updates are verified

### Error Handling

- Graceful handling of network errors
- Proper exit codes for CI/CD integration
- Detailed error reporting and logging

## Exit Codes

- `0` - Audit completed successfully (regardless of findings)
- `1` - Audit process failed (bun errors, file system issues, etc.)

## Testing

Run the comprehensive test suite:

```sh
bun test/code-auditor-test/run-tests.ts
```

The riff includes test mode support with environment variables:

```sh
# Set test mode environment
export CODE_AUDITOR_TEST_MODE=true
export CODE_AUDITOR_MOCK_BUN_LIST="mock-project@1.0.0"
export CODE_AUDITOR_MOCK_BUN_OUTDATED="chalk 5.2.0 5.3.0 5.3.0"

# Run tests
bun test/code-auditor-test/run-tests.ts
```

## Configuration

### Logging

The riff uses Pino for structured logging. Logs are written to `.aria/logs/code-auditor.log` by default.

Enable verbose console output with the `-v` or `--verbose` flag:

```sh
bun riffs/code-auditor/src/cli.ts audit --verbose
bun riffs/code-auditor/src/cli.ts update --verbose --dry-run
```

### Environment Variables

Logging configuration can be overridden via environment variables:

- `CODE_AUDITOR_LOG_LEVEL` - Log level (DEBUG, INFO, WARN, ERROR)
- `CODE_AUDITOR_LOG_VERBOSE` - Enable verbose mode (true/false)
- `CODE_AUDITOR_LOG_FILE` - Log file path

Test mode variables:

- `CODE_AUDITOR_TEST_MODE` - Enable test mode with mock data
- `CODE_AUDITOR_MOCK_BUN_LIST` - Mock bun pm ls output
- `CODE_AUDITOR_MOCK_BUN_OUTDATED` - Mock bun outdated output
- `CODE_AUDITOR_MOCK_BUN_TEST` - Mock bun test output

### Package Manager

Uses bun as the package manager:

```sh
bun riffs/code-auditor/src/cli.ts update --package-manager bun
```

## Development

### Recommended Usage (AI Agents & Direct Execution)

For development and custom options, use bun commands directly:

```sh
bun riffs/code-auditor/src/cli.ts audit --verbose
bun riffs/code-auditor/src/cli.ts update --dry-run --selective
```

### Type Checking

```sh
tsc --noEmit -p riffs/code-auditor/tsconfig.json
```

## Contributing

This riff follows the Aria project standards:

- Modular TypeScript architecture
- CLI-first design with Commander.js
- Comprehensive error handling
- Full type safety with strict mode
- ESM modules only
