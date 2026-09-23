# Aria Riff Source

This repository is the remotely published Source for Aria Riffs. It is the workspace where Riffs are authored, built, and released; Aria embeds a pinned release and acquires later releases from GitHub.

## Source taxonomy

```text
riffs/
├── .system/        # authority-qualified system tier
├── .curated/       # authority-qualified curated tier
└── .experimental/  # authority-qualified experimental tier
```

Every immediate child of a tier is one atomic release unit: one Riff. Its canonical identity is the `name` in its `RIFF.md` frontmatter, which equals its directory name, its `config.yaml` `aria-riff.name`, its `package.json` binary name, and the package name `@aria/<riff>`. A Riff lives in exactly one tier; the release catalog assigns the tier, and promotion moves the directory.

The reserved `_assets/` child is the sole non-Riff exception. It contains tracked tier-level shared authoring assets, must contain only regular files and directories, and is never counted as a Riff identity or release unit. A tier-level `manifest.yaml` is the hashed registry for the materialized source collection.

Do not add package-name branches to Source tooling. Tier roots are enumerated generically, and ignored or untracked files must never enter release archives.

## Canonical Riff contract

- `riff` is the only product token for an independently distributed executable callable in this repository.
- A Riff is not a Tool type, Tool source, Tool mode, Tool package, or Tool compatibility layer.
- Riff wiring uses only the canonical Riff vocabulary defined in this repository.
- Every Riff uses the same wiring contract: `README.md`, `RIFF.md`, `aria.yaml`, `config.yaml`, `package.json`, `src/cli.ts`, and the developer-built `dist/cli.js` distribution. `aria.yaml` is the Aria item declaration shared by every ICP family; a Riff declares its `executable` contribution there.
- `RIFF.md` is the authored specification an Agent reads before invoking: frontmatter `name` and `description`, then the sections Purpose, When to use, Pipeline, Parameters, Output, Constraints, Conventions, and Examples, in that order. Example commands invoke `$RIFF`. Aria parses this document; it is the only source of Riff guidance.
- `config.yaml` exposes runtime configuration and canonical discovery metadata beneath `aria-riff`; its `name` matches the directory name exactly.
- `package.json` uses `@aria/<riff>`, exposes a binary named `<riff>`, and lists `dist/`, `src/`, `config.yaml`, `README.md`, `RIFF.md`, and `aria.yaml` as its files.
- Aria owns invocation identity, approval, durability, telemetry, and protocol projection. A Riff receives arguments and executes its own bounded business behavior. It does not impersonate an Aria Tool or manufacture Tool correlation.
- Riff developers own dependency installation and distribution builds. Normal Riff invocation never installs dependencies. When an invoked package is incomplete or broken, the Aria agent may inspect and repair it in place with its ordinary filesystem, Shell, package, build, and test capabilities before refreshing discovery and retrying.
- Keep all Riffs at absolute structural and semantic parity. Extend `riff-auditor` when the shared wiring contract changes so parity remains executable rather than documentary.

## Publication

`source.yaml` contains public Source and authority metadata plus the curated domain, category, assignment, and search-tag projection. This is human-authored Source policy, not identity inferred from paths or package-name logic in Aria. Every tracked Riff identity must have exactly one assignment and every assignment must reference a declared domain/category. Private signing keys remain outside this repository. Aria's Source release builder creates one archive per release unit and a signed `source.json` checkpoint for a GitHub release.

GitHub release retention is rolling: after a newly published release is verified as the latest checkpoint, remove every superseded GitHub release and its tag. Runtime rollback is owned by locally retained immutable generations and lifecycle receipts, not by an online release archive.

The Source URL is a replaceable Aria default. Repository location does not establish trust; Aria verifies the configured authority and embedded root key before accepting delegated index, receipt, or archive evidence.

## Greenfield Refactors

- This repository is greenfield. Use hard cutovers with no compatibility aliases, duplicate fields, fallback vocabulary, or dual-shape support.
- Preserve each Riff's business behavior when changing taxonomy or wiring.
- Validate repository-wide changes with the root Bun scripts, `bun scripts/source-check.ts riffs`, and `bun riffs/.curated/riff-auditor/src/cli.ts audit --strict`.
