# Aria Commit Formatter Riff

Agent managed commit message reformatting using LLM analysis to convert commits to conventional commit format with semantic accuracy.

## Overview

The commit-formatter riff scans git commit history and uses LLM providers (Anthropic, Gemini, or OpenAI) to reformat commit messages into conventional commit format. It provides three processing modes to handle different scenarios:

- **Automatic Mode**: Full auto-apply for old/archived repos
- **Assisted Mode**: AI assists, you approve, immediate apply for active development
- **Advisory Mode**: Generate suggestions only, never apply

## Three Processing Modes

### Automatic Mode (Full Auto - For Archived Repos)

Best for archived or legacy repositories that are no longer under active development. Perfect for cleaning up history before showing to interns or using as learning materials.

**Features**:

- Processes all commits automatically
- Creates automatic backup branch
- Generates complete documentation
- Applies changes in one operation

**Usage**:

```sh
# Dry run first (recommended)
bun riffs/commit-formatter/src/cli.ts automatic --dry-run

# Process all commits
bun riffs/commit-formatter/src/cli.ts automatic

# Process specific number
bun riffs/commit-formatter/src/cli.ts automatic --count 100

# Alternative
bun run --cwd riffs/commit-formatter automatic -- --dry-run
```

### Assisted Mode (Human-in-the-Loop - For Active Repos)

Best for repositories under active development where you want to review and approve each change individually. Changes are applied immediately upon approval.

**Features**:

- Review each commit one at a time
- Approve, skip, edit, or quit for each
- Changes applied immediately on approval
- Safe for active development

**Usage**:

```sh
# Start assisted session
bun riffs/commit-formatter/src/cli.ts assisted

# Scan specific number of commits
bun riffs/commit-formatter/src/cli.ts assisted --count 50

# Alternative
bun run --cwd riffs/commit-formatter assisted
```

**Interactive prompts**:

- `y` or `yes` - Approve and apply the suggested message immediately
- `n` or `no` - Skip this commit
- `e` or `edit` - Enter custom message and apply it
- `s` or `skip` - Skip this commit
- `q` or `quit` - Stop processing

### Advisory Mode (Suggestions Only - No Changes)

Best when you want to review suggestions without making any changes to your repository. Generates a markdown report for manual review.

**Features**:

- Generates all suggestions quickly
- Creates markdown report
- Never applies any changes
- No backup branch needed (read-only)

**Usage**:

```sh
# Generate suggestions
bun riffs/commit-formatter/src/cli.ts advisory --count 50

# Alternative
bun run --cwd riffs/commit-formatter advisory -- --count 50

# Review the generated markdown file
# commit-reformat-report-YYYY-MM-DD.md

# To apply changes, use automatic or assisted mode
```

## Author Rewriting

All modes support rewriting commit authors:

```sh
# Preserve original authors (default)
bun riffs/commit-formatter/src/cli.ts automatic

# Rewrite all commits to single author
bun riffs/commit-formatter/src/cli.ts automatic \
  --author-name "Your Name" \
  --author-email "your.email@example.com"

# Works with all modes
bun riffs/commit-formatter/src/cli.ts assisted \
  --author-name "Your Name" \
  --author-email "your.email@example.com"
```

## Configuration

### Environment Variables (.env file)

The riff uses a `.env` file for **API keys only**. Copy `.env.example` to `.env` and add your keys:

```sh
# Copy example file
cp .env.example .env

# Edit .env and add your API key
ANTHROPIC_API_KEY=your-anthropic-api-key-here
```

**Important**: Use `.env` for sensitive credentials only. All other settings (provider, model, temperature, etc.) should be configured in `config.yaml`.

### Config File

The riff reads defaults from `config.yaml`:

- **Provider selection**: Choose between Anthropic, Gemini, or OpenAI
- **Model settings**: Model name, temperature, max tokens per provider
- **Processing defaults**: Mode, count, backup, reports
- **Author rewriting**: Preserve or rewrite commit authors
- **Logging**: Verbosity and log levels

All config values can be overridden by environment variables.

### Supported Providers

