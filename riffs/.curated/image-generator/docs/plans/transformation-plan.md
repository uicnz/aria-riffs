# Image Generator Riff - ARIA Platform Transformation Plan

## Executive Summary

Transform `image-generator` from a simple script collection into a production-ready ARIA platform riff with complete observability, proper CLI architecture, configuration management, and semantic parity across all artifacts.

## Current State Analysis

### What We Have

- Basic TypeScript scripts for image generation
- Four main operations: generate, edit, compose, multi-turn chat
- Simple package scripts using tsx
- Types defined in types.ts
- Basic error handling

### What's Missing (Critical ARIA Requirements)

- Commander.js CLI with proper command structure
- Pino structured logging with file output
- YAML configuration file with Zod validation
- Proper modular architecture with clean separation of concerns
- Class-based design pattern
- Semantic parity across all artifacts
- Proper file naming following action-noun pattern
- Logging directory with rotation
- Config directory
- Comprehensive testing with Vitest
- Production-ready error handling and observability

## Riff Identity and Semantic Parity

### Riff Name

`image-generator` (aligns with ARIA platform naming: image-alttext, image-metadata, image-ocr, etc.)

### Semantic Parity Map

```tree
image-generator/                           # Directory name
config.yaml         # Config file
IMAGE_GENERATOR_*                          # Environment variables
.aria/logs/image-generator.log                   # Log file (daily rotation)
generate                                  # Package-local Bun script
edit                                      # Package-local Bun script
compose                                   # Package-local Bun script
chat                                      # Package-local Bun script
typecheck                                 # Package-local Bun script
ImageGeneratorConfig                       # TypeScript config type
ImageGeneratorLogger                       # Logger class
createLogger('image-generator')            # Logger identifier
```

## Architecture Transformation

### Phase 1: Foundation (Critical Path)

#### 1.1 Directory Structure Reorganization

**Current:**

```tree
image-generator/
├── src/
│   ├── types.ts
│   ├── generate-image.ts
│   ├── edit-image.ts
│   ├── compose-images.ts
│   ├── multi-turn-chat.ts
│   └── gemini-images.ts
├── test-outputs/
├── package.json
└── tsconfig.json
```

**Target ARIA Structure:**

```tree
image-generator/
├── src/
│   ├── cli.ts                    # Commander.js CLI entry point
│   ├── lib/
│   │   ├── config.ts             # Config loading with Zod validation
│   │   ├── load-dotenv.ts        # Canonical environment loading
│   │   ├── logger.ts             # Pino logger setup and configuration
│   │   ├── schema.ts             # Zod configuration schema
│   │   └── types.ts              # Shared TypeScript types and interfaces
│   ├── generate-image.ts         # Image generation core logic (class-based)
│   ├── edit-image.ts             # Image editing core logic (class-based)
│   ├── compose-images.ts         # Image composition core logic (class-based)
│   ├── chat-session.ts           # Multi-turn chat logic (class-based)
│   ├── handle-files.ts           # File I/O operations
│   └── utils.ts                  # Utility functions
├── config.yaml                     # Riff configuration
├── .aria/logs/                         # Log output directory (gitignored)
│   └── .gitkeep
├── test/
│   ├── unit/                     # Unit tests
│   ├── integration/              # Integration tests
│   └── fixtures/                 # Test fixtures
├── test-outputs/                 # Generated images (gitignored)
│   └── .gitkeep
├── package.json
├── tsconfig.json
├── biome.json
└── README.md
```

#### 1.2 Configuration System

**File: `config.yaml`**

```yaml
# Image Generator Riff Configuration

# Gemini API Configuration
gemini:
    default_model: 'gemini-3.1-flash-image'
    timeout_ms: 60000
    retry_attempts: 3

# Image Generation Defaults
defaults:
    aspect_ratio: '1:1'
    image_size: '1K'
    output_format: 'png'

# Output Configuration
output:
    directory: 'test-outputs'
    filename_pattern: '{timestamp}_{operation}'
    timestamp_format: 'YYYY-MM-DD_HH-mm-ss'

# Logging Configuration
logging:
    level: 'INFO'
    verbose: false
    file: 'image-generator.log'
    max_file_size_mb: 10
    max_files: 7
    pretty_print: true

# Chat Session Configuration
chat:
    default_output_dir: '.'
    auto_save: false
    history_file: '.gemini-chat-history.json'
```

