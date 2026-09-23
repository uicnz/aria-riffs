# Plan: Enhance doc-indexer CLI Output with Better Markdown Rendering and Syntax Highlighting

## Research Summary

After extensive research into how modern CLI riffs handle markdown rendering and syntax highlighting, I've identified the best libraries and approaches for enhancing doc-indexer's terminal output.

### Current State

doc-indexer already uses:

- **chalk** (v5.5.0) - for text coloring and styling
- **boxen** (v8.0.1) - for drawing boxes around content
- **wrap-ansi** (v9.0.0) - for text wrapping

### Key Findings from Research

1. **Ink Library**: React-based CLI framework used by Anthropic coding CLI. While powerful, it requires rewriting the entire CLI in React components - too heavy for our needs.

2. **marked-terminal**: The most popular markdown-to-terminal renderer (v7.3.0)
    - Supports syntax highlighting via cli-highlight
    - Renders tables using cli-table3
    - Direct replacement for console.log with formatted markdown
    - Used by many major CLI riffs

3. **cli-highlight**: Syntax highlighting specifically for terminals (v2.1.11)
    - Supports all highlight.js languages
    - Works seamlessly with marked-terminal
    - Provides custom theme support

4. **cli-table3**: Best table rendering library for terminals
    - Cell spanning, custom styles, word wrapping
    - Already integrated with marked-terminal
    - Much better than basic markdown table rendering

## Proposed Implementation

### Phase 1: Add Core Libraries

Install these npm packages:

```sh
bun install marked marked-terminal cli-highlight cli-table3
bun install --save-dev @types/marked
```

### Phase 2: Create Enhanced Terminal Renderer

1. Create new file: `riffs/doc-indexer/src/cli/markdown-renderer.ts`
    - Import and configure marked with marked-terminal
    - Set up cli-highlight for code blocks
    - Configure table rendering options

2. Update `terminal-renderer.ts` to use the new markdown renderer for:
    - Search result descriptions
    - Request/response content
    - Metadata display
    - Code snippets in documents

### Phase 3: Enhance Specific Features

1. **Search Results**:
    - Properly render markdown in document content
    - Syntax highlight code blocks within results
    - Better table formatting for metadata

2. **Knowledge Graph Output**:
    - Format graph statistics as proper tables
    - Syntax highlight JSON exports

3. **Document Display**:
    - Full markdown rendering with headers, lists, code blocks
    - Preserve formatting from original documents
    - Better handling of nested content

### Phase 4: Add Configuration Options

Add flags to control formatting:

- `--plain` - Disable all formatting (for piping)
- `--no-color` - Disable colors but keep structure
- `--compact` - Reduce spacing and padding
- `--theme <name>` - Choose color theme

## Benefits

1. **Better Readability**: Proper markdown rendering makes output much easier to read
2. **Syntax Highlighting**: Code blocks will be highlighted based on language
3. **Professional Tables**: Structured data displayed in well-formatted tables
4. **Consistency**: Same markdown content looks good in terminal and documentation
5. **Accessibility**: Better support for screen readers with structured output

## Implementation Priority

1. **High Priority**:
    - marked-terminal for basic markdown rendering
    - cli-table3 for search result metadata

2. **Medium Priority**:
    - cli-highlight for code syntax highlighting
    - Custom themes

3. **Low Priority**:
    - Configuration flags
    - Export formats

## Next Steps

1. Install the required npm packages
2. Create the markdown-renderer.ts module
3. Update terminal-renderer.ts to use the new renderer
4. Test with various search queries and document types
5. Add configuration options
6. Update documentation

## Technical Details

### marked-terminal Configuration

```typescript
import { marked } from 'marked';
import TerminalRenderer from 'marked-terminal';

marked.setOptions({
    renderer: new TerminalRenderer({
        // Colors
        code: 'yellow',
        blockquote: 'gray',
        html: 'gray',
        heading: 'green.bold',
        table: 'cyan',

        // Formatting
        firstHeading: 'bold.underline',
        showSectionPrefix: false,
        reflowText: true,
        width: 80,

        // Table options for cli-table3
        tableOptions: {
            style: {
                head: ['cyan'],
                border: ['gray'],
            },
        },
    }),
});
```

### cli-highlight Integration

```typescript
import { highlight } from 'cli-highlight';

// For code blocks
const highlightCode = (code: string, language: string) => {
    return highlight(code, {
        language,
        ignoreIllegals: true,
        theme: customTheme, // Optional custom theme
    });
};
```

### Example Output Comparison

#### Current Output

```md
Request

> [!IMPORTANT]
>
> - Priority: Must Fully Comply
> - BR48

Where possible the service must provide redundancy...
```

#### Enhanced Output

```txt
╔════════════════════════════════════════╗
║ Request                                ║
╠════════════════════════════════════════╣
║ IMPORTANT                              ║
║ • Priority: Must Fully Comply          ║
║ • BR48                                 ║
╚════════════════════════════════════════╝

Where possible the service must provide redundancy...
```

## Alternatives Considered

1. **Ink (React for CLI)**: Too heavy, requires complete rewrite
2. **Blessed/Terminal-kit**: Full TUI frameworks, overkill for our needs
3. **Custom Solution**: Time-consuming, reinventing the wheel
4. **No Changes**: Current output is functional but not optimal for readability

## Conclusion

This approach provides professional terminal output similar to what users expect from modern CLI riffs like Anthropic coding CLI and GitHub CLI, while being much simpler to implement than a full React-based solution. The marked-terminal + cli-highlight combination is battle-tested and widely used in the Node.js ecosystem.
