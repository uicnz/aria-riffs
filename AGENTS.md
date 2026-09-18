# Aria Riff Operating Agreements

## Canonical Contract

- `riff` is the only product token for an independently distributed executable callable in this repository.
- A Riff is not a Tool type, Tool source, Tool mode, Tool package, or Tool compatibility layer.
- Riff wiring uses only the canonical Riff vocabulary defined in this repository.
- Every directory directly beneath `riffs/` is one Riff and uses the same wiring contract: `config.yaml`, `package.json`, `src/cli.ts`, `src/riff-prompt.ts`, and the developer-built `dist/cli.js` distribution.
- `config.yaml` exposes canonical metadata beneath `aria-riff`; its `name` matches the directory name exactly.
- `package.json` uses `@aria/<riff>` and exposes a binary named `<riff>`.
- `src/riff-prompt.ts` exports `riffPrompt`; its `name` matches the directory name exactly and examples invoke `$RIFF`.
- Aria owns invocation identity, approval, durability, telemetry, and protocol projection. A Riff receives arguments and executes its own bounded business behavior. It does not impersonate an Aria Tool or manufacture Tool correlation.
- Riff developers own dependency installation and distribution builds. Normal Riff invocation never installs dependencies. When an invoked package is incomplete or broken, the Aria agent may inspect and repair it in place with its ordinary filesystem, Shell, package, build, and test capabilities before refreshing discovery and retrying.
- Keep all Riffs at absolute structural and semantic parity. Extend `riff-auditor` when the shared wiring contract changes so parity remains executable rather than documentary.

## Greenfield Refactors

- This repository is greenfield. Use hard cutovers with no compatibility aliases, duplicate fields, fallback vocabulary, or dual-shape support.
- Preserve each Riff's business behavior when changing taxonomy or wiring.
- Validate repository-wide changes with the root Bun scripts and `bun riffs/riff-auditor/src/cli.ts audit --strict`.
