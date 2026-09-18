# Multi-Provider Plan

Implementation plan to add Google Gemini and OpenAI Codex support with full feature parity to existing Anthropic Anthropic coding CLI functionality.

## Goal

Replicate the complete prompt-tracer functionality for three providers:

- Anthropic Anthropic coding CLI (currently working)
- Google Gemini (to be added)
- OpenAI Codex (to be added)

**Full feature parity means:**

- Complete raw JSONL trace capture
- Formatted Markdown output files
- System prompt extraction
- Riff definitions extraction
- User message extraction
- Request filtering and selection
- Version management via npm
- System binary detection

## Provider Package Information

**Anthropic:**

- Package: `@anthropic-ai/claude-code`
- Binary: `claude`
- API: `api.anthropic.com`

**Google:**

- Package: `@google/gemini-cli`
- Binary: `gemini`
- API: `generativelanguage.googleapis.com`

**OpenAI:**

- Package: `@openai/codex`
- Binary: `codex`
- API: `api.openai.com`

## API Format Differences

Each provider uses different request/response formats that require provider-specific extraction logic.

### Anthropic Messages API

```json
{
  "model": "claude-3-5-sonnet-20241022",
  "system": [
    {"type": "text", "text": "You are a helpful assistant..."}
  ],
  "messages": [
    {"role": "user", "content": "Hello"}
  ],
  "riffs": [
    {
      "name": "get_weather",
      "description": "Get weather info",
      "input_schema": {"type": "object", "properties": {...}}
    }
  ]
}
```

**Key characteristics:**

- System prompt in separate `system` array of typed blocks
- Riffs use `input_schema` field
- Cache control support

### OpenAI Chat Completions API

```json
{
  "model": "gpt-4o",
  "messages": [
    {"role": "system", "content": "You are a helpful assistant..."},
    {"role": "user", "content": "Hello"}
  ],
  "riffs": [
    {
      "type": "function",
      "function": {
        "name": "get_weather",
        "description": "Get weather info",
        "parameters": {"type": "object", "properties": {...}}
      }
    }
  ]
}
```

**Key characteristics:**

- System prompt is a message with `role: "system"` in messages array
- Riffs nested under `function` with `parameters` instead of `input_schema`
- Different riff structure

### Google Gemini API

```json
{
  "model": "gemini-pro",
  "system_instruction": {
    "parts": [{"text": "You are a helpful assistant..."}]
  },
  "contents": [
    {"role": "user", "parts": [{"text": "Hello"}]}
  ],
  "riffs": [
    {
      "function_declarations": [
        {
          "name": "get_weather",
          "description": "Get weather info",
          "parameters": {"type": "object", "properties": {...}}
        }
      ]
    }
  ]
}
```

**Key characteristics:**

- System instruction in `system_instruction.parts` array
- Messages called `contents` with `parts` structure
- Riffs nested under `function_declarations`

## Implementation Plan

### Phase 1: Provider Abstraction Layer

#### 1.1 Create Provider Configuration

Create `src/providers/provider-config.ts`:

```typescript
export interface ProviderConfig {
    provider: string;
    displayName: string;
    npmPackage: string;
    cliName: string;
    apiEndpoints: string[];
    apiPaths?: string[];
    testPrompt: string;
}

export const PROVIDERS: Record<string, ProviderConfig> = {
    anthropic: {
        provider: 'anthropic',
        displayName: 'Anthropic Anthropic coding CLI',
        npmPackage: '@anthropic-ai/claude-code',
        cliName: 'claude',
        apiEndpoints: ['api.anthropic.com', 'bedrock-runtime.amazonaws.com'],
        apiPaths: ['/v1/messages'],
        testPrompt: 'Write a haiku about {timestamp}',
    },
    google: {
        provider: 'google',
        displayName: 'Google Gemini',
        npmPackage: '@google/gemini-cli',
        cliName: 'gemini',
        apiEndpoints: ['generativelanguage.googleapis.com'],
        apiPaths: ['/v1beta/models', '/v1/models'],
        testPrompt: 'Generate a brief response about {timestamp}',
    },
    openai: {
        provider: 'openai',
        displayName: 'OpenAI Codex',
        npmPackage: '@openai/codex',
        cliName: 'codex',
        apiEndpoints: ['api.openai.com'],
        apiPaths: ['/v1/chat/completions'],
        testPrompt: 'Write a short message about {timestamp}',
    },
};
```

