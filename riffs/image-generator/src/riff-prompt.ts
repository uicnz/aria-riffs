/**
 * Image Generator -- RiffPrompt definition
 */
export const riffPrompt = {
	name: 'image-generator',
	summary: 'Text-to-image generation and editing with Google Gemini API',
	purpose:
		'Generates, edits, and composes images using the Google Gemini API. Supports text-to-image generation from prompts, AI-powered editing of existing images with natural language instructions, multi-image composition (up to 14 images), and interactive chat sessions for iterative image refinement. Configurable aspect ratios, image sizes, and output formats. Each command is implemented as a class with structured logging and Zod-validated configuration.',
	whenToUse: [
		'Generating images from text prompts for documentation, presentations, or creative assets',
		'Editing existing images with natural language instructions (add elements, change lighting, etc.)',
		'Composing multiple images into a single unified image',
		'Iterative image refinement through interactive chat sessions',
		'Batch generating multiple variations of an image from a single prompt',
	],
	pipeline: [
		'Load configuration and validate with Zod schema',
		'Initialize Gemini API client with configured model and API key',
		'For generate: send text prompt to Gemini, receive generated image, save to output path',
		'For edit: load input image, send with instruction to Gemini, save modified image',
		'For compose: load multiple input images, send with composition instruction, save result',
		'For chat: start interactive session maintaining conversation context for iterative refinement',
		'Auto-generate filenames with timestamps when output path not specified',
	],
	parameters: [
		{
			name: 'command',
			type: 'enum(generate|edit|compose|chat)',
			required: true,
			description: 'Subcommand to execute',
		},
		{
			name: 'prompt',
			type: 'string',
			required: false,
			description: 'Text prompt for generation (required for generate command)',
		},
		{ name: 'input', type: 'string', required: false, description: 'Input image path (required for edit command)' },
		{
			name: 'instruction',
			type: 'string',
			required: false,
			description: 'Edit or composition instruction (required for edit and compose commands)',
		},
		{
			name: 'output',
			type: 'string',
			required: false,
			description: 'Output file path (auto-generated if omitted)',
		},
		{
			name: 'images',
			type: 'string[]',
			required: false,
			description: 'Input image paths for compose command (up to 14 images)',
		},
		{
			name: '-m, --model',
			type: 'string',
			required: false,
			description: 'Gemini model to use (default: gemini-3.1-flash-image)',
		},
		{
			name: '-a, --aspect',
			type: 'enum(1:1|2:3|3:2|3:4|4:3|4:5|5:4|9:16|16:9|21:9)',
			required: false,
			description: 'Aspect ratio (default: 16:9)',
		},
		{ name: '-s, --size', type: 'enum(1K|2K|4K)', required: false, description: 'Image size (default: 2K)' },
		{
			name: '-n, --count',
			type: 'number',
			required: false,
			description: 'Number of variations to generate (generate command only)',
		},
		{
			name: '-o, --output-dir',
			type: 'string',
			required: false,
			description: 'Output directory for auto-named files',
		},
	],
	output: 'Generated image file(s) at the specified output path or auto-named in the configured output directory. For chat: images saved on demand with /save command. All images are saved as PNG by default. Console output confirms file paths and operation status.',
	constraints: [
		'GOOGLE_API_KEY environment variable required',
		'Compose command limited to 14 input images maximum',
		'Image size options are 1K, 2K, or 4K',
		'Output format is PNG by default (configurable)',
		'Gemini API rate limits and quotas apply',
		'Input images for edit and compose must be valid image files readable from disk',
	],
	conventions: [
		'Configuration is in config.yaml co-located in the riff directory',
		'Default output directory and chat directory are configured in config.yaml (paths.output section)',
		'Auto-generated filenames use the pattern: {timestamp}_{operation}.png (configurable in config.yaml)',
		'Use --verbose for debug-level logging during troubleshooting',
		'Invocation pattern: $RIFF <command> [args]',
	],
	examples: [
		{
			description: 'Generate an image from a text prompt',
			command: '$RIFF generate "A serene mountain landscape at dawn" landscape.png',
			outcome: 'Creates landscape.png with a Gemini-generated image matching the prompt',
		},
		{
			description: 'Edit an existing image',
			command: '$RIFF edit photo.png "Add dramatic sunset lighting" photo-sunset.png',
			outcome: 'Creates photo-sunset.png with the original image modified to include sunset lighting',
		},
		{
			description: 'Compose multiple images',
			command:
				'$RIFF compose "Create a triptych from these photos" -o .aria/exports/image-generator/images --output triptych.png img1.png img2.png img3.png',
			outcome: 'Combines the three input images into a single triptych composition',
		},
		{
			description: 'Start interactive chat session',
			command: '$RIFF chat',
			outcome:
				'Opens interactive session where you can iteratively generate and refine images through conversation',
		},
	],
};
