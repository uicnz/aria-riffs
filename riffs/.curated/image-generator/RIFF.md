---
name: image-generator
description: Text-to-image generation and editing with Google Gemini API
---

# Image Generator

## Purpose

Generates, edits, and composes images using the Google Gemini API. Supports text-to-image generation from prompts, AI-powered editing of existing images with natural language instructions, multi-image composition (up to 14 images), and interactive chat sessions for iterative image refinement. Configurable aspect ratios, image sizes, and output formats. Each command is implemented as a class with structured logging and Zod-validated configuration.

## When to use

- Generating images from text prompts for documentation, presentations, or creative assets
- Editing existing images with natural language instructions (add elements, change lighting, etc.)
- Composing multiple images into a single unified image
- Iterative image refinement through interactive chat sessions
- Batch generating multiple variations of an image from a single prompt

## Pipeline

1. Load configuration and validate with Zod schema
2. Initialize Gemini API client with configured model and API key
3. For generate: send text prompt to Gemini, receive generated image, save to output path
4. For edit: load input image, send with instruction to Gemini, save modified image
5. For compose: load multiple input images, send with composition instruction, save result
6. For chat: start interactive session maintaining conversation context for iterative refinement
7. Auto-generate filenames with timestamps when output path not specified

## Parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `command` | `enum(generate\|edit\|compose\|chat)` | yes | Subcommand to execute |
| `prompt` | `string` | no | Text prompt for generation (required for generate command) |
| `input` | `string` | no | Input image path (required for edit command) |
| `instruction` | `string` | no | Edit or composition instruction (required for edit and compose commands) |
| `output` | `string` | no | Output file path (auto-generated if omitted) |
| `images` | `string[]` | no | Input image paths for compose command (up to 14 images) |
| `-m, --model` | `string` | no | Gemini image model to use. |
| `-a, --aspect` | `enum(1:1\|2:3\|3:2\|3:4\|4:3\|4:5\|5:4\|9:16\|16:9\|21:9)` | no | Aspect ratio (default: 16:9) |
| `-s, --size` | `enum(1K\|2K\|4K)` | no | Image size (default: 2K) |
| `-n, --count` | `number` | no | Number of variations to generate (generate command only) |
| `-o, --output-dir` | `string` | no | Output directory for auto-named files |

## Output

Generated image file(s) at the specified output path or auto-named in the configured output directory. For chat: images saved on demand with /save command. All images are saved as PNG by default. Console output confirms file paths and operation status.

## Constraints

- GOOGLE_API_KEY environment variable required
- Compose command limited to 14 input images maximum
- Image size options are 1K, 2K, or 4K
- Output format is PNG by default (configurable)
- Gemini API rate limits and quotas apply
- Input images for edit and compose must be valid image files readable from disk

## Conventions

- Configuration is in config.yaml co-located in the riff directory
- Default output directory and chat directory are configured in config.yaml (paths.output section)
- Auto-generated filenames use the pattern: {timestamp}_{operation}.png (configurable in config.yaml)
- Use --verbose for debug-level logging during troubleshooting
- Invocation pattern: $RIFF <command> [args]

## Examples

### Generate an image from a text prompt

```sh
$RIFF generate "A serene mountain landscape at dawn" landscape.png
```

Creates landscape.png with a Gemini-generated image matching the prompt

### Edit an existing image

```sh
$RIFF edit photo.png "Add dramatic sunset lighting" photo-sunset.png
```

Creates photo-sunset.png with the original image modified to include sunset lighting

### Compose multiple images

```sh
$RIFF compose "Create a triptych from these photos" -o .aria/exports/image-generator/images --output triptych.png img1.png img2.png img3.png
```

Combines the three input images into a single triptych composition

### Start interactive chat session

```sh
$RIFF chat
```

Opens interactive session where you can iteratively generate and refine images through conversation
