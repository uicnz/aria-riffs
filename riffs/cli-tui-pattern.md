# CLI and TUI Architecture Pattern

This document describes the standard architecture for CLI (Command Line Interface) and TUI (Terminal User Interface) implementations across all Aria riffs.

For riff config and structural standards, see [docs/development/general/standards-riffs.md](../docs/development/general/standards-riffs.md). This document provides detailed TUI implementation patterns and examples.

## Overview

Aria uses a **three-tier TUI architecture**:

1. **Platform TUI** (`tui/render.tsx`) - The main entry point and navigation owner
2. **Riff TUIs** (`riffs/<riff>/src/tui/render.tsx`) - Individual riff interfaces
3. **@aria/tui Package** (`packages/tui/`) - Shared components, hooks, and theming

Each riff also has a **CLI entry point** (`riffs/<riff>/src/cli.ts`) for automation and scripting.

## Architecture Diagram

```text
                    ┌────────────────────────────────────────┐
                    │         @aria/tui Package              │
                    │  (packages/tui/src/)                   │
                    │                                        │
                    │  Components:                           │
                    │   - AppShell (layout wrapper)          │
                    │   - ConfigFieldManager (form fields)   │
                    │   - FileSelector (file/dir selection)  │
                    │   - StatusBar (nav hints + status)     │
                    │   - ErrorBox (error display)           │
                    │                                        │
                    │  Navigation:                           │
                    │   - NavMode types                      │
                    │   - NavIcons (up/down arrows etc)      │
                    │   - getNavHints()                      │
                    │                                        │
                    │  Theming:                              │
                    │   - theme (semantic colors)            │
                    │   - themeManager                       │
                    └───────────────────┬────────────────────┘
                                        │
                        Used by both Platform and Riffs
                                        │
          ┌─────────────────────────────┴───────────────────────────────┐
          │                                                             │
          ▼                                                             ▼
┌─────────────────────────────────┐                   ┌─────────────────────────────────┐
│      Platform TUI               │                   │         Riff TUIs               │
│   (tui/render.tsx)              │                   │  (riffs/<riff>/src/tui/)        │
│                                 │                   │                                 │
│  Responsibilities:              │                   │  Responsibilities:              │
│   - Riff selection menu         │    Callbacks      │   - Riff-specific UI            │
│   - StatusBar rendering         │◄──────────────────│   - ConfigFieldManager fields   │
│   - NavMode state management    │  onNavModeChange  │   - Wrapped in AppShell         │
│   - Loading riff configs        │  onStatusChange   │   - Core function execution     │
│   - Global keyboard handling    │                   │   - Inform platform of changes  │
│                                 │                   │                                 │
│  Renders StatusBar for ALL      │                   │  Does NOT render StatusBar      │
│  riffs when they are embedded   │                   │  when embedded (isEmbedded)     │
└─────────────────────────────────┘                   └─────────────────────────────────┘
```

## Core Principles

### The Golden Rule: Platform Owns ALL Navigation - ALWAYS

The **MOST IMPORTANT** architectural principle:

**The platform owns ALL navigation. Every single bit of it. At ALL times. Forever.**

This means:

1. **Platform navigation is NEVER disabled** - Not when a riff is selected, not in any mode, not ever
2. **ESC and Q ALWAYS work** - At every stage of the TUI experience, without exception
3. **Riffs can only ADD navigation** - Riffs may add additional shortcuts (like S for search, R for run), but these are additive, never replacing platform navigation

Riffs do NOT handle:

- Up/down arrow keys
- Enter/Return key behavior
- Escape key behavior
- Tab navigation
- Q key behavior (quit/back)
- Any keyboard input that could be considered "navigation"

**There is ZERO opportunity for navigation to not work at any stage.**

### Layered Back Navigation

The platform implements layered back navigation using the `backSignal` mechanism:

- **From results/search mode**: ESC/Q signals riff to go back to config mode
- **From config mode**: ESC/Q returns to platform menu
- **From platform menu**: ESC/Q exits the application

### Return to Origin

When exiting a riff, the user returns to their **point of origin** in the menu:

- Menu selection state is preserved at the platform level
- When returning from a riff, the menu highlights the riff you just came from
- Riff configurations are cached for faster re-entry
- This provides intuitive navigation without losing context

Riffs respond to the `backSignal` prop to handle internal mode transitions:

```typescript
// In riff's AppProps interface
backSignal?: number;

// In riff's App component
const prevBackSignal = useRef(backSignal ?? 0);

useEffect(() => {
    const currentSignal = backSignal ?? 0;
    if (currentSignal > prevBackSignal.current) {
        if (state.mode === 'results' || state.mode === 'search') {
            setState(prev => ({ ...prev, mode: 'config' }));
            onNavModeChange?.('config');
        }
    }
    prevBackSignal.current = currentSignal;
}, [backSignal, state.mode, onNavModeChange]);
```

The ONLY exception is when a riff has **truly unique** navigation that no other riff could ever need. This is rare. If you think you need custom navigation, you probably don't.

### The Plugin Architecture Principle

**The @aria/tui package must contain ALL logic it can possibly contain.**

Riffs are **plugins**. They contribute ONLY what is truly unique to that specific riff:

- **Unique business logic** (search algorithms, file processing, etc.)
- **Unique display components** (custom result cards, specialized visualizations)
- **Unique config fields** (riff-specific options)

Everything else lives in the package:

- Layout (AppShell)
- Navigation (ConfigFieldManager handles up/down, FileSelector handles browsing)
- Status display (StatusBar)
- Error handling (ErrorBox)
- Theming (theme system)
- Keyboard handling (platform level)

**If two riffs do something similar, that logic MUST move to the package.**

### The DRY Imperative

**Never repeat yourself. Not ever. If at all possible.**

Before writing ANY code in a riff's TUI:

1. Check if @aria/tui already provides it
2. If not, ask: "Would ANY other riff ever need this?"
3. If yes, add it to @aria/tui, not the riff
4. If truly unique, add it to the riff

Code duplication between riffs is a **bug**. Fix it by extracting to the package.

### Semantic Parity Across CLI, TUI, and Config

**The same concept MUST have the same name everywhere.**

| Config Key        | CLI Flag   | TUI Field Label | Description              |
| ----------------- | ---------- | --------------- | ------------------------ |
| `hybrid`          | `--hybrid` | "Hybrid"        | Enable hybrid search     |
| `alpha`           | `--alpha`  | "Alpha"         | Semantic/lexical balance |
| `inputDirectory`  | `--input`  | "Input"         | Input path               |
| `outputDirectory` | `--output` | "Output"        | Output path              |

Never use different names for the same concept:

- BAD: Config says `inputDir`, CLI says `--source`, TUI says "Input Path"
- GOOD: Config says `input`, CLI says `--input`, TUI says "Input"

This semantic parity ensures:

- Users learn one vocabulary
- Documentation stays consistent
- Refactoring is safe
- Bugs are easier to trace

## Three-Tier Architecture Details

### Tier 1: @aria/tui Package (The Foundation)

Location: `packages/tui/`

**This is where ALL generic TUI logic lives.** The package is the foundation that riffs plug into. If functionality could apply to more than one riff, it belongs here - no exceptions.

The shared package provides:

**Components:**

| Component            | Purpose                                                 |
| -------------------- | ------------------------------------------------------- |
| `AppShell`           | Standard layout wrapper (header, content, footer)       |
| `ConfigFieldManager` | Form fields with status badges and automatic navigation |
| `FileSelector`       | File/directory browser with filtering                   |
| `StatusBar`          | Navigation hints + status message display               |
| `ErrorBox`           | Consistent error message display                        |
| `MenuList`           | Keyboard-navigable menu component                       |

**Navigation System:**

```typescript
// NavMode determines which hints are shown
type NavMode =
    | 'menu'
    | 'config'
    | 'selector'
    | 'search'
    | 'results'
    | 'processing';

// Standard navigation icons (ISO symbols)
const NavIcons = {
    upDown: '↑↓', // List navigation
    enter: '→', // Drill in
    back: '←', // Go out
    select: '↵', // Selection
    escape: '⎋', // Cancel/quit
    tab: '⇥', // Tab key
};
```

**Field Types for ConfigFieldManager:**

| Type        | Behavior on Activation           |
| ----------- | -------------------------------- |
| `boolean`   | Toggles true/false               |
| `select`    | Cycles through options           |
| `string`    | Enters text edit mode            |
| `file`      | Opens FileSelector (files)       |
| `directory` | Opens FileSelector (directories) |

**Status Badges:**

| Badge          | Color  | Meaning                   |
| -------------- | ------ | ------------------------- |
| `[Default]`    | Green  | Value loaded from config  |
| `[Selected]`   | Blue   | User changed from default |
| `[Empty]`      | Orange | No value set              |
| `[Unresolved]` | Red    | Path doesn't exist        |