**File: `src/lib/config.ts`**

```typescript
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import { z } from 'zod';

// Zod schema for configuration validation
export const ConfigSchema = z.object({
    gemini: z.object({
        default_model: z.string().default('gemini-3.1-flash-image'),
        timeout_ms: z.number().default(60000),
        retry_attempts: z.number().default(3),
    }),
    defaults: z.object({
        aspect_ratio: z.string().default('1:1'),
        image_size: z.string().default('1K'),
        output_format: z.string().default('png'),
    }),
    output: z.object({
        directory: z.string().default('test-outputs'),
        filename_pattern: z.string().default('{timestamp}_{operation}'),
        timestamp_format: z.string().default('YYYY-MM-DD_HH-mm-ss'),
    }),
    logging: z.object({
        level: z
            .enum(['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'])
            .default('INFO'),
        verbose: z.boolean().default(false),
        file: z.string().default('image-generator.log'),
        max_file_size_mb: z.number().default(10),
        max_files: z.number().default(7),
        pretty_print: z.boolean().default(true),
    }),
    chat: z.object({
        default_output_dir: z.string().default('.'),
        auto_save: z.boolean().default(false),
        history_file: z.string().default('.gemini-chat-history.json'),
    }),
});

export type ImageGeneratorConfig = z.infer<typeof ConfigSchema>;

export function loadConfig(configPath?: string): ImageGeneratorConfig {
    const defaultPath = resolve(
        process.cwd(),
        '.aria/config.yaml',
    );
    const path = configPath || defaultPath;

    if (!existsSync(path)) {
        throw new Error(`Configuration file not found: ${path}`);
    }

    const fileContent = readFileSync(path, 'utf-8');
    const rawConfig = parse(fileContent);

    return ConfigSchema.parse(rawConfig);
}
```

#### 1.3 Logging System (Pino)

**File: `src/lib/logger.ts`**

```typescript
import path from 'node:path';
import type { Level, Logger, LoggerOptions as PinoLoggerOptions, StreamEntry } from 'pino';
import pino from 'pino';

export interface LoggerConfig {
    level: string;
    verbose: boolean;
    silent?: boolean;
    file?: string;
}

export function createLogger(config: LoggerConfig): Logger {
    const logFile = path.resolve(process.cwd(), config.file || '.aria/logs/image-generator.log');
    const level = (config.verbose ? 'debug' : config.level.toLowerCase()) as Level;
    const loggerOptions: PinoLoggerOptions = { level };
    const streams: StreamEntry[] = [
        {
            level: 'info',
            stream: pino.destination({
                dest: logFile,
                mkdir: true,
                sync: true,
                minLength: 0,
            }),
        },
    ];

    if (!config.silent) {
        streams.push({
            level: config.verbose ? 'debug' : 'info',
            stream: pino.destination({ dest: 1, sync: true, minLength: 0 }),
        });
    }

    return pino(loggerOptions, pino.multistream(streams));
}
```

#### 1.4 Commander.js CLI Architecture

**File: `src/cli.ts`**

