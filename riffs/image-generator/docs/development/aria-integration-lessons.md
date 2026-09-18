# Aria Integration Lessons Learned

## Overview

This document captures key lessons learned during the integration of the image-generator riff from a standalone repository into the Aria monorepo. These insights are valuable for future riff integrations and highlight common pitfalls to avoid.

## Critical Issue: Dependency API Changes

### The Problem

During integration, a TypeScript error surfaced in `chat-session.ts:192`:

```typescript
// Original code (worked in standalone)
const result = await this.chat.sendMessage({ message: parts });
const response = result.response;  // ERROR: Property 'response' does not exist

// Fixed code (works in Aria)
const result = await this.chat.sendMessage({ message: parts });
// result IS already the GenerateContentResponse
for (const part of result.candidates?.[0]?.content?.parts || []) {
```

### Why It Only Appeared in Aria

The standalone riff was using a **cached or pinned version** of `@google/genai` that had the old API structure. When integrated into Aria:

1. **Fresh installation** - `bun install` fetched the latest `@google/genai 1.30.0` from npm
2. **API had changed** - The library no longer wrapped responses in a `.response` property
3. **Strict typecheck** - Aria's quality checks caught the incompatibility immediately

### Why Standalone Didn't Catch It

The standalone environment had several factors that masked the issue:

1. **Stale dependencies** - `bun.lockb` pinned to an older working version
2. **No pre-commit typecheck** - TypeScript validation wasn't enforced
3. **Development workflow** - Running with `tsx` directly can be more lenient
4. **Cached node_modules** - Never reinstalled dependencies from scratch

## Best Practices for Future Integrations

### 1. Always Run Fresh Install

```bash
# Before integration, test with fresh dependencies
rm -rf node_modules bun.lockb
bun install
bun run typecheck
bun run test
```

### 2. Verify TypeScript Strictness

Ensure the standalone riff has strict TypeScript configuration:

```json
{
    "compilerOptions": {
        "strict": true,
        "noEmit": true
    }
}
```

### 3. Run Complete Quality Checks

Before claiming a riff is "ready to integrate", run:

```bash
bun run typecheck    # Type validation
bun run test         # Test suite
bun run lint         # Code quality
bun run format:check # Formatting
```

### 4. Check Dependency Versions

Compare dependency versions between standalone and target monorepo:

```bash
# In standalone riff
npm list @google/genai

# In Aria monorepo
bun pm ls @google/genai
```

If versions differ, test with the **monorepo's version** before integration.

### 5. Understand Semantic Versioning Risks

Even within the same major version (e.g., `^1.30.0`), libraries can:

- Change internal APIs
- Deprecate methods
- Restructure response objects

Always test against the **exact version** that will be installed in the monorepo.

## Monorepo Integration Checklist

Before declaring a riff "integration-ready":

- [ ] Delete `node_modules` and lock files, reinstall fresh
- [ ] Run `bun run typecheck` with strict mode
- [ ] Run full test suite with coverage
- [ ] Verify all dependencies exist in target monorepo (or can be added)
- [ ] Check for version conflicts with monorepo dependencies
- [ ] Test with monorepo's exact dependency versions
- [ ] Run code quality checks (lint, format)
- [ ] Verify all relative paths work from monorepo root
- [ ] Test configuration loading from monorepo root
- [ ] Ensure .aria/logs/outputs go to correct shared directories

## Other Integration Issues Encountered

### Configuration Paths

**Issue**: Standalone riff used relative paths (`.aria/logs/`, `outputs/`)

**Solution**: Updated to use monorepo-standard paths:

- Logs: `.aria/logs/` (root)
- Outputs: `.aria/exports/image-generator/` (root)
- Config: `config/config-image-generator.yaml` (root)

### Test Fixtures

**Issue**: Tests referenced fixtures at `test/fixtures/config/`

**Solution**: Updated paths to `riffs/image-generator/test/fixtures/config/` for co-located tests

### Code Style

**Issue**: Standalone used double quotes, Aria uses single quotes

**Solution**: Ran `bun run check:write` to auto-fix all formatting

## Key Takeaway

**Integration into a monorepo is a forcing function for quality.** It surfaces issues that can hide in standalone environments:

- Dependency staleness
- API incompatibilities
- Configuration assumptions
- Path resolution bugs
- Code style inconsistencies

These issues are **good to find early** rather than discovering them in production. The stricter environment makes riffs more robust and maintainable.

## Future Improvements

### For Standalone Riff Development

1. **Add pre-commit hooks** - Enforce typecheck before commits
2. **Automate fresh installs** - CI/CD should test with clean dependencies
3. **Pin exact versions** - Use exact versions (not `^`) for critical dependencies
4. **Document API assumptions** - Note which library versions are tested

### For Aria Monorepo

1. **Integration testing guide** - Standardized process for onboarding riffs
2. **Dependency conflict detection** - Automated checks for version mismatches
3. **Shared test utilities** - Common patterns for path resolution, config loading
4. **Integration checklist riff** - CLI riff to validate integration readiness

## Conclusion

The `result.response` issue was a **valuable discovery**. It demonstrated that:

1. Standalone development can mask dependency issues
2. Fresh dependency resolution is critical for integration
3. Strict quality checks catch problems early
4. Monorepo integration improves riff robustness

By documenting these lessons, future riff integrations will be smoother and more predictable.