### Tier 2: Platform TUI

Location: `tui/render.tsx`

The platform is the **single entry point** for interactive use. It:

1. Displays the riff selection menu
2. Loads riff configurations when selected
3. Renders the selected riff's TUI component
4. **OWNS the StatusBar** - riffs do not render their own when embedded
5. Manages `NavMode` and `statusMessage` state

**Key State:**

```typescript
const [navMode, setNavMode] = useState<NavMode>('menu');
const [statusMessage, setStatusMessage] = useState('Select a riff');

// Callbacks passed to riffs
const handleNavModeChange = useCallback((mode: NavMode) => {
    setNavMode(mode);
}, []);

const handleStatusChange = useCallback((status: string) => {
    setStatusMessage(status);
}, []);
```

**Riff Rendering Pattern:**

```tsx
{selectedRiff?.name === 'doc-indexer' && config ? (
    <DocIndexerApp
        config={config}
        logger={logger}
        dbFile={dbFile}
        onExit={handleBackToMenu}        // Return to menu
        onNavModeChange={handleNavModeChange}  // Update platform nav
        onStatusChange={handleStatusChange}    // Update platform status
    />
) : /* ... other riffs ... */}

{/* Platform owns the StatusBar */}
<StatusBar
    message={statusMessage}
    navMode={navMode}
    showQuit={true}
/>
```

### Tier 3: Riff TUIs (Plugins)

Location: `riffs/<riff>/src/tui/render.tsx`

**Riffs are plugins.** They provide ONLY what is unique to that specific riff.

**What a riff TUI DOES contain:**