```typescript
#!/usr/bin/env bun

import { Command } from 'commander';
import type { Logger } from 'pino';
import { loadConfig } from './config.js';
import { createLogger } from './logger.js';
import { GenerateImageCommand } from './generate-image.js';
import { EditImageCommand } from './edit-image.js';
import { ComposeImagesCommand } from './compose-images.js';
import { ChatSessionCommand } from './chat-session.js';
import type { ImageGeneratorConfig } from './types.js';

const program = new Command();
let logger: Logger;
let config: ImageGeneratorConfig;

program
    .name('image-generator')
    .description('Gemini Image Generation Riff - ARIA Platform')
    .version('1.0.0')
    .option('-c, --config <path>', 'Path to configuration file')
    .option('-v, --verbose', 'Enable verbose logging')
    .option(
        '--log-level <level>',
        'Set log level (TRACE, DEBUG, INFO, WARN, ERROR)',
    )
    .hook('preAction', (thisCommand) => {
        // Load configuration
        const opts = thisCommand.opts();
        config = loadConfig(opts.config);

        // Override logging config with CLI options
        if (opts.verbose) {
            config.logging.verbose = true;
        }
        if (opts.logLevel) {
            config.logging.level = opts.logLevel;
        }

        // Initialize logger
        logger = createLogger({
            level: config.logging.level,
            verbose: config.logging.verbose,
            file: config.logging.file,
            maxFileSizeMb: config.logging.max_file_size_mb,
            maxFiles: config.logging.max_files,
            prettyPrint: config.logging.pretty_print,
        });

        logger.debug({ config }, 'Configuration loaded');
    });

// Generate command
program
    .command('generate')
    .description('Generate an image from a text prompt')
    .argument('<prompt>', 'Text prompt for image generation')
    .argument('<output>', 'Output file path')
    .option('-m, --model <model>', 'Gemini model to use')
    .option('-a, --aspect <ratio>', 'Aspect ratio (1:1, 16:9, 9:16, 4:3, 3:4)')
    .option('-s, --size <size>', 'Image size (1K, 2K, 4K)')
    .action(async (prompt, output, options) => {
        const cmd = new GenerateImageCommand(config, logger);
        await cmd.execute(prompt, output, options);
    });

// Edit command
program
    .command('edit')
    .description('Edit an existing image using AI')
    .argument('<input>', 'Input image path')
    .argument('<instruction>', 'Edit instruction')
    .argument('<output>', 'Output file path')
    .option('-m, --model <model>', 'Gemini model to use')
    .option('-a, --aspect <ratio>', 'Aspect ratio')
    .option('-s, --size <size>', 'Image size')
    .action(async (input, instruction, output, options) => {
        const cmd = new EditImageCommand(config, logger);
        await cmd.execute(input, instruction, output, options);
    });

// Compose command
program
    .command('compose')
    .description('Compose multiple images into a new image')
    .argument('<instruction>', 'Composition instruction')
    .argument('<output>', 'Output file path')
    .argument('<images...>', 'Input image paths')
    .option('-m, --model <model>', 'Gemini model to use')
    .option('-a, --aspect <ratio>', 'Aspect ratio')
    .option('-s, --size <size>', 'Image size')
    .action(async (instruction, output, images, options) => {
        const cmd = new ComposeImagesCommand(config, logger);
        await cmd.execute(instruction, output, images, options);
    });

// Chat command
program
    .command('chat')
    .description('Start an interactive image generation chat session')
    .option('-m, --model <model>', 'Gemini model to use')
    .option('-o, --output-dir <dir>', 'Output directory for generated images')
    .action(async (options) => {
        const cmd = new ChatSessionCommand(config, logger);
        await cmd.execute(options);
    });

// Parse and execute
program.parse();
```

### Phase 2: Code Refactoring (Class-Based Architecture)

#### 2.1 Class-Based Command Pattern

Each operation becomes a class following this pattern:

**File: `src/generate-image.ts`**

