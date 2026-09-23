---
name: code-auditor
description: Dependency management and security scanning with safe update and rollback
---

# Code Auditor

## Purpose

Audits Node.js project dependencies to find outdated and unused packages, then provides safe update capabilities with automatic backup and rollback on test failure. Creates timestamped backups of package.json and lockfile before any changes, runs the test suite before and after updates, and automatically restores from backup if tests fail. Supports dry-run previews, selective per-dependency updates, dev-only updates, and JSON output for programmatic consumption.

## When to use

- Checking which project dependencies are outdated and by how much
- Safely updating dependencies with automatic rollback if tests break
- Selectively choosing which dependencies to update via interactive prompts
- Updating only devDependencies without touching production dependencies
- Generating a JSON audit report for CI/CD pipeline consumption

## Pipeline

1. Audit: Run bun pm ls to list installed dependencies
2. Audit: Run bun outdated to find outdated packages with current/latest versions
3. Audit: Generate report to console and optionally to JSON files
4. Update: Create timestamped backup of package.json and lockfile
5. Update: Run baseline tests to verify current state passes
6. Update: Apply dependency updates (all, selective, or dev-only)
7. Update: Run tests again to verify updates did not break anything
8. Update: Automatically rollback from backup if post-update tests fail

## Parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `command` | `enum(audit\|update\|status)` | yes | Action: audit lists outdated deps, update applies changes with safety net, status shows environment info |
| `-j, --json` | `flag` | no | Output results in JSON format |
| `-d, --dry-run` | `flag` | no | Preview what would be updated without making changes |
| `-s, --selective` | `flag` | no | Interactively choose which dependencies to update |
| `--dev-only` | `flag` | no | Only update devDependencies |
| `--skip-tests` | `flag` | no | Skip test verification (not recommended) |
| `-b, --backup-dir` | `string` | no | Custom backup directory for package files |
| `-t, --test-command` | `string` | no | Test command to run for verification (default: test) |
| `-p, --package-manager` | `string` | no | Package manager to use (default: bun) |
| `-o, --output-dir` | `string` | no | Custom output directory for audit reports |
| `-v, --verbose` | `flag` | no | Enable verbose debug logging |

## Output

Audit command outputs dependency status to console (or JSON with --json flag) including lists of installed, outdated, and unused dependencies. Update command outputs progress and results of the update process. JSON reports written to audit-summary.json or update-summary.json when --json is used. Exit code 0 on success, 1 on failure.

## Constraints

- Requires bun as the package manager (configurable via --package-manager)
- Must be run from a directory containing package.json
- Update operations require a clean working directory
- Rollback restores package.json and lockfile but does not undo node_modules changes

## Conventions

- Always run audit before update to understand what will change
- Always use --dry-run first when updating to preview changes
- Use --selective for active projects where some updates may be risky
- Use --dev-only when you only want to update build/test riffing
- Configuration is in config.yaml co-located in the riff directory
- Invocation pattern: $RIFF [command] [options]

## Examples

### Audit all dependencies

```sh
$RIFF audit
```

Lists all installed dependencies with their current and latest versions

### Preview dependency updates without applying

```sh
$RIFF update --dry-run
```

Shows what would be updated without making any changes

### Safely update with test verification

```sh
$RIFF update --test-command "bun run test"
```

Creates backup, runs tests, applies updates, re-runs tests, rolls back if tests fail