- Riff-specific config field definitions (but NOT the field rendering - that's ConfigFieldManager)
- Riff-specific result display components (SearchResultCard, etc.)
- Riff-specific business logic callbacks (handleSearch, handleConvert, etc.)
- Riff-specific mode states beyond the standard set

**What a riff TUI does NOT contain:**

- Navigation logic (owned by ConfigFieldManager and platform)
- Status bar rendering (owned by platform)
- Error display logic (use ErrorBox)
- Layout structure (use AppShell)
- Keyboard handling for standard keys (platform handles ESC, arrows, Enter)
- Theme colors (use the `theme` object)
- File/directory browsing (use FileSelector)

Each riff TUI follows this standard pattern:

**Required Props:**

```typescript
export interface AppProps {
    // Riff-specific config and dependencies
    config: RiffConfig;
    logger: Logger;
    dbFile?: string;

    // Platform integration
    onExit?: () => void; // Return to platform menu
    onNavModeChange?: (mode: NavMode) => void; // Notify platform of mode changes
    onStatusChange?: (status: string) => void; // Notify platform of status changes
    backSignal?: number; // Platform signals "go back one level"
}
```

**Standard Implementation:**

```tsx
export function App({
    config,
    logger,
    onExit,
    onNavModeChange,
    onStatusChange,
    backSignal,
}: AppProps) {
    const { exit: inkExit } = useApp();
    const exit = onExit ?? inkExit;

    // Check if embedded in platform (vs standalone)
    const isEmbedded = !!onExit;

    // Track previous backSignal to detect changes
    const prevBackSignal = useRef(backSignal ?? 0);

    const [state, setState] = useState({ mode: 'config' /* ... */ });

    // Handle platform back signal - go back one level when platform requests
    useEffect(() => {
        const currentSignal = backSignal ?? 0;
        if (currentSignal > prevBackSignal.current) {
            if (state.mode === 'results' || state.mode === 'search') {
                setState((prev) => ({ ...prev, mode: 'config' }));
                onNavModeChange?.('config');
                onStatusChange?.('Ready');
            }
        }
        prevBackSignal.current = currentSignal;
    }, [backSignal, state.mode, onNavModeChange, onStatusChange]);

    // Define config fields
    const initialFields: ConfigFieldDefinition[] = useMemo(
        () => [
            {
                key: 'hybrid',
                label: 'Hybrid',
                type: 'boolean',
                defaultValue: true,
            },
            {
                key: 'alpha',
                label: 'Alpha',
                type: 'select',
                defaultValue: '0.5',
                options: [
                    '0.1',
                    '0.2',
                    '0.3',
                    '0.4',
                    '0.5',
                    '0.6',
                    '0.7',
                    '0.8',
                    '0.9',
                ],
            },
        ],
        [config],
    );

    const { fields, setValue, getValues } = useConfigFields({ initialFields });

    // Riff-specific actions (platform owns ESC/Q)
    useInput(
        (input) => {
            if (input.toLowerCase() === 's') {
                setState((prev) => ({ ...prev, mode: 'search' }));
                onNavModeChange?.('search');
            }
        },
        { isActive: state.mode !== 'search' },
    );

    // Notify platform of state changes
    const handleSearch = async () => {
        onNavModeChange?.('processing');
        onStatusChange?.('Searching...');

        // ... do work ...

        onNavModeChange?.('results');
        onStatusChange?.(`Found ${results.length} results`);
    };

    return (
        <AppShell
            title="riff-name"
            subtitle="Description"
            statusMessage={statusMessage}
            isProcessing={isProcessing}
            error={error}
            isEmbedded={isEmbedded}
            navMode={state.mode as NavMode} // DYNAMIC - not hardcoded
        >
            <ConfigFieldManager
                fields={fields}
                onChange={(key, value) => setValue(key, value)}
                active={mode === 'config'}
                title="Configuration"
            />

            {/* Action buttons - riffs only show their own shortcuts, not Q */}
            <Box gap={2}>
                <Text color={theme.text.link} bold>
                    [S]
                </Text>
                <Text>Search</Text>
            </Box>
        </AppShell>
    );
}
```

## CLI vs TUI Distinction

### CLI Pattern (`cli.ts`)

- Uses Commander.js for argument parsing
- Pino logger with `verbose: true` (console output)
- Non-interactive, runs and exits
- For scripting, automation, CI/CD

```typescript
const logger = createLogger({
    level: 'info',
    verbose: true, // CLI outputs to console
});
```

### TUI Pattern (`tui/render.tsx`)

- Uses Ink (React for terminals)
- Pino logger with `verbose: false` (file only)
- Interactive, keyboard-driven
- For human operators

```typescript
const logger = createLogger({
    level: 'info',
    verbose: false, // TUI: Ink handles display, logs go to file
});
```

## Directory Structure

```text
aria/
├── packages/
│   └── tui/                          # @aria/tui package
│       └── src/
│           ├── index.ts              # Package exports
│           ├── components/           # UI components
│           │   ├── app-shell.tsx
│           │   ├── config-field-manager.tsx
│           │   ├── file-selector.tsx
│           │   ├── status-bar.tsx
│           │   └── error-box.tsx
│           ├── navigation/           # Nav system
│           │   └── index.ts
│           ├── themes/               # Theming system
│           └── hooks/                # Shared hooks
│
├── tui/                              # Platform TUI
│   ├── render.bun                    # Main platform renderer
│   └── components/
│       └── riff-menu.bun             # Riff selection menu
│
└── riffs/
    └── <riff-name>/
        └── src/
            ├── cli.ts                # CLI entry point
            ├── tui.ts                # TUI entry point (thin wrapper)
            ├── core/                 # Business logic
            ├── lib/                  # Config, logger, types
            └── tui/
                └── render.bun        # Riff TUI component
```

## Riffs Currently Implementing the Pattern

| Riff           | Status   | Notes                                 |
| -------------- | -------- | ------------------------------------- |
| doc-converter  | Complete | Full pattern with FileSelector        |
| doc-decomposer | Complete | Full pattern with FileSelector        |
| doc-indexer    | Complete | Search with configurable hybrid/alpha |
| hr-staffer     | Complete | Hybrid search config                  |
| hr-policy      | Complete | Policy document search                |

## Remaining Work

**IMPORTANT:** While the TUI architecture is in place, many riffs still need:

### Configurable Items to Add

Most riffs have config options in their `lib/config.ts` that are not yet exposed in the TUI:

- **doc-indexer**: Result count limits, section filtering, metadata display options
- **hr-staffer**: CSV path selection, output format options, export functionality
- **hr-policy**: Index rebuild options, snippet length config
- **doc-converter**: Individual AR rule toggling, pandoc options
- **doc-decomposer**: Category filtering, export format selection

### Riff Execution Functions to Implement

The TUIs currently show config and search, but many core operations are not yet accessible:

- **Indexing operations**: Rebuild index, clear index, incremental updates
- **Export functions**: Export results to file, generate reports
- **Batch operations**: Process multiple files, directory scanning
- **Database management**: View stats, optimize, backup

### Riffs Without TUI Yet

The following riffs only have CLI interfaces:

- image-alttext
- image-metadata
- image-renamer
- image-sanitiser
- image-ocr
- image-transcoder
- image-generator
- code-auditor
- commit-formatter
- prompt-tracer
- dir-differ
- sharepoint-manager
- mindmap-converter
- graph-studio
- vector-indexer

## Implementation Checklist

When adding or updating a TUI for a riff:

1. **Use AppShell as root component**
    - Set `isEmbedded={!!onExit}` to detect platform embedding
    - AppShell handles its own StatusBar when standalone
    - Set `navMode={state.mode as NavMode}` - NEVER hardcode

2. **Define fields with ConfigFieldManager**
    - Use `useConfigFields` hook for state management
    - Map config options to appropriate field types

3. **Accept platform callbacks**
    - `onExit?: () => void`
    - `onNavModeChange?: (mode: NavMode) => void`
    - `onStatusChange?: (status: string) => void`
    - `backSignal?: number` - Platform's "go back" signal

4. **Handle backSignal for layered navigation**
    - Track previous value with `useRef`
    - In `useEffect`, detect signal changes
    - Transition from deeper modes (results/search) back to config
    - Notify platform of mode change

5. **Notify platform of state changes**
    - Call `onNavModeChange` when entering selector, search, results, processing
    - Call `onStatusChange` with meaningful messages

6. **Do NOT handle ESC or Q**
    - Platform handles ALL navigation keys
    - Riffs only add riff-specific shortcuts (S, R, D, etc.)
    - Show action hints in results mode for available shortcuts
    - IMPORTANT: Never use 'C' as a shortkey - too close to Ctrl+C

7. **Update platform to render riff**
    - Add import in `tui/render.tsx`
    - Add config loading in useEffect
    - Add riff to render conditions
    - Pass all callbacks including `backSignal`

8. **Provide standalone entry point**
    - `tui.ts` thin wrapper for direct execution
    - Include `renderApp()` export

## Anti-Patterns to Avoid

### Navigation Anti-Patterns (CRITICAL)

- **Custom up/down handling**: ConfigFieldManager owns this. Always.
- **Custom ESC handling**: Platform owns this. NEVER handle ESC in riffs.
- **Custom Q handling**: Platform owns this. NEVER handle Q in riffs.
- **Custom Enter handling**: ConfigFieldManager owns field activation.
- **Any useInput for navigation**: If it's navigation, it's wrong. Platform handles it.
- **Disabling platform keyboard handling**: Platform ALWAYS handles ESC/Q, even when a riff is active.
- **Hardcoded navMode**: Always use `navMode={state.mode as NavMode}`, never `navMode="config"`.
- **Using 'C' as a shortkey**: Too close to Ctrl+C. Use 'R' for run/execute actions instead.

### Architecture Anti-Patterns

- **Custom StatusBar in embedded riffs**: Platform owns it.
- **Duplicated logic between riffs**: Extract to @aria/tui immediately.
- **Riff-specific theme colors**: Use `theme` object from package.
- **Custom error display**: Use ErrorBox component.
- **Custom file browsing**: Use FileSelector component.

### UI Layout Anti-Patterns

- **File paths in subtitle**: Subtitles describe the riff's purpose, NOT runtime data like file paths or database names. Use static descriptive text like "Document Search" or "RFP Decomposition".
- **Dynamic content in title/subtitle**: Titles and subtitles are for identification, not status. Use `statusMessage` for dynamic information.
- **Long text without truncation**: Any path or long string MUST truncate with trailing ellipsis to prevent horizontal overflow. ConfigFieldManager handles this automatically for file/directory fields, calculating available width dynamically based on terminal size.

### Semantic Anti-Patterns

- **Different names for same concept**: Config, CLI, and TUI must use identical terminology.
- **Inconsistent field keys**: If config says `hybrid`, TUI field key must be `hybrid`.
- **Abbreviated vs full names**: Pick one and use it everywhere.

### Code Quality Anti-Patterns

- **console.log for output**: Use Pino logger.
- **Direct exit() calls**: Use `onExit` callback when embedded.
- **Blocking the event loop**: Use async/await, show processing state.
- **Hardcoded strings**: Use config values.

### The Ultimate Test

Before committing any riff TUI code, ask:

1. "Does @aria/tui already provide this?" - If yes, use it.
2. "Could another riff ever need this?" - If yes, add it to @aria/tui first.
3. "Is this truly unique to this one riff?" - Only then add it to the riff.

If you find yourself copying code from one riff to another, **STOP**. Extract it to the package.