```typescript
import { writeFile } from 'node:fs/promises';
import { GoogleGenAI } from '@google/genai';
import type { Logger } from 'pino';
import type {
    ImageGeneratorConfig,
    GenerateOptions,
    ImageGenerationConfig,
} from './types.js';

export class GenerateImageCommand {
    private config: ImageGeneratorConfig;
    private logger: Logger;
    private genAI: GoogleGenAI;

    constructor(config: ImageGeneratorConfig, logger: Logger) {
        this.config = config;
        this.logger = logger;

        const apiKey = process.env['GOOGLE_API_KEY'];
        if (!apiKey) {
            throw new Error(
                'GOOGLE_API_KEY environment variable not set',
            );
        }

        this.genAI = new GoogleGenAI({ apiKey });
    }

    async execute(
        prompt: string,
        outputPath: string,
        options: GenerateOptions,
    ): Promise<void> {
        this.logger.info(
            { prompt, outputPath, options },
            'Starting image generation',
        );

        try {
            const result = await this.generateImage(prompt, options);
            await this.saveImage(result, outputPath);

            this.logger.info(
                { outputPath },
                'Image generation completed successfully',
            );
        } catch (error) {
            this.logger.error(
                { error: error.message, prompt, outputPath },
                'Image generation failed',
            );
            throw error;
        }
    }

    private async generateImage(
        prompt: string,
        options: GenerateOptions,
    ): Promise<Buffer> {
        // Implementation details...
    }

    private async saveImage(
        imageData: Buffer,
        outputPath: string,
    ): Promise<void> {
        // Implementation details...
    }
}
```

#### 2.2 File Naming Corrections

**Current Files → New Names:**

- `generate-image.ts` ✓ (already correct action-noun)
- `edit-image.ts` ✓ (already correct action-noun)
- `compose-images.ts` ✓ (already correct action-noun)
- `multi-turn-chat.ts` → `chat-session.ts` (better semantic clarity)
- `gemini-images.ts` → DELETE (merge utilities into utils.ts)
- `handle-files.ts` (NEW - extract file I/O)
- `utils.ts` (NEW - general utilities)

### Phase 3: Dependencies and Configuration

#### 3.1 Required New Dependencies

```json
{
    "dependencies": {
        "@google/genai": "^2.23.0",
        "commander": "^15.0.0",
        "pino": "^10.3.1",
        "yaml": "^2.9.1",
        "zod": "^4.6.5"
    }
}
```

#### 3.2 Updated package.json Scripts

```json
{
    "scripts": {
        "generate": "bun src/cli.ts generate",
        "edit": "bun src/cli.ts edit",
        "compose": "bun src/cli.ts compose",
        "chat": "bun src/cli.ts chat",
        "typecheck": "tsc --noEmit -p tsconfig.json",
        "test": "vitest",
        "test:run": "vitest run",
        "test:ui": "vitest --ui",
        "test:coverage": "vitest run --coverage",
        "build": "tsc",
        "lint": "biome check .",
        "lint:fix": "biome check --write ."
    }
}
```

#### 3.3 TypeScript Configuration Update

**File: `tsconfig.json`**

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
        "types": ["node"],
        "declaration": true,
        "declarationMap": true,
        "sourceMap": true
    },
    "include": ["src/**/*"],
    "exclude": ["node_modules", "dist", "test"]
}
```

### Phase 4: Testing Infrastructure

#### 4.1 Vitest Configuration

**File: `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            exclude: ['node_modules/', 'test/', 'dist/'],
        },
    },
});
```

#### 4.2 Test Structure

```tree
test/
├── unit/
│   ├── config.test.ts          # Config loading tests
│   ├── logger.test.ts          # Logger tests
│   ├── generate-image.test.ts  # Generation tests
│   ├── edit-image.test.ts      # Edit tests
│   └── compose-images.test.ts  # Composition tests
├── integration/
│   ├── cli.test.ts             # CLI integration tests
│   └── end-to-end.test.ts      # Full workflow tests
└── fixtures/
    ├── config.yaml
    └── images/
        ├── test-input.png
        └── test-reference.png
```

### Phase 5: Documentation

#### 5.1 README.md Structure

```markdown
# Image Generator Riff

Production-ready image generation riff using Google's Gemini API, designed for the ARIA platform.

## Features

- Text-to-image generation
- AI-powered image editing
- Multi-image composition
- Interactive chat sessions
- Structured logging with Pino
- Configuration management
- Full observability

## Installation

