# Aria Riff Auditor Riff

Audits every Aria Riff against the canonical mechanical scaffold and reports structural or semantic differences.

## Responsibilities

- Discover Riffs under `riffs/`
- Verify canonical Riff identity and wiring
- Verify `config.yaml`, schema, loader, environment, and logging mechanics
- Verify package, TypeScript, CLI, source, test, and directory conventions
- Validate prompts against Aria's canonical Riff prompt schema and `$RIFF` invocation contract
- Require package and `aria-riff` metadata descriptions to agree
- Verify dependency currency and package-local dependency declarations
- Emit a structured audit report for humans and automation

## Usage

Audit every Riff:

```sh
bun riffs/riff-auditor/src/cli.ts audit
```

Audit one Riff:

```sh
bun riffs/riff-auditor/src/cli.ts check doc-converter
```

List discovered Riffs:

```sh
bun riffs/riff-auditor/src/cli.ts list
```

Fail when any Riff is not healthy:

```sh
bun riffs/riff-auditor/src/cli.ts audit --strict
```

Emit JSON to standard output:

```sh
bun riffs/riff-auditor/src/cli.ts audit --json
```

## Configuration

The Riff reads `config.yaml`. An explicit configuration path can be supplied with `--config`.

## Output

The default report is written to `.aria/audits/riff-auditor.json`. Each Riff is classified as `healthy`, `issues`, or `unhealthy`, with exact findings included in the report.

## Development

```sh
bun run --cwd riffs/riff-auditor typecheck
bun run --cwd riffs/riff-auditor test
bun run --cwd riffs/riff-auditor audit --strict
```
