# Project Standards

## Semantic Parity Across All Artifacts

**Fundamental Principle**: Every aspect of a riff must share consistent naming semantics for discoverability and comprehension. Clean class-based architecture everywhere! Also: "Each riff should do what it does very well without any dependencies on any other riffs ever!!"

This applies to ALL artifacts:

- **Code** - Classes, functions, variables, types
- **Documentation** - Files, headers, references
- **Configuration** - YAML keys, environment variables
- **Commands** - CLI commands, Bun package scripts
- **Storage** - Log files, databases, exports, directories
- **Identifiers** - Riff names, module names, schema names

### Semantic Parity Naming Pattern

If your riff is named `mindmap-converter`, then semantic parity demands:

```tree
riffs/mindmap-converter/              ← Directory
config.yaml  ← Config file
MINDMAP_*                             ← Env variables
.aria/logs/mindmap-converter.log            ← Log file
.aria/db/mindmap/                           ← Database directory
.aria/exports/mindmap/                      ← Export directory
convert                               ← Package-local Bun script
MindmapConverterConfig                ← TypeScript type
createLogger('mindmap-converter')     ← Logger identifier
```

### Why Semantic Parity Matters

**Discoverability**: `grep -r "mindmap-converter"` finds everything related to the riff across the entire codebase.

**Comprehension**: Naming consistency eliminates cognitive overhead - if you know one artifact's name, you know them all.

**SEO**: Searchability applies to code AND documentation. Clear semantics enable AI agents, developers, and search riffs to navigate the project efficiently.

**Maintainability**: Refactoring, debugging, and extending riffs becomes trivial when naming is predictable and consistent.

### Semantic Parity Anti-Patterns

```tree
riffs/mm-riff/                        ← Different name
config/config-mindmap.yaml            ← Different name
OUTLINE_*                             ← Different name
.aria/logs/converter.log                    ← Different name
OutlineConverterConfig                ← Different name
```

This breaks semantic parity and destroys discoverability.

## File Naming Conventions

### File Naming Strict Rules

- **NO EMOJIS EVER** - We absolutely despise emojis in any form
- **Lowercase file names** with dashes (kebab-case): `file-name.ts` unless there's an edge case where Python is needed, in which case use `file_name.py`
- **No underscores** - Always use dashes instead
- **No capitalized file names** except `README.md`

### Module Naming Pattern

- **Action-oriented structure**: `{action}-{noun}.ts` Two words only!
- **Alphabetical grouping** - all similar actions cluster together
- **Natural language flow** - reads like commands
- **API-ready naming** for future endpoint mapping

Examples:

```text
scan-files.ts       → POST /scan-files
extract-links.ts    → POST /extract-links
process-markdown.ts → POST /process-markdown
validate-schema.ts  → POST /validate-schema
parse-documents.ts  → POST /parse-documents
```

## Code Architecture

### Code Modularity Requirements

- **Highly modular** - Shane dislikes long files
- **Single responsibility** - Each module does one thing well
- **Small files** - Prefer 200-300 lines max per module
- **Clean separation** of concerns
- **No Monolithic Files** - All JavaScript riffs must be refactored into highly modularized TypeScript
- **No CommonJS** - All CommonJS files must be converted to ESM TypeScript modules

### CLI-First Architecture

- **Every riff must have a CLI** - Use Commander.js for all command-line interfaces
- **Extensible Design** - Architecture must support easy addition of new features without major refactoring
- **Separation of Concerns** - CLI, core logic, file I/O, and types must be in separate modules
- **Forward-thinking** - Design for future feature additions from day one

### TypeScript Requirements

- **TypeScript-first** - No Python references or legacy code
- **Full Type Safety** - TypeScript strict mode with comprehensive type definitions
- **ESM Modules** - All code must use ES module imports/exports
- **Consistent Structure** - Standardized directory structure across all packages

### Riff Directory Structure Standards

> Note we fence type with the word "tree" here when we are listing files.

```tree
src/                    # Source code only
├── cli.ts              # Command-line interface (Commander.js)
├── config.ts           # Configuration constants
├── types.ts            # TypeScript interfaces/types
├── process-core.ts     # Main processing logic
├── handle-files.ts     # File I/O operations
└── utils.ts            # Utility functions
```

### Package Structure (Monorepo)