#### 1.2 Create Provider Extractor Interface

Create `src/providers/extractor-interface.ts`:

```typescript
import type { Riff } from '../types/request';

export interface NormalizedRiff {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
}

export interface ExtractedData {
    systemPrompt: string;
    userMessage: string;
    riffs: NormalizedRiff[];
}

export interface ProviderExtractor {
    extractSystemPrompt(requestBody: unknown): string;
    extractUserMessage(messages: unknown): string;
    extractRiffs(requestBody: unknown): NormalizedRiff[];
    selectBestRequest(pairs: RawPair[]): RawPair;
    filterRequests(pairs: RawPair[]): RawPair[];
}
```

#### 1.3 Create Anthropic Extractor

Create `src/providers/anthropic-extractor.ts`:

Move existing logic from `src/core/content-extractor.ts` and `src/core/request-filter.ts`:

```typescript
export class AnthropicExtractor implements ProviderExtractor {
    extractSystemPrompt(requestBody: unknown): string {
        // Current extractSystemPrompt logic
    }

    extractUserMessage(messages: unknown): string {
        // Current findAndExtractUserMessage logic
    }

    extractRiffs(requestBody: unknown): NormalizedRiff[] {
        // Current filterAndSortRiffs logic
    }

    selectBestRequest(pairs: RawPair[]): RawPair {
        // Current selectBestRequest logic
    }

    filterRequests(pairs: RawPair[]): RawPair[] {
        // Current filterNonHaikuRequests logic
    }
}
```

#### 1.4 Create OpenAI Extractor

Create `src/providers/openai-extractor.ts`:

```typescript
export class OpenAIExtractor implements ProviderExtractor {
    extractSystemPrompt(requestBody: unknown): string {
        const body = requestBody as OpenAIRequestBody;
        const systemMsg = body.messages?.find((m) => m.role === 'system');
        return systemMsg?.content || '';
    }

    extractUserMessage(messages: unknown): string {
        const msgs = messages as OpenAIMessage[];
        const userMsg = msgs.find((m) => m.role === 'user');
        return userMsg?.content || '';
    }

    extractRiffs(requestBody: unknown): NormalizedRiff[] {
        const body = requestBody as OpenAIRequestBody;
        if (!body.riffs) return [];

        return body.riffs.map((riff) => ({
            name: riff.function.name,
            description: riff.function.description,
            parameters: riff.function.parameters,
        }));
    }

    selectBestRequest(pairs: RawPair[]): RawPair {
        // OpenAI-specific: prefer requests with riffs and system messages
        const withRiffs = pairs.filter((p) => {
            const body = p.request.body as OpenAIRequestBody;
            return body.riffs && body.riffs.length > 0;
        });

        if (withRiffs.length > 0) {
            return withRiffs[0];
        }
        return pairs[0];
    }

    filterRequests(pairs: RawPair[]): RawPair[] {
        // Filter out simple model requests, prefer chat completions
        return pairs.filter((p) => {
            const body = p.request.body as OpenAIRequestBody;
            return body.messages && body.messages.length > 1;
        });
    }
}
```

#### 1.5 Create Gemini Extractor

Create `src/providers/gemini-extractor.ts`:

```typescript
export class GeminiExtractor implements ProviderExtractor {
    extractSystemPrompt(requestBody: unknown): string {
        const body = requestBody as GeminiRequestBody;
        if (!body.system_instruction?.parts) return '';

        return body.system_instruction.parts
            .filter((p) => p.text)
            .map((p) => p.text)
            .join('\n');
    }

    extractUserMessage(messages: unknown): string {
        const contents = messages as GeminiContent[];
        const userContent = contents.find((c) => c.role === 'user');
        if (!userContent?.parts) return '';

        return userContent.parts
            .filter((p) => p.text)
            .map((p) => p.text)
            .join('\n');
    }

    extractRiffs(requestBody: unknown): NormalizedRiff[] {
        const body = requestBody as GeminiRequestBody;
        if (!body.riffs?.[0]?.function_declarations) return [];

        return body.riffs[0].function_declarations.map((fn) => ({
            name: fn.name,
            description: fn.description,
            parameters: fn.parameters,
        }));
    }

    selectBestRequest(pairs: RawPair[]): RawPair {
        // Gemini-specific: prefer requests with riffs and system_instruction
        const withRiffs = pairs.filter((p) => {
            const body = p.request.body as GeminiRequestBody;
            return body.riffs && body.riffs.length > 0;
        });

        if (withRiffs.length > 0) {
            return withRiffs[0];
        }
        return pairs[0];
    }

    filterRequests(pairs: RawPair[]): RawPair[] {
        // Filter for meaningful requests
        return pairs.filter((p) => {
            const body = p.request.body as GeminiRequestBody;
            return body.contents && body.contents.length > 0;
        });
    }
}
```

