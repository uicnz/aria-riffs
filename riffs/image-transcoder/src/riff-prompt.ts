/**
 * Image Transcoder -- RiffPrompt definition
 */
export const riffPrompt = {
	name: 'image-transcoder',
	summary: 'Image resize and WebP conversion to fit within LLM provider input size limits',
	purpose:
		'Transcodes and resizes images to meet file size thresholds required by LLM providers. Converts images to WebP format with configurable quality, then iteratively reduces dimensions by 10% using Lanczos3 resampling until the file fits within the target size (default 5MB). Supports JPG, PNG, WebP, and BMP input formats. Processes single files or entire directories with optional custom output paths.',
	whenToUse: [
		'Preparing images for LLM vision APIs that have input size limits',
		'Batch converting a directory of large images to optimized WebP format',
		'Reducing image file sizes while maintaining acceptable visual quality',
		'Converting BMP or PNG screenshots to smaller WebP files for processing',
	],
	pipeline: [
		'Check input file size against threshold (default 5MB)',
		'Convert to WebP format using Sharp if not already WebP',
		'If still over threshold, iteratively reduce dimensions by 10% with Lanczos3 resampling',
		'Write output to same directory or custom output directory',
	],
	parameters: [
		{
			name: 'command',
			type: 'enum(process)',
			required: true,
			description: 'Action to perform: process transcodes the image(s)',
		},
		{
			name: 'file-or-directory',
			type: 'string',
			required: true,
			description: 'Path to image file or directory of images to process',
		},
		{
			name: '--output, -o',
			type: 'string',
			required: false,
			description: 'Custom output directory for processed images',
		},
		{ name: '--verbose, -v', type: 'flag', required: false, description: 'Enable verbose debug logging' },
	],
	output: 'WebP image file(s) at the output location, each guaranteed to be under the configured size threshold. Original files are not modified when an output directory is specified.',
	constraints: [
		'Sharp must be installed for image processing',
		'Input formats limited to JPG, JPEG, PNG, WebP, and BMP',
		'Output format is always WebP',
		'Output path must differ from input path to prevent overwriting source files',
		'Default size threshold is 5MB (configurable via TRANSCODE_MAX_SIZE or config.yaml)',
	],
	conventions: [
		'Use --output to keep originals intact when batch processing',
		'Environment variables TRANSCODE_MAX_SIZE and TRANSCODE_QUALITY override config defaults',
		'Configuration is in config.yaml co-located in the riff directory',
		'Invocation pattern: $RIFF process [path] [options]',
	],
	examples: [
		{
			description: 'Process a single image with default settings',
			command: '$RIFF process ./large-image.png',
			outcome: 'Converts to WebP at quality 85 and reduces dimensions until under 5MB',
		},
		{
			description: 'Process directory with custom output location',
			command: '$RIFF process ./source-images/ --output ./optimized/',
			outcome: 'Converts all supported images in the directory to WebP in the optimized/ folder',
		},
		{
			description: 'Process with environment variable overrides',
			command: 'TRANSCODE_MAX_SIZE=10 TRANSCODE_QUALITY=90 $RIFF process ./image.jpg',
			outcome: 'Converts image with 10MB threshold and quality 90 instead of defaults',
		},
	],
};