```tree
packages/riff-name/
├── package.json            # Package configuration
├── tsconfig.json           # TypeScript configuration
├── src/                    # Source code
│   ├── cli.ts              # CLI interface
│   ├── types.ts            # Type definitions
│   ├── process-core.ts     # Main functionality
│   └── handle-files.ts     # File operations
└── README.md               # Riff documentation
```

## Monorepo Standards

### Monorepo Execution Strategy

**How we manage this monorepo:**

- **Direct TypeScript execution** - All riffs run TypeScript files directly with `bun`, no build steps
- **No root tsconfig.json** - Each riff maintains its own `tsconfig.json` for independence
- **All commands run from root** - Never use `cd` in scripts, always specify full paths
- **Pattern: `bun riffs/{riff-name}/src/cli.ts`** - Consistent execution pattern for all riffs
- **Root typecheck runs all riffs** - `bun run typecheck` runs each riff's typecheck individually

**Why this approach:**

- **Zero build steps** - Edit code and run immediately, no compilation needed
- **Riff independence** - Each riff can have different TypeScript strictness levels
- **Simple and clear** - Look in a riff's folder to find its configuration
- **Fast iteration** - No waiting for builds, instant feedback

**Command structure:**

```json
{
    "scripts": {
        // Main commands - run TypeScript directly
        "doc-indexer:search": "bun riffs/doc-indexer/src/index.ts search",
        "code-auditor:audit": "bun riffs/code-auditor/src/cli.ts audit",

        // Testing with Vitest
        "test": "vitest",
        "test:run": "vitest run",
        "test:ui": "vitest --ui",
        "test:coverage": "vitest run --coverage",

        // Typecheck - each riff individually
        "doc-indexer:typecheck": "tsc --noEmit -p riffs/doc-indexer/tsconfig.json",
        "code-auditor:typecheck": "tsc --noEmit -p riffs/code-auditor/tsconfig.json",

        // Root typecheck - runs all riffs
        "typecheck": "bun run --cwd riffs/doc-indexer typecheck && bun run --cwd riffs/code-auditor typecheck && ..."
    }
}
```

### Monorepo Package Management

- **Bun** - Modern, fast runtime and package manager
- **Centralized dependencies** - All dependencies in root package.json
- **No duplicate node_modules** - Individual riffs must not have separate node_modules
- **NO separate package.json** - Riffs in the monorepo must NOT have their own package.json files
- **Root package.json only** - All dependencies and scripts managed from the root package.json

### Monorepo Package Naming

- **Scoped packages** - All packages use `@aria-riffs/package-name` format
- **Kebab-case names** - Package names use dashes: `@aria-riffs/alt-text`
- **Descriptive names** - Package name should clearly indicate functionality
- **Consistent versioning** - All packages start at version 1.0.0

### Testing Standards

- **Vitest** - Fast, modern test framework with native ESM support
- **Test structure** - Organized in `test/` directory with subdirectories: `unit/`, `integration/`, `fixtures/`
- **Test coverage** - Minimum 80% code coverage for all packages
- **Integration tests** - Test CLI interfaces and cross-package functionality
- **Automated testing** - All tests must pass before commits
- **Test commands** - Use `bun test` for watch mode, `bun test:run` for CI, `bun test:ui` for interactive testing

#### TypeScript Test Execution Protocol

**CRITICAL**: When working with TypeScript test suites during riff conversion:

1. **Always run tests with bun**: Tests are designed to work with TypeScript directly via `bun test-file.ts`
2. **Never debug with node -e commands**: This leads to module resolution errors and debugging confusion
3. **Fix failing test expectations**: If tests fail, examine what the code actually does and adjust test assertions accordingly
4. **Trust the modular architecture**: When run with bun, TypeScript modules import correctly without build steps
5. **Don't overcomplicate debugging**: The successful approach is simple - run tests, fix assertions, move on

**Test Failure Resolution Process**:

1. Run test with `bun test-file.ts`
2. Read the failure message carefully
3. Examine the actual vs expected behavior in the code
4. Update test expectations to match correct behavior
5. Re-run test to confirm fix
6. Move to next test file

**AVOID**: Getting stuck in debugging loops with node commands, module resolution errors, or complex debugging when simple test expectation fixes are needed.

### TypeScript Configuration

- **No build system** - Riffs run directly with `tsx`, no compilation needed
- **Individual tsconfig.json files** - Each riff has its own TypeScript configuration
- **Type checking only** - `tsc --noEmit` for validation without building
- **Flexible strictness** - Each riff can set its own TypeScript strictness level
- **Baseline tsconfig.json** - Riffs generally follow this pattern but can customize:

```json
{
    "compilerOptions": {
        "target": "ESNext",
        "module": "NodeNext",
        "moduleResolution": "NodeNext",
        "esModuleInterop": true,
        "forceConsistentCasingInFileNames": true,
        "skipLibCheck": true,
        "strict": true,
        "resolveJsonModule": true,
        "outDir": "dist",
        "rootDir": "src",
        "types": ["node"]
    },
    "include": ["src/**/*"]
}
```

## Development Philosophy

### Zero Server Dependency

**CRITICAL PRINCIPLE**: All riffs in this monorepo must operate without any server dependencies.

- **Clone and run** - `git clone` → `bun install` → ready to use
- **Local-first processing** - All computation, storage, and configuration happens locally
- **Offline capable** - Riffs work without internet (except optional cloud AI providers)
- **Self-contained** - No external services, databases, or infrastructure required
- **File-based storage** - Local files for config, data, backups, reports
- **No web interfaces** - CLI-only, no web servers or HTTP endpoints
- **Enterprise ready** - Works in air-gapped/restricted environments
- **Zero operational overhead** - No infrastructure to manage or maintain

**Why this matters:**

- Ensures enterprise adoption in any environment
- Eliminates setup friction and deployment complexity
- Provides maximum reliability with no external dependencies
- Maintains riff portability across any Node.js environment
- Reduces maintenance burden and operational costs

### Priorities

- **Zero server dependencies** - Fundamental architectural requirement
- **100% Dependability** over efficiency
- **Professional structure** ready for enterprise expansion
- **CLI-first architecture** - Terminal interfaces, not web interfaces
- **TypeScript-first** - No Python references or legacy code
- **Clean, maintainable code** that any developer can understand
- **Monorepo-first** - All new code follows monorepo patterns

### Platform Requirements

- **Bun** or **Node.js 22+** with TypeScript - Bun preferred for performance
- **Cross-platform support** - Most riffs should work on macOS, Linux, Windows
- **macOS-specific riffs** - Some riffs (like SharePoint) use AppleScript automation
- **Professional riffchain** - Bun, tsx, TypeScript compiler, Biome, Vitest, proper configs

## Code Quality Standards

### Code Linting and Formatting

- **Biome** - Fast, modern linter and formatter for TypeScript/JavaScript (10-100x faster than ESLint)
- **Single riff** - Replaces ESLint + Prettier with unified solution
- **Configuration** - Root `biome.json` with consistent rules across all projects
- **Lint + Format** - Use `biome check --write .` to lint and format in one command
- **Pre-commit** - All code must pass Biome checks before commits
- **Indentation** - 4 spaces (configured in biome.json)
- **Performance** - 10-100x faster than ESLint, instant feedback
- **Git-aware** - Only checks changed files by default

### TypeScript Type Checking

- **TypeScript strict mode** - All projects use strict type checking
- **No implicit any** - Explicit types required for all parameters and returns
- **Root tsconfig.json** - Centralized configuration managed from project root
- **Run checks** - Use `bun run tsc --noEmit` or `npx tsc --noEmit` for type validation

## Logging Standards

All Aria riffs use Pino for production-grade structured logging.

### Logging Implementation Guide

**Primary reference:** [Pino Implementation Guide](../logging/pino-implementation-guide.md)

This guide provides:

- Complete logger module implementation pattern
- Zod schema configuration
- CLI integration with Commander.js
- Environment variable override patterns
- Console and file logging setup
- Example code from mindmap-converter (reference implementation)

### Logging Best Practices

**Reference:** [12 Logging Best Practices](../logging/logging-best-practices.md)

Key practices implemented:

- **Structured logging** - JSON format for machine parsing
- **Log levels** - DEBUG, INFO, WARN, ERROR hierarchy
- **Context and detail** - Every log includes relevant data as objects
- **Performance** - Pino is fastest Node.js logger (minimal overhead)
- **Retention policies** - Daily + size-based rotation with configurable retention
- **Dual output** - Pretty console for humans, JSON files for riffs

### Logging Configuration Standards

Every riff should implement:

```yaml
logging:
    level: 'INFO'
    verbose: false
    file: '{riff-name}.log'
    max_file_size_mb: 10
    max_files: 7
```

### Logging Usage Pattern