#### 1.6 Create Provider Factory

Create `src/providers/provider-factory.ts`:

```typescript
import { AnthropicExtractor } from './anthropic-extractor';
import { OpenAIExtractor } from './openai-extractor';
import { GeminiExtractor } from './gemini-extractor';

export function getExtractor(providerName: string): ProviderExtractor {
    switch (providerName) {
        case 'anthropic':
            return new AnthropicExtractor();
        case 'google':
            return new GeminiExtractor();
        case 'openai':
            return new OpenAIExtractor();
        default:
            throw new Error(`Unknown provider: ${providerName}`);
    }
}
```

### Phase 2: Update Type Definitions

Create provider-specific type files:

**src/types/anthropic-types.ts** - Move current request.ts types here
**src/types/openai-types.ts** - Define OpenAI API types
**src/types/gemini-types.ts** - Define Gemini API types

### Phase 3: Update Services

#### 3.1 Update npm-service.ts

Replace hardcoded `@anthropic-ai/claude-code` with parameters:

```typescript
export function getLatestVersion(packageName: string): string;
export function getAllVersionsBetween(
    packageName: string,
    start: string,
    end: string,
): string[];
export function downloadPackage(
    packageName: string,
    version: string,
    targetDir: string,
): void;
export function getVersionReleaseDate(
    packageName: string,
    version: string,
): string;
```

#### 3.2 Update interceptor.ts

Generalize API detection:

```typescript
export interface InterceptorConfig {
    logDirectory?: string;
    logBaseName?: string;
    provider: ProviderConfig;
}

private isTargetAPI(url: string | URL): boolean {
    const urlString = typeof url === "string" ? url : url.toString();

    for (const endpoint of this.config.provider.apiEndpoints) {
        if (urlString.includes(endpoint)) {
            if (this.config.provider.apiPaths) {
                return this.config.provider.apiPaths.some(path => urlString.includes(path));
            }
            return true;
        }
    }
    return false;
}
```

### Phase 4: Update CLI

#### 4.1 Add Provider Selection

```typescript
interface CliOptions {
    latest?: boolean;
    binaryPath?: string;
    providerArgs?: string;
    verbose?: boolean;
    provider?: string;
}

program
    .option(
        '--provider <name>',
        'Provider: anthropic, google, openai (default: anthropic)',
    )
    .option(
        '--provider-args <args>',
        'Pass additional arguments to provider CLI',
    );
```

#### 4.2 Update Main Function

```typescript
async function main(version: string | undefined, options: CliOptions): Promise<void> {
    const providerName = options.provider || "anthropic";
    const provider = PROVIDERS[providerName];
    const extractor = getExtractor(providerName);

    // Pass provider and extractor through entire pipeline
    await processVersion(version, provider, extractor, originalCwd, ...);
}
```

#### 4.3 Update processVersion

```typescript
async function processVersion(
    versionOrLabel: string,
    provider: ProviderConfig,
    extractor: ProviderExtractor,
    originalCwd: string,
    customBinaryPath?: string,
    providerArgs?: string,
): Promise<void> {
    // Use provider-specific package name
    if (!customBinaryPath) {
        downloadPackage(provider.npmPackage, versionOrLabel, packageDir);
    }

    // Use provider-specific test prompt
    const testPrompt = provider.testPrompt.replace(
        '{timestamp}',
        new Date().toISOString(),
    );

    // Run with interception
    const logFile = await runWithInterception(
        cliPath,
        logBaseName,
        provider,
        providerArgs,
    );

    // Extract using provider-specific extractor
    await extractPromptsFromLog(
        logFile,
        outputPath,
        versionOrLabel,
        provider,
        extractor,
        customBinaryPath,
    );
}
```

#### 4.4 Update extractPromptsFromLog

