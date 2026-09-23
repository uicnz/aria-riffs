---
name: commit-formatter
description: Conventional commit message formatting via LLM analysis with three
  processing modes
---

# Commit Formatter

## Purpose

Scans git commit history and uses LLM providers (Anthropic, Gemini, or OpenAI) to reformat commit messages into Conventional Commits v1.0.0 format. Provides three processing modes: automatic (full auto-apply for archived repos), assisted (human-in-the-loop with immediate apply for active repos), and advisory (suggestions only, no changes). Creates backup branches before any modifications and generates JSON/Markdown reports. Supports author rewriting for commit attribution changes.

## When to use

- Reformatting messy commit history in archived or legacy repositories to conventional commit format
- Reviewing and selectively approving commit message rewrites in active repositories
- Generating advisory reports of suggested commit message improvements without modifying history
- Cleaning up commit history before publishing a repository or sharing with new team members
- Standardizing commit messages across a project for changelog generation

## Pipeline

1. Scan git log for the specified number of commits (default: 20)
2. Optionally skip commits already in conventional format (--skip-conventional)
3. Send each commit message to the configured LLM provider for analysis
4. LLM classifies commit type (feat, fix, chore, docs, refactor, etc.) and generates formatted message
5. In automatic mode: create backup branch, apply all reformatted messages via interactive rebase
6. In assisted mode: present each suggestion for approval/skip/edit, apply immediately on approval
7. In advisory mode: generate Markdown report with all suggestions, never modify history
8. Generate JSON and/or Markdown reports documenting all changes

## Parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `command` | `enum(automatic\|assisted\|advisory\|check\|preview\|format)` | yes | Processing mode: automatic (full auto), assisted (approve each), advisory (report only), check (test API), preview (single commit), format (legacy) |
| `--count` | `number` | no | Number of commits to scan (default: 20) |
| `--dry-run` | `flag` | no | Preview changes without modifying git history |
| `--no-skip-conventional` | `flag` | no | Include already-formatted conventional commits |
| `--no-backup` | `flag` | no | Skip backup branch creation (not recommended) |
| `--no-report` | `flag` | no | Skip generating report files |
| `--author-name` | `string` | no | Rewrite all commit authors to this name |
| `--author-email` | `string` | no | Rewrite all commit authors to this email |
| `-v, --verbose` | `flag` | no | Enable verbose debug logging |

## Output

Reformatted git commit history (automatic/assisted modes) or Markdown report with suggestions (advisory mode). Backup branches created as backup-before-reformat-YYYYMMDD. JSON and Markdown reports generated with change details. Requires force push after history rewrite.

## Constraints

- Requires API key for the configured LLM provider (ANTHROPIC_API_KEY, GOOGLE_API_KEY, or OPENAI_API_KEY)
- Non-dry-run operations require a clean git working directory
- History rewrite requires force push (git push --force-with-lease) afterward
- Team members must re-clone or reset after force push
- Each commit analyzed sends one API request to the LLM provider

## Conventions

- Always use --dry-run first to preview what would change
- Always verify backup branch exists before force pushing
- Use advisory mode when you only want to review suggestions
- Use assisted mode for active repositories where careful review is needed
- Use automatic mode only for archived or legacy repositories
- Configure LLM provider in config.yaml (co-located in the riff directory), API keys in .env file
- Invocation pattern: $RIFF [mode] [options]

## Examples

### Preview automatic reformatting without changes

```sh
$RIFF automatic --dry-run
```

Shows what each commit message would be reformatted to without modifying history

### Interactively approve commit rewrites

```sh
$RIFF assisted --count 50
```

Presents each of the last 50 commits for approval, applies approved changes immediately

### Generate advisory report only

```sh
$RIFF advisory --count 30
```

Creates a Markdown report with reformatting suggestions for the last 30 commits without modifying anything