[Installation steps]

## Usage

### Direct bun Execution (Recommended for AI Agents)

[bun command examples]

### Package-local Bun Scripts (Alternative)

[package script examples]

## Configuration

[Configuration documentation]

## Logging

[Logging documentation]

## Development

[Development guidelines]
```

### Phase 6: Gitignore Updates

**File: `.gitignore`**

```gitignore
# Dependencies
node_modules/
bun.lock
package-lock.json

# Build output
dist/

# Logs
.aria/logs/
*.log

# Generated images
test-outputs/
*.png
*.jpg
*.jpeg

# Environment
.env
.env.local

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db

# Test coverage
coverage/

# Chat history
.gemini-chat-history.json
```

## Implementation Phases

### Phase 1: Foundation

- [ ] Create directory structure
- [ ] Set up configuration system (config.ts + YAML)
- [ ] Implement Pino logging (logger.ts)
- [ ] Install all dependencies
- [ ] Update tsconfig.json

### Phase 2: CLI Architecture

- [ ] Implement Commander.js CLI (cli.ts)
- [ ] Refactor generate-image.ts to class-based
- [ ] Refactor edit-image.ts to class-based
- [ ] Refactor compose-images.ts to class-based
- [ ] Refactor multi-turn-chat.ts to chat-session.ts (class-based)

### Phase 3: Utilities and File Handling

- [ ] Create handle-files.ts module
- [ ] Create utils.ts module
- [ ] Extract common file operations
- [ ] Implement proper error handling

### Phase 4: Testing

- [ ] Set up Vitest configuration
- [ ] Write unit tests for all modules
- [ ] Write integration tests for CLI
- [ ] Create test fixtures
- [ ] Achieve 80%+ code coverage

### Phase 5: Documentation and Polish

- [ ] Write comprehensive README.md
- [ ] Document all configuration options
- [ ] Add inline code documentation
- [ ] Update package.json metadata
- [ ] Add example configurations

### Phase 6: Validation

- [ ] Run full typecheck
- [ ] Run all tests
- [ ] Validate logging output
- [ ] Test all CLI commands
- [ ] Verify semantic parity across artifacts

## Success Criteria

### Functional Requirements

- [ ] All four operations work via CLI
- [ ] Configuration loads from YAML file
- [ ] Logging writes to both console and file
- [ ] All commands have proper help text
- [ ] Error handling is comprehensive

### Code Quality Requirements

- [ ] TypeScript strict mode passes
- [ ] Biome linting passes
- [ ] All tests pass with 80%+ coverage
- [ ] No files over 300 lines
- [ ] Class-based architecture throughout

### ARIA Platform Requirements

- [ ] Semantic parity across all artifacts
- [ ] Action-noun file naming
- [ ] Commander.js CLI
- [ ] Pino structured logging
- [ ] YAML configuration with Zod validation
- [ ] Modular, extensible architecture
- [ ] Complete observability
- [ ] Production-ready error handling

## Risk Mitigation

### Risk: Breaking Existing Functionality

**Mitigation:** Keep original scripts as backup, test each refactored module individually

### Risk: Configuration Complexity

**Mitigation:** Provide sensible defaults, comprehensive examples, validation with Zod

### Risk: Logging Overhead

**Mitigation:** Use Pino (fastest Node.js logger), make verbose mode optional

### Risk: Testing Gemini API

**Mitigation:** Mock API responses in tests, create fixtures, use environment variables for real tests

## Post-Implementation

### Monitoring

- Monitor log file sizes
- Track API usage and costs
- Monitor error rates
- Review structured logs for insights

### Future Enhancements

- Add batch processing mode
- Implement image style presets
- Add prompt templates
- Create image gallery viewer
- Add webhook support for CI/CD

## Conclusion

This transformation will elevate `image-generator` from a simple script collection to a production-ready ARIA platform riff with enterprise-grade observability, maintainability, and extensibility. The modular architecture and comprehensive logging will enable future enhancements without major refactoring.