```typescript
// Import and create logger
import { createLogger } from './logger.js';
import type { Logger } from 'pino';

let logger: Logger;

// Initialize in preAction hook
logger = createLogger({
    level: config.logging.level,
    verbose: config.logging.verbose,
    file: config.logging.file,
    maxFileSizeMb: config.logging.max_file_size_mb,
    maxFiles: config.logging.max_files,
});

// Use structured logging with context
logger.info({ inputPath, outputPath }, 'Conversion completed');
logger.debug({ config }, 'Configuration loaded');
logger.error({ error: error.message }, 'Operation failed');
```

### Logging Migration Status

- **Implemented:** mindmap-converter (reference implementation)
- **Pending:** All other riffs in `riffs/` directory

See [Pino Implementation Guide](../logging/pino-implementation-guide.md) for migration checklist and timeline.

## Markdown Standards

### Markdown Formatting Rules

- **MD022**: Headings must have blank lines above and below them
- **MD032**: Lists must be surrounded by blank lines
- **MD031**: Fenced code blocks must be surrounded by blank lines
- **MD040**: Fenced code blocks must specify language
- **MD047**: Files must end with exactly one newline character

### Markdown Heading and SEO Standards

**CRITICAL**: All headings must be self-descriptive and meaningful without nesting context.

**Bad (context-dependent):**

```markdown
## File Naming Conventions

### Strict Rules ← Unclear without parent context
```

**Good (self-descriptive):**

```markdown
## File Naming Conventions

### File Naming Strict Rules ← Clear meaning standalone
```

**Requirements:**

- **Self-descriptive headings** - Header text must be clear without reading parent sections
- **Pattern-based naming** - Use consistent patterns like "{Topic} {Type}" (e.g., "Logging Implementation Guide")
- **SEO-optimized** - Headers should be searchable and discoverable independently
- **No generic words alone** - Avoid "Overview", "Details", "Rules" without topic prefix
- **Context in heading** - Include subject matter: "Markdown Formatting Rules" not "Formatting Rules"
- **Searchability first** - Someone searching "logging best practices" should find "Logging Best Practices" header

**Examples of proper heading patterns:**

- "TypeScript Type Checking" (not "Type Checking")
- "Code Modularity Requirements" (not "Modularity Requirements")
- "Logging Implementation Guide" (not "Implementation Guide")
- "Markdown Text Standards" (not "Text Standards")
- "Riff Directory Structure Standards" (not "Standard Riff Directory Structure")

**Why this matters:**

- Documentation search and indexing
- AI/LLM comprehension without full document context
- Anchor link clarity in URLs
- Table of contents usability
- Cross-referencing between documents

### Markdown Text Standards

- **No emojis** - Use plain text alternatives (COMPLETED, ERROR, SUCCESS, etc.)
- **Lowercase file names** with dashes: `standards-project.md`
- **README.md exception** - Only file allowed to be capitalized
- **Consistent formatting** - Proper heading hierarchy, strict blank line requirements

### Markdown Required Patterns

````markdown
## Heading

Content must have blank line above and below headings.

### Subheading

Lists require blank lines:

- First item
- Second item
- Third item

Code blocks need language and blank lines:

```typescript
const example = 'properly formatted';
```

More content after blank line. Also observe the last blank line below
````

### Markdown Communication Standards

- **Plain text emphasis** instead of emoji indicators
- **Professional tone** in all documentation
- **Clear, concise instructions** without unnecessary fluff
- **Strict lint compliance** - all files must pass markdown linting

## Future Considerations

### Database Integration

- SQLite database planned for `/db` directory
- CSV remains primary, database for advanced queries
- Schema versioning for future migrations

### File Management Features

- File normalization (lowercase, dashes, no special characters)
- Directory reorganization capabilities
- Rollback/mapping functionality
- Sync between original and clean file systems

## CLI Interface Standards

### Commander.js Requirements

- **Every riff has CLI** - All riffs must implement proper CLI using Commander.js
- **Consistent commands** - Use standard verbs: `process`, `analyze`, `convert`, `validate`
- **Help documentation** - Every command must have clear help text and examples
- **Error handling** - Proper error messages and exit codes
- **Verbose modes** - Support `--verbose` flag for detailed output
- **Dry run support** - Support `--dry-run` for testing without changes

### CLI Architecture

