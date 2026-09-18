/**
 * Image Metadata -- RiffPrompt definition
 */
export const riffPrompt = {
	name: 'image-metadata',
	summary: 'AI-generated image descriptions embedded as XMP metadata with database tracking',
	purpose:
		'Processes images using vision-capable LLM providers (Ollama/LLaVA, Anthropic Claude, Google Gemini) to generate detailed descriptions, then embeds them as custom XMP metadata tags (AriaTitle, AriaSubject, AriaKeywords, AriaDescription) using Sharp. Tracks all processed images in a SQLite database with filename sanitization and collision handling. Supports batch processing with progress bars and configurable retry logic.',
	whenToUse: [
		'Adding AI-generated descriptions to image files as embedded XMP metadata',
		'Batch processing directories of images to generate and embed metadata',
		'Building a searchable database of image descriptions for asset management',
		'Checking LLM provider connectivity and available vision models',
		'Querying database statistics about processed images',
	],
	pipeline: [
		'Scan input directory for supported image files (png, jpg, jpeg, gif, bmp)',
		'For each image: send to configured LLM provider for visual description generation',
		'Parse LLM response to extract title, subject, keywords, and description',
		'Write custom Aria XMP metadata tags into the image file using Sharp',
		'Store image record in SQLite database with original filename, new metadata, and processing status',
		'Report progress and statistics',
	],
	parameters: [
		{
			name: 'command',
			type: 'enum(process|check-connection|db-stats|list-models)',
			required: true,
			description: 'Subcommand to execute',
		},
		{
			name: 'directory',
			type: 'string',
			required: false,
			description: 'Directory containing images to process (for process command)',
		},
		{ name: '-r', type: 'flag', required: false, description: 'Process directory recursively' },
		{
			name: '--prompt',
			type: 'string',
			required: false,
			description: 'Custom prompt for LLM description generation',
		},
		{ name: '--verbose', type: 'flag', required: false, description: 'Enable verbose logging' },
	],
	output: 'For process: images are modified in place with embedded XMP metadata tags and records stored in SQLite database. For check-connection: displays LLM provider connectivity status. For db-stats: shows database statistics including total images processed and metadata coverage. For list-models: displays available vision models from the configured provider.',
	constraints: [
		'Requires a vision-capable LLM provider: Ollama with LLaVA model, Anthropic Claude, or Google Gemini',
		'Supported image formats: PNG, JPG, JPEG, GIF, BMP',
		'Maximum file size: 50MB per image (configurable)',
		'Sharp library required for XMP metadata writing',
		'Provider API key required for Anthropic (ANTHROPIC_API_KEY) or Gemini (GOOGLE_API_KEY)',
		'Ollama must be running with a LLaVA model pulled',
	],
	conventions: [
		'Configuration is in config.yaml co-located in the riff directory',
		'LLM provider is selected via the image-metadata.llm.provider config key',
		'Provider-specific settings are in the llmProviders peer section of config.yaml',
		'Use check-connection to verify provider setup before batch processing',
		'Custom XMP tags can be read with exifriff: exifriff -ariatitle -ariadescription image.png',
		'Invocation pattern: $RIFF <command> [args]',
	],
	examples: [
		{
			description: 'Process images in a directory',
			command: '$RIFF process .aria/assets/images',
			outcome:
				'Generates AI descriptions for each image and embeds them as XMP metadata, tracking results in SQLite',
		},
		{
			description: 'Process recursively with custom prompt',
			command: '$RIFF process -r --prompt "describe briefly" ./images',
			outcome: 'Recursively processes all images using a custom description prompt',
		},
		{
			description: 'Check LLM provider connectivity',
			command: '$RIFF check-connection',
			outcome: 'Tests connection to the configured LLM provider and reports status',
		},
		{
			description: 'View database statistics',
			command: '$RIFF db-stats',
			outcome: 'Shows total images processed, metadata coverage, and processing history',
		},
	],
};