```typescript
async function extractPromptsFromLog(
    logFile: string,
    outputPath: string,
    versionOrLabel: string,
    provider: ProviderConfig,
    extractor: ProviderExtractor,
    customBinaryPath?: string,
): Promise<void> {
    const pairs: RawPair[] = parseJsonl(logContent);

    // Use provider-specific extractor
    const filtered = extractor.filterRequests(pairs);
    const bestRequest = extractor.selectBestRequest(filtered);

    const systemPrompt = extractor.extractSystemPrompt(
        bestRequest.request.body,
    );
    const userMessage = extractor.extractUserMessage(
        bestRequest.request.body.messages,
    );
    const riffs = extractor.extractRiffs(bestRequest.request.body);

    const output = formatOutput({
        provider: provider.displayName,
        versionLabel,
        releaseDate,
        userMessage,
        systemPrompt,
        riffs,
    });

    writeFile(outputPath, output);
}
```

### Phase 5: Update Binary Detection

Generalize `findSystemClaude()`:

```typescript
function findSystemBinary(binaryName: string): string | null {
    try {
        let binaryPath = execSync(`which ${binaryName}`, {
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
        }).trim();

        if (!binaryPath) return null;

        // Handle shell aliases
        const aliasMatch = binaryPath.match(/:\s*aliased to\s+(.+)$/);
        if (aliasMatch?.[1]) {
            binaryPath = aliasMatch[1];
        }

        // Resolve symlinks and bash wrappers (same logic as current)
        if (fs.existsSync(binaryPath)) {
            const realPath = fs.realpathSync(binaryPath);
            const content = fs.readFileSync(realPath, 'utf-8');
            if (content.startsWith('#!/bin/bash')) {
                const execMatch = content.match(/exec\s+"([^"]+)"/);
                if (execMatch?.[1]) {
                    return execMatch[1];
                }
            }
            return realPath;
        }

        return binaryPath;
    } catch (error) {
        return null;
    }
}
```

### Phase 6: Update CLI Patching (Optional)

The version check patching in `cli-patcher.ts` is Claude-specific:

```typescript
const warningText = 'It looks like your version of Anthropic coding CLI';
```

**Options:**