| Provider  | Default Model    | Environment Variable |
| --------- | ---------------- | -------------------- |
| Anthropic | claude-haiku-4-5 | ANTHROPIC_API_KEY    |
| Gemini    | gemini-3.8-flash | GOOGLE_API_KEY       |
| OpenAI    | gpt-5.6-luna     | OPENAI_API_KEY       |

### Switching Providers

**Recommended**: Edit the config file `config.yaml`:

```yaml
llm:
    provider: 'gemini' # Change from 'anthropic' to 'gemini' or 'openai'
```

Then add the appropriate API key to your `.env` file:

```sh
# .env file
GOOGLE_API_KEY=your-key-here
```

**Alternative** (temporary override via environment variable):

```sh
export LLM_PROVIDER=gemini
bun run --cwd riffs/commit-formatter check
```

## Conventional Commits Format

The riff formats messages to follow the official [Conventional Commits v1.0.0](https://www.conventionalcommits.org/en/v1.0.0/) specification:

```txt
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Required Types

Per the official specification:

- **feat**: Introduces new functionality (correlates with MINOR in semantic versioning)
- **fix**: Patches a bug in the codebase (correlates with PATCH in semantic versioning)

### Additional Allowed Types

The specification permits these additional types:

- **build**: Build system or external dependencies
- **chore**: Maintenance tasks, dependency updates, configs
- **ci**: CI/CD pipeline changes
- **docs**: Documentation only changes
- **style**: Formatting, whitespace, missing semicolons (no code behavior change)
- **refactor**: Code change that neither fixes a bug nor adds a feature
- **perf**: Performance improvements
- **test**: Adding or updating tests

### Breaking Changes

Breaking changes (correlate with MAJOR in semantic versioning) can be indicated by:

- Adding `!` before the colon: `feat!: description`
- Adding `!` with scope: `feat(api)!: description`
- Using `BREAKING CHANGE:` footer (not yet implemented in this riff)

### Format Rules

1. Type and description are required
2. Scope is optional - enclosed in parentheses when used
3. Description should be concise (under 72 characters)
4. Use imperative mood ("add" not "added")
5. No period at end of description
6. Lowercase for type and scope

### Examples

```txt
Original: wip
Formatted: feat(database): add connection pooling

Original: typo
Formatted: docs: fix typo in README

Original: Clean up on aisle 5
Formatted: chore: cleanup and refactor

Original: removed old API endpoints
Formatted: feat(api)!: remove deprecated v1 endpoints
```

## Safety Features

### Automatic Backups

All non-dry-run operations create backup branches:

```txt
backup-before-reformat-YYYYMMDD
```

To restore from backup:

```sh
git reset --hard backup-before-reformat-20251103
```

### Reports and Documentation

Automatic and assisted modes generate:

- JSON report with all changes (automatic mode only)
- Markdown human-readable report
- commit-history-rewrite.md documentation (automatic mode only)

Advisory mode generates:

- Markdown report with suggestions only

### Dry Run Mode

Every strategy that can modify git history has dry-run support:

| Mode          | Dry-Run Support | How                             |
| ------------- | --------------- | ------------------------------- |
| Automatic     | ✓ Yes           | `--dry-run` flag                |
| Assisted      | ✓ Yes           | `--dry-run` flag                |
| Advisory      | ✓ Yes           | Always dry (by design)          |
| Legacy format | ✓ Yes           | `--dry-run` flag (always on)    |
| Preview       | ✓ Yes           | Read-only (no changes possible) |
| Check         | ✓ Yes           | Read-only (no changes possible) |

Examples:

```sh
bun riffs/commit-formatter/src/cli.ts automatic --dry-run
bun riffs/commit-formatter/src/cli.ts assisted --dry-run
```

## Additional Commands

### Check API Connection

```sh
bun riffs/commit-formatter/src/cli.ts check
bun run --cwd riffs/commit-formatter check
```

### Preview Single Commit

```sh
bun riffs/commit-formatter/src/cli.ts preview <commit-hash>
bun run --cwd riffs/commit-formatter preview <commit-hash>
```

### Legacy Format Command

Backwards compatible with v1.0:

```sh
bun riffs/commit-formatter/src/cli.ts format --count 10 --dry-run
bun run --cwd riffs/commit-formatter format -- --count 10 --dry-run
```

## Workflow Examples

### Example 1: Clean Up Archived Repo

```sh
# 1. Dry run to preview
bun run --cwd riffs/commit-formatter automatic -- --dry-run

# 2. Apply changes
bun run --cwd riffs/commit-formatter automatic

# 3. Verify
git log --oneline

# 4. Push backup
git push origin backup-before-reformat-20251103

# 5. Force push
git push --force-with-lease origin main
```

### Example 2: Active Repo Cleanup

```sh
# Use assisted mode for careful review with immediate application
bun run --cwd riffs/commit-formatter assisted

# Follow prompts to approve/skip each commit
# Approved changes are applied immediately

# Verify changes
git log --oneline
```

### Example 3: Advisory Review Workflow

```sh
# 1. Generate suggestions
bun run --cwd riffs/commit-formatter advisory -- --count 30

# 2. Review markdown file
# commit-reformat-report-2025-11-03.md

# 3. To apply changes, use automatic or assisted mode
bun run --cwd riffs/commit-formatter automatic
# OR
bun run --cwd riffs/commit-formatter assisted
```

## Important Notes

### Force Push Required

After rewriting history, you must force push:

```sh
git push --force-with-lease origin main
```

### Team Coordination

When force pushing, team members must:

**Option 1** (Simplest):

```sh
# Delete and re-clone
rm -rf project-name
git clone <repository-url>
```

**Option 2**:

```sh
# Reset local branch
git fetch origin
git reset --hard origin/main
```

### When to Use Each Mode

| Mode          | Use Case                               | Risk Level | Automation            |
| ------------- | -------------------------------------- | ---------- | --------------------- |
| **Automatic** | Old/archived repos, learning materials | Low        | Fully automated       |
| **Assisted**  | Active development, careful review     | Very Low   | Immediate on approval |
| **Advisory**  | Review only, no changes                | None       | No changes made       |

## Options Reference

### Common Options

- `--count <number>` - Number of commits to scan
- `--dry-run` - Preview without making changes
- `--no-skip-conventional` - Include already-formatted commits
- `--author-name <name>` - Rewrite author name (automatic/assisted only)
- `--author-email <email>` - Rewrite author email (automatic/assisted only)

### Automatic Mode Options

- `--no-backup` - Skip backup branch creation (not recommended)
- `--no-report` - Skip generating reports

### Assisted Mode Options

- `--no-backup` - Skip backup branch creation (not recommended)
- `--no-report` - Skip generating final report

## Architecture

- **cli.ts** - Commander.js CLI interface with all modes
- **modes/automatic-mode.ts** - Full auto-apply processing
- **modes/assisted-mode.ts** - Human-in-the-loop with immediate apply
- **modes/advisory-mode.ts** - Suggestions only, no changes
- **llm-client.ts** - LLM provider integration for message generation
- **providers/** - Provider implementations (Anthropic, Gemini, OpenAI)
- **git-utils.ts** - Git command utilities
- **backup-utils.ts** - Backup and safety operations
- **rebase-utils.ts** - Git rebase automation
- **report-utils.ts** - Report generation
- **types.ts** - TypeScript type definitions

## Requirements

- Node.js 24+
- Git repository
- API key for chosen LLM provider (Anthropic, Gemini, or OpenAI)
- Clean working directory (for non-dry-run operations)

## Type Checking

```sh
bun run --cwd riffs/commit-formatter typecheck
```

## Troubleshooting

### "Repository has uncommitted changes"

Commit or stash your changes before running non-dry-run operations:

```sh
git stash
bun run --cwd riffs/commit-formatter automatic
git stash pop
```

### "Failed to connect to Anthropic API"

Check your API key:

```sh
# Verify .env file exists and contains
ANTHROPIC_API_KEY=sk-ant-...

# Test connection
bun run --cwd riffs/commit-formatter check
```

### Rebase Failed

If rebase fails, the riff will automatically restore from backup:

```sh
# Manual restore
git reset --hard backup-before-reformat-YYYYMMDD
```

## Version History

- **v2.0.0**: Added automatic, assisted, and advisory modes with safety features
- **v1.0.0**: Initial release with basic preview and manual instructions
