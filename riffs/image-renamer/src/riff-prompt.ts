/**
 * Image Renamer -- RiffPrompt definition
 */
export const riffPrompt = {
	name: 'image-renamer',
	summary: 'Batch image renaming with AI-generated descriptive filenames',
	purpose:
		'Renames image files using AI-generated descriptive filenames from multiple LLM providers (Ollama with LLaVA, Anthropic Claude, Google Gemini) via the Vercel AI SDK. Uses a safe copy-then-delete strategy with verification to prevent data loss. Supports dry-run previews, recursive directory processing, file system watching for new images, and filename sanitization with configurable patterns (case conversion, punctuation removal, separator character). Tracks all renames in a SQLite database.',
	whenToUse: [
		'Renaming generic image filenames (IMG_001.jpg, screenshot.png) to descriptive names',
		'Batch renaming images in a directory using AI-generated descriptions',
		'Monitoring a directory for new images and auto-renaming them as they arrive',
		'Previewing rename operations with dry-run before committing changes',
		'Generating consistent, SEO-friendly filenames for image assets',
	],
	pipeline: [
		'Scan input directory for supported image files (png, jpg, jpeg, gif, bmp)',
		'For each image: send to configured LLM provider for visual analysis',
		'Provider generates a 4-5 word description of the image content',
		'Sanitize description into filename: lowercase, remove punctuation, replace spaces with dashes',
		'Handle filename collisions by appending numeric suffixes',
		'Perform safe rename: copy to new name, verify copy, delete original',
		'Record rename operation in SQLite database',
		'Report results with before/after filenames',
	],
	parameters: [
		{
			name: 'command',
			type: 'enum(rename|watch|check-connection|list-models)',
			required: true,
			description: 'Subcommand to execute',
		},
		{ name: 'directory', type: 'string', required: false, description: 'Directory containing images to process' },
		{ name: '--dry-run', type: 'flag', required: false, description: 'Preview changes without renaming files' },
		{ name: '-r', type: 'flag', required: false, description: 'Process directory recursively' },
		{ name: '--prompt', type: 'string', required: false, description: 'Custom prompt for filename generation' },
		{ name: '--verbose', type: 'flag', required: false, description: 'Enable verbose logging' },
	],
	output: 'For rename: files renamed in place with descriptive names, summary table showing original and new filenames. For dry-run: preview table of proposed changes without modifying files. For watch: continuous monitoring with real-time renaming of new files. For check-connection: LLM provider connectivity status. All operations logged to SQLite database.',
	constraints: [
		'Requires a vision-capable LLM provider: Ollama with LLaVA model, Anthropic Claude, or Google Gemini',
		'Supported image formats: PNG, JPG, JPEG, GIF, BMP',
		'Maximum file size: 50MB per image (configurable)',
		'Provider API key required for Anthropic (ANTHROPIC_API_KEY) or Gemini (GOOGLE_API_KEY)',
		'Safe rename uses copy-then-delete -- requires sufficient disk space for temporary duplicates',
		'Maximum filename length: 100 characters (configurable)',
	],
	conventions: [
		'Always use --dry-run first to preview changes before committing',
		'Configuration is in config.yaml co-located in the riff directory',
		'Provider is selected via the image-renamer.llm.provider config key or LLM_PROVIDER env var',
		'Each provider can have its own optimized prompt for filename generation',
		'Filenames are lowercased with dashes by default (configurable case and separator)',
		'Invocation pattern: $RIFF <command> [args]',
	],
	examples: [
		{
			description: 'Dry run to preview renames',
			command: '$RIFF rename --dry-run ./images',
			outcome: 'Shows a table of proposed filename changes without modifying any files',
		},
		{
			description: 'Rename images recursively',
			command: '$RIFF rename -r ./images',
			outcome: 'Renames all supported images in the directory tree using AI-generated descriptive filenames',
		},
		{
			description: 'Watch directory for new images',
			command: '$RIFF watch ./images',
			outcome: 'Monitors the directory and auto-renames new images as they are added',
		},
		{
			description: 'Check LLM provider connectivity',
			command: '$RIFF check-connection',
			outcome: 'Tests connection to the configured LLM provider and reports status',
		},
	],
};