- **Separate CLI module** - CLI logic in dedicated `cli.ts` file
- **Argument validation** - Validate all inputs before processing
- **Progress reporting** - Show progress for long-running operations
- **Graceful interrupts** - Handle Ctrl+C and cleanup properly
- **Exit codes** - Use standard exit codes (0 = success, 1 = error, 2 = misuse)

### Command Naming Convention

- **Package-local ownership** - Every script belongs to its Riff's `package.json`
- **Shared scaffold** - Every Riff exposes identical `start`, `test`, and `typecheck` scripts
- **Business actions** - Additional script names match the corresponding CLI command exactly
- **Root restraint** - The workspace root exposes repository-wide operations only

### Documentation Standards for AI Agents

**CRITICAL**: All README files and documentation must prioritize direct Bun commands over package aliases for agent compatibility.

#### Why bun Commands Are Essential for Agents

AI agents require direct, transparent, and context-independent instructions. Using bun commands provides:

1. **No abstraction layer** - `bun riffs/riff-name/src/cli.ts` tells the agent EXACTLY what file to execute and where it is located
2. **Self-contained** - The command contains the full path with no need to lookup package.json scripts
3. **Discoverable** - Agents can see the actual file structure and location without parsing configuration
4. **Portable** - Works from any directory with the full path, not dependent on being in repo root
5. **Transparent** - No hidden logic or indirection, what you see is what executes
6. **Context-independent** - Doesn't require understanding package script mappings

#### Problems with Package Scripts for Agents

Package scripts hide critical information from agents:

- `bun run --cwd riffs/riff-name start` - Agent must parse package.json to discover the entrypoint
- Adds indirection and cognitive overhead
- Breaks the directness agents need for reliable execution
- Requires understanding package script resolution
- Creates dependency on being in the correct directory
- Obscures the actual file being executed

#### Documentation Pattern

**CORRECT - bun commands first:**

```sh
# Primary usage - direct bun execution
bun riffs/riff-name/src/cli.ts --help          # Show help
bun riffs/riff-name/src/cli.ts analyze         # Run analysis

# Alternative - package-local Bun scripts (optional)
bun run --cwd riffs/riff-name start -- --help  # Show help
bun run --cwd riffs/riff-name start -- analyze # Run analysis
```

**INCORRECT - package scripts first:**

```sh
# Don't document this way
bun run --cwd riffs/riff-name start -- --help  # Hides actual execution
```

#### Why This Matters

For agents: "Run `bun riffs/riff-name/src/cli.ts`" is a complete, executable instruction.
For agents: "Run `bun run --cwd riffs/riff-name start`" requires the agent to inspect the package script before it knows what executes.

**Every README must document direct Bun commands as the primary method, with package-local scripts as optional convenience aliases.**

## Migration Notes

### Module Naming Convention Change

**Previous Pattern**: `{noun}-{action}.ts` (e.g., `file-scan.ts`)
**New Pattern**: `{action}-{noun}.ts` (e.g., `scan-files.ts`)

- New riffs must use action-noun pattern
- Existing riffs will be migrated when next modified
- The action-noun pattern provides better alphabetical grouping

## Non-Negotiable Rules

- **ZERO SERVER DEPENDENCIES** - No servers, web services, or external infrastructure required
- **NO EMOJIS** - This cannot be overstated
- **CLI-only interfaces** - No web interfaces, HTTP servers, or browser-based riffs
- **Dashes over underscores** - Everywhere, always
- **Lowercase file names** - Except README.md
- **Modular architecture** - Small, focused files under 300 lines
- **Action-noun naming** - Module files use action-noun pattern
- **100% dependability** - Functionality over performance
- **TypeScript-only** - No Python legacy code, no CommonJS
- **CLI-first design** - Every riff must have proper Commander.js CLI
- **Local-first storage** - All data, config, and state stored in local files
- **Monorepo structure** - All new code follows monorepo patterns
- **No monolithic files** - Break down large files into focused modules
- **Extensible architecture** - Design for future feature additions
- **Strict Markdown linting** - All files must be lint-compliant with `markdownlint-cli2 --fix "**/*.md"`

---

> [!IMPORTANT]
> **Remember**: Semantic parity across all artifacts. If it's the same riff, it should have the same name everywhere - code, classes, docs, config, logs, commands, databases, exports. Consistency enables discoverability.

---

- Last updated: 2025-10-27
- Project-wide standards for all Aria riffs and monorepo development
- Modern riffing: Bun, Biome, Vitest for performance and developer experience
