# Aria Integration Checklist

Quick integration steps to move prompt-tracer into the Aria monorepo.

## Prerequisites

- Aria monorepo cloned and ready
- All prompt-tracer tests passing (114 tests)
- Code formatted and linted with Biome

## Integration Steps

### 1. Move Source Code

```bash
# From Aria monorepo root
cp -r /path/to/prompt-tracer/src riffs/prompt-tracer/src
cp -r /path/to/prompt-tracer/test riffs/prompt-tracer/test
cp /path/to/prompt-tracer/tsconfig.json riffs/prompt-tracer/
cp /path/to/prompt-tracer/vitest.config.ts riffs/prompt-tracer/
cp /path/to/prompt-tracer/README.md riffs/prompt-tracer/
```

### 2. Verify the Riff Dependency Contract

The Riff declares its complete runtime dependency set in `riffs/prompt-tracer/package.json`; versions must be current and aligned with shared dependencies in other Riffs:

```json
{
    "commander": "^15.0.0",
    "dotenv": "^18.0.0",
    "js-yaml": "^5.4.2",
    "pino": "^10.3.1",
    "shell-quote": "^1.10.0",
    "zod": "^4.6.5"
}
```

### 3. Add Scripts to Root package.json

Add to root `package.json` scripts:

```json
{
    "scripts": {
        "prompt-tracer:start": "bun riffs/prompt-tracer/src/cli.ts",
        "prompt-tracer:test": "vitest run --project prompt-tracer",
        "prompt-tracer:typecheck": "tsc --noEmit -p riffs/prompt-tracer/tsconfig.json"
    }
}
```

### 4. Create Configuration File

Create `config/config-prompt-tracer.yaml`:

```yaml
# Logging settings
logging:
    level: 'INFO'
    verbose: false
    file: 'prompt-tracer.log'
    max_file_size_mb: 10
    max_files: 7
```

### 5. Update Vitest Configuration

Add to root `vitest.config.ts`:

```typescript
export default defineConfig({
    projects: [
        // ... existing projects
        {
            test: {
                name: 'prompt-tracer',
                include: ['riffs/prompt-tracer/test/**/*.test.ts'],
            },
        },
    ],
});
```

### 6. Verify Integration

```bash
# Run from Aria monorepo root
bun install
bun run prompt-tracer:test
bun run prompt-tracer:typecheck
bun riffs/prompt-tracer/src/cli.ts --help
```

## Post-Integration

- Update root README to include prompt-tracer
- Add prompt-tracer to typecheck command
- Test from monorepo root directory
- Verify all 114 tests pass in monorepo context

## Notes

- No code changes required - source is ready as-is
- Import paths should work without modification
- Pino logging already matches Aria standards
- CLI structure compatible with monorepo pattern
