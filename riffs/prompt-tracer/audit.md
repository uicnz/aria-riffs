# Prompt Tracer - Technical Debt Audit

## File Size Violations

Project standard: 200-300 lines max per file

**Over limit:**

These will be refactored anyway when we add codecs and Gemini CLIs.

- `src/cli.ts`: 438 lines (46% over target)
- `src/interceptor.ts`: 527 lines (76% over target)

## Recommended Refactoring

### cli.ts Breakdown

Current 438 lines could be split into:

- `src/cli.ts`: Commander setup, main entry point (~150 lines)
- `src/core/claude-runner.ts`: runClaudeWithInterception function (~100 lines)
- `src/core/version-processor.ts`: processVersion function (~150 lines)
- `src/core/system-finder.ts`: findSystemClaude function (~40 lines)

### interceptor.ts Breakdown

Current 527 lines could be split into:

- `src/interceptor.ts`: Main ClaudeTrafficLogger class (~200 lines)
- `src/interceptor/fetch-handler.ts`: instrumentFetch logic (~150 lines)
- `src/interceptor/http-handler.ts`: instrumentNodeHTTP logic (~150 lines)
- `src/interceptor/request-parser.ts`: Request/response parsing utilities (~50 lines)

## Notes

These refactorings are non-blocking for initial integration. The riff is functional and follows all other project standards. File size violations should be addressed in a future refactoring pass.

## Status

- Integration: Complete
- Standards compliance: 95%
- Outstanding: File size refactoring only
