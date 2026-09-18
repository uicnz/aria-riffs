# Aria Image Generator Riff

Image generation riff using Google Gemini API for the Aria platform.

## Features

- Text-to-image generation
- Image editing with natural language instructions
- Multi-image composition (up to 14 images)
- Interactive chat sessions
- Structured logging with Pino (file rotation)
- YAML configuration with Zod validation
- Commander.js CLI
- TypeScript strict mode

## Installation

This riff is part of the Aria monorepo. Install dependencies from the repository root:

```sh
bun install
```

## Configuration

Configuration is loaded from `config/config-image-generator.yaml` (root level). Default settings:

- **Model:** gemini-3.1-flash-image
- **Aspect Ratio:** 16:9
- **Image Size:** 2K
- **Output Directory:** .aria/exports/image-generator
- **Log Level:** INFO

See `config/config-image-generator.yaml` for all available options.

## Environment Variables

Required:

- `GOOGLE_API_KEY` - Your Google Gemini API key

## Usage

All commands are run from the **repository root** using bun scripts.

### Generate an Image

```sh
bun run image-generator:generate "A serene mountain landscape at dawn" output.png
```

### Edit an Image

```sh
bun run image-generator:edit input.png "Add dramatic sunset lighting" output.png
```

### Compose Multiple Images

```sh
bun run image-generator:compose "Combine these primitives into a cinematic composition" output.png img1.png img2.png img3.png
```

### Interactive Chat Session

```sh
bun run image-generator:chat
```

### Show Help

```sh
bun run image-generator -- --help
bun run image-generator:generate -- --help
```

## Commands

### generate

Generate an image from a text prompt.

```sh
bun run image-generator:generate <prompt> <output> [options]
```

**Options:**

- `-m, --model <model>` - Gemini model (default: gemini-3.1-flash-image)
- `-a, --aspect <ratio>` - Aspect ratio: 1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9 (default: 16:9)
- `-s, --size <size>` - Image size: 1K, 2K, 4K (default: 2K)

**Example:**

```sh
bun run image-generator:generate "Abstract geometric art with vibrant colors" art.png -- --aspect 1:1 --size 4K
```

### edit

Edit an existing image using AI.

```sh
bun run image-generator:edit <input> <instruction> <output> [options]
```

**Options:**

- `-m, --model <model>` - Gemini model
- `-a, --aspect <ratio>` - Aspect ratio (1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9)
- `-s, --size <size>` - Image size (1K, 2K, 4K)

**Example:**

```sh
bun run image-generator:edit landscape.png "Add a rainbow in the sky" landscape-rainbow.png
```

### compose

Compose multiple images into a new image (up to 14 images).

```sh
bun run image-generator:compose <instruction> <output> <image1> [image2...] [options]
```

**Options:**

- `-m, --model <model>` - Gemini model
- `-a, --aspect <ratio>` - Aspect ratio (1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9)
- `-s, --size <size>` - Image size (1K, 2K, 4K)

**Example:**

```sh
bun run image-generator:compose "Create a triptych from these photos" triptych.png photo1.png photo2.png photo3.png
```

### chat

Start an interactive image generation chat session.

```sh
bun run image-generator:chat [options]
```

**Options:**

- `-m, --model <model>` - Gemini model
- `-o, --output-dir <dir>` - Output directory for generated images (default: .aria/exports/image-generator)

**Chat Commands:**

- `/save [filename]` - Save current image
- `/load <path>` - Load an image into the conversation
- `/clear` - Start fresh conversation
- `/quit` - Exit chat

**Example:**

```sh
bun run image-generator:chat -- --output-dir .aria/exports/my-images
```

## File Locations

Following Aria monorepo conventions:

- **Configuration:** `config/config-image-generator.yaml` (root)
- **Logs:** `.aria/logs/image-generator.log` (root, with daily rotation)
- **Outputs:** `.aria/exports/image-generator/` (root, generated images)
- **Source Code:** `riffs/image-generator/src/`
- **Tests:** `riffs/image-generator/test/`

## Logging

Structured logs are written to `.aria/logs/image-generator.log` (root level) with daily rotation.

**Log Levels:** TRACE, DEBUG, INFO, WARN, ERROR, FATAL

**CLI Options:**

- `--verbose` - Enable debug logging
- `--log-level <level>` - Set specific log level

**Example:**

```sh
bun run image-generator:generate "Test prompt" test.png -- --verbose
```

## Development

### Type Checking

```sh
# Check entire monorepo
bun run typecheck

# Check only image-generator
bun run image-generator:typecheck
```

### Linting

```sh
# Lint entire monorepo
bun run lint

# Auto-fix issues
bun run lint:fix

# Check formatting
bun run format:check

# Auto-fix formatting
bun run check:write
```

### Testing

```sh
# Run all tests
bun run test

# Run image-generator tests only
bun run image-generator:test
```

### Quality Checks

```sh
# Run all quality checks (lint + typecheck)
bun run quality
```

## Architecture

### Class-Based Design

Each command is implemented as a class with:

- Constructor accepting `ImageGeneratorConfig` and `Logger`
- Public `execute()` method for command logic
- Private methods for internal operations

**Example:**

```typescript
export class GenerateImageCommand {
    constructor(config: ImageGeneratorConfig, logger: Logger);
    async execute(
        prompt: string,
        outputPath: string,
        options: GenerateOptions,
    ): Promise<void>;
}
```

### Module Structure

```tree
riffs/image-generator/
├── src/
│   ├── cli.ts                      # Commander.js CLI entry point
│   ├── commands/                   # Command implementations
│   │   ├── chat-session.ts         # Interactive chat command class
│   │   ├── compose-images.ts       # Image composition command class
│   │   ├── edit-image.ts           # Image editing command class
│   │   └── generate-image.ts       # Image generation command class
│   ├── lib/                        # Core library modules
│   │   ├── config.ts               # Config loading with Zod validation
│   │   ├── logger.ts               # Pino logger setup
│   │   └── types.ts                # TypeScript types and interfaces
│   └── utils/                      # Utility modules
│       ├── handle-files.ts         # File I/O utilities
│       └── utils.ts                # General utilities
├── test/                           # Co-located tests
│   ├── unit/                       # Unit tests
│   ├── integration/                # Integration tests
│   └── fixtures/                   # Test fixtures
├── docs/                           # Documentation
│   └── development/                # Development guides
│       └── aria-integration-lessons.md
└── README.md                       # This file
```

## Semantic Parity

Following Aria platform standards, all artifacts use consistent naming:

- **Riff:** `image-generator`
- **Config:** `config-image-generator.yaml`
- **Logs:** `image-generator.log`
- **Scripts:** `image-generator:generate`, `image-generator:edit`, etc.
- **Types:** `ImageGeneratorConfig`
- **Logger base:** `{ riff: 'image-generator' }`

## Integration Notes

This riff was integrated into the Aria monorepo from a standalone repository. Key changes during integration:

- Migrated to monorepo dependency management
- Updated paths to use root-level config, logs, and exports
- Fixed API compatibility issues with @google/genai
- Aligned code style with Aria standards (single quotes, formatting)

See `docs/development/general/aria-integration-lessons.md` for detailed integration insights.
