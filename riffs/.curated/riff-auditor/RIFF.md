---
name: riff-auditor
description: Riff configuration auditing and structural parity enforcement
  across all Aria riffs
---

# Riff Auditor

## Purpose

Runs comprehensive health checks on all riffs in the Aria monorepo to enforce structural and semantic parity. Every riff must follow the canonical directory layout, config shape, schema patterns, CLI structure, environment handling, logging, standalone Bun package identity, dependency policy, and tsconfig. Dependency auditing checks package-local runtime declarations against current registry releases and verifies shared-version parity without moving Riff dependencies to the repository root. Outputs a JSON report categorizing each riff as healthy, issues, or unhealthy.

## When to use

- Verifying all riffs conform to Aria structural parity standards after refactoring
- Checking a single riff for compliance issues before committing changes
- Running in CI/CD with --strict to fail the build on any non-healthy Riff
- Listing all discovered riffs and their config status
- Generating a comprehensive JSON audit report for review

## Pipeline

1. Discover all riff directories under riffs/
2. For each riff, enforce canonical wiring and prompt contracts, then run enabled audit categories (config, schema, cli, env, logger, source, structure, tui, scripts, dependencies, tsconfig, paths, validation)
3. Wiring audit: verify the canonical files, package identity, package shape, binary, version, and metadata description parity
4. Prompt audit: validate the exact Aria Riff prompt schema, Riff name, and $RIFF invocation placeholder
5. Config audit: verify config.yaml has riff wrapper, aria-riff metadata, logging peer, camelCase keys
6. Schema audit: verify schema.ts has riff wrapper, LoggingConfigSchema, proper defaults, no .strict() on root
7. CLI audit: verify createProgram() factory function, execution guard, no module-level instantiation
8. Env audit: verify config.ts uses schema, proper env prefix, bracket notation, ConfigError class
9. Structure audit: verify src/core/, src/lib/, test/unit/, test/integration/ directories exist with content
10. TSConfig audit: verify tsconfig.json matches canonical version exactly (standalone, no extends)
11. Dependency audit: verify standalone Bun identity, sorted package-local dependencies, shared-version parity, and current releases
12. Apply explicit canonical rules uniformly; no Riff exclusions or majority-derived standards are permitted
13. Categorize each riff as healthy (no issues), issues (minor), or unhealthy (missing requirements)
14. Write JSON report to configured output directory

## Parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `command` | `enum(audit\|check\|list)` | no | Action: audit runs full check on all riffs (default), check audits a single riff, list shows discovered riffs |
| `riff` | `string` | no | Riff name for the check command (e.g., doc-converter) |
| `-c, --config` | `string` | no | Path to custom config file |
| `-o, --output` | `string` | no | Output directory for the JSON report |
| `--json` | `flag` | no | Output JSON to stdout (suppresses console logging) |
| `--strict` | `flag` | no | Exit with code 1 if any Riff is not healthy (for CI) |
| `-v, --verbose` | `flag` | no | Enable verbose debug logging |

## Output

JSON report at .aria/audits/riff-auditor.json with full audit details for every Riff. Console output shows per-Riff health status (healthy/issues/unhealthy) with specific issue descriptions. With --json flag, outputs structured JSON to stdout. Exit code 1 in --strict mode when any Riff is not healthy.

## Constraints

- Must be run from the Aria monorepo root directory
- Requires riffs/ directory with at least one riff present
- TSConfig canonical comparison is based on the version defined in riffs/riff-auditor/src/audits/tsconfig-audit.ts

## Conventions

- Run after any refactoring pass to verify structural parity is maintained
- Use check <riff-name> for quick single-riff verification during development
- Use --strict in CI/CD pipelines to enforce compliance
- Use --json for programmatic consumption of audit results
- Canonical rules apply to every discovered Riff without exclusions
- Invocation pattern: $RIFF [command] [options]

## Examples

### Run full audit on all riffs

```sh
$RIFF audit
```

Audits every riff in the monorepo, writes JSON report, and logs per-riff health status

### Check a single riff for compliance

```sh
$RIFF check doc-converter
```

Audits only doc-converter and reports its health status and any issues found

### CI/CD strict mode with JSON output

```sh
$RIFF audit --strict --json
```

Outputs full audit as JSON to stdout and exits with code 1 if any Riff is not healthy