1. Make it provider-specific (search for different warning text per provider)
2. Skip patching for non-Anthropic providers (acceptable - warnings won't break functionality)
3. Add provider-specific patch logic to each extractor

**Recommendation:** Skip patching for Gemini/Codex. If they show version warnings, users can ignore them.

## File Changes Required

### New Files

**Provider infrastructure:**

- `src/providers/provider-config.ts` - Provider definitions and config
- `src/providers/extractor-interface.ts` - Common extractor interface
- `src/providers/anthropic-extractor.ts` - Move current logic here
- `src/providers/openai-extractor.ts` - OpenAI-specific extraction
- `src/providers/gemini-extractor.ts` - Gemini-specific extraction
- `src/providers/provider-factory.ts` - Returns correct extractor
- `src/providers/find-binary.ts` - Generalized binary detection

**Type definitions:**

- `src/types/anthropic-types.ts` - Move current request.ts here
- `src/types/openai-types.ts` - OpenAI API types
- `src/types/gemini-types.ts` - Gemini API types

### Modified Files

**Core logic:**

- `src/cli.ts` - Add provider flag, pass provider/extractor through pipeline
- `src/services/npm-service.ts` - Parameterize package names (4 functions)
- `src/interceptor.ts` - Accept provider config, generalize API detection
- `src/core/output-formatter.ts` - Add provider field to output

**Deprecated/refactored:**

- `src/core/content-extractor.ts` - Logic moves to anthropic-extractor.ts
- `src/core/request-filter.ts` - Logic moves to anthropic-extractor.ts
- `src/types/request.ts` - Moves to anthropic-types.ts

### Testing Updates

**New test files:**

- `test/providers/anthropic-extractor.test.ts`
- `test/providers/openai-extractor.test.ts`
- `test/providers/gemini-extractor.test.ts`
- `test/providers/provider-factory.test.ts`

**Update existing:**

- Move content-extractor tests to anthropic-extractor tests
- Move request-filter tests to anthropic-extractor tests
- Update integration tests for multi-provider

## Implementation Steps

### Step 1: Research Phase

Install and test each CLI to capture real API traces:

```bash
# Install CLIs
bun install -g @google/gemini-cli
bun install -g @openai/codex

# Capture real traces manually
gemini "test prompt" # Observe API calls
codex "test prompt"  # Observe API calls
```

Analyze actual request/response formats to build accurate type definitions.

### Step 2: Create Provider Infrastructure

1. Create `src/providers/` directory
2. Implement provider-config.ts
3. Implement extractor-interface.ts
4. Move Anthropic logic to anthropic-extractor.ts
5. Create type files for each provider

### Step 3: Implement OpenAI Support

1. Create openai-types.ts based on observed API format
2. Implement openai-extractor.ts
3. Test extraction logic with real OpenAI traces
4. Verify markdown output matches quality of Claude output

### Step 4: Implement Gemini Support

1. Create gemini-types.ts based on observed API format
2. Implement gemini-extractor.ts
3. Test extraction logic with real Gemini traces
4. Verify markdown output matches quality of Claude output

### Step 5: Wire Provider System into CLI

1. Add provider flag to Commander
2. Update all function signatures to accept provider config
3. Update npm-service.ts functions to use provider.npmPackage
4. Update interceptor.ts to use provider.apiEndpoints
5. Pass extractor through extraction pipeline

### Step 6: Update CLI Patching

Make cli-patcher.ts provider-aware or skip for non-Anthropic providers.

### Step 7: Testing & Validation

Test each provider thoroughly:

```bash
# Anthropic (regression test)
bun src/cli.ts --provider anthropic
bun src/cli.ts --provider anthropic 2.0.0
bun src/cli.ts --provider anthropic 2.0.0 --latest

# Google Gemini
bun src/cli.ts --provider google
bun src/cli.ts --provider google --binary-path /path/to/gemini

# OpenAI Codex
bun src/cli.ts --provider openai
bun src/cli.ts --provider openai --binary-path /path/to/codex
```

Verify for each provider:

- Raw JSONL trace captures complete API traffic
- Markdown file extracts system prompt correctly
- Markdown file extracts user message correctly
- Markdown file lists all riffs with full schemas
- Output is human-readable and complete

### Step 8: Documentation

Update README.md with multi-provider examples:

```bash
# Anthropic Anthropic coding CLI
bun src/cli.ts --provider anthropic 2.0.0

# Google Gemini
bun src/cli.ts --provider google

# OpenAI Codex
bun src/cli.ts --provider openai
```

## Key Implementation Notes

### Why Not Vercel AI SDK?

Vercel AI SDK is for **making API calls**. prompt-tracer **intercepts API calls** made by CLI riffs.

The interceptor works at the network layer (patching `fetch()` and `http/https`), so it's SDK-agnostic. The CLI riffs can use any SDK internally - we just capture their HTTP traffic.

### Provider-Specific vs Generic Code

**Generic (works for all providers):**

- Traffic interception
- JSONL logging
- Binary detection
- Process spawning
- npm package download

**Provider-specific (needs per-provider implementation):**

- Request body parsing
- System prompt extraction
- Riff schema extraction
- Message content extraction
- Request filtering/selection logic

### Maintaining Feature Parity

Each provider extractor must deliver:

1. **Complete system prompt** - Full instructions sent to the model
2. **User message** - The initial prompt
3. **All riffs** - Complete riff definitions with schemas
4. **Best request selection** - Logic to find the most representative API call
5. **Formatted output** - Human-readable markdown matching Claude output quality

## Success Criteria

For each provider (Anthropic, Google, OpenAI):

- Raw JSONL captures 100% of API traffic
- Markdown output contains complete system prompt
- Markdown output contains user message
- Markdown output lists all riffs with full schemas
- Version management works (download from npm)
- System binary detection works
- `--latest` flag processes version ranges
- Output quality matches Anthropic coding CLI output
- All tests passing
- Documentation complete

## Migration Strategy

> **Recommended: Implement all three providers together**

Reasoning:

- Ensures abstraction layer is correct from the start
- Validates that interface design works for all cases
- Avoids rework from discovering limitations mid-implementation
- Clean, complete solution

**Steps:**

1. Build infrastructure (configs, interfaces, factory)
2. Implement all three extractors in parallel
3. Wire into CLI and services
4. Test all three together
5. Document all three

## Critical Success Factor

**Research first, implement second.**

Before writing code, manually capture real API traces from Gemini and Codex CLIs to understand their exact formats. Build extractors based on observed reality, not documentation assumptions.
