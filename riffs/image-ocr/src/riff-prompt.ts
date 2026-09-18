/**
 * Image OCR -- RiffPrompt definition
 */
export const riffPrompt = {
	name: 'image-ocr',
	summary: 'OCR text extraction from images and PDFs with Markdown output',
	purpose:
		'Extracts text from images and PDF files using the scribe.js OCR library with configurable language support, confidence thresholds, and output formatting. Produces Markdown output with optional metadata headers. Supports batch processing with progress bars, concurrent execution, and multiple languages. No external API calls required -- all OCR processing happens locally.',
	whenToUse: [
		'Extracting text content from scanned images or photographs of documents',
		'Converting PDF files to searchable text with OCR',
		'Batch processing directories of images to extract text content',
		'Extracting text in non-English languages (configurable language support)',
		'Verifying OCR setup and dependencies before processing',
	],
	pipeline: [
		'Scan input path for supported files (png, jpg, jpeg, gif, bmp, tiff, pdf)',
		'Validate OCR setup and Aria-provided OCR runtime availability',
		'For each file: run OCR engine with configured language and confidence threshold',
		'Filter extracted text blocks by confidence score',
		'Format output as Markdown with optional metadata headers',
		'Write text output files alongside or in configured output directory',
		'Report processing statistics and any errors',
	],
	parameters: [
		{
			name: 'command',
			type: 'enum(process|check-setup|config)',
			required: true,
			description: 'Subcommand to execute',
		},
		{
			name: 'path',
			type: 'string',
			required: false,
			description: 'File or directory to process (required for process command)',
		},
		{ name: '-r', type: 'flag', required: false, description: 'Process directory recursively' },
		{ name: '--force', type: 'flag', required: false, description: 'Overwrite existing output files' },
		{ name: '--language', type: 'string', required: false, description: 'OCR language code (default: eng)' },
		{
			name: '--confidence',
			type: 'number',
			required: false,
			description: 'Confidence threshold for text extraction, 0.0 to 1.0 (default: 0.5)',
		},
		{ name: '--verbose', type: 'flag', required: false, description: 'Enable verbose logging' },
	],
	output: 'Text files (.txt) containing extracted text in Markdown format with optional metadata headers (source file, language, confidence threshold, extraction date). For check-setup: reports OCR library status and configuration. For config: displays current configuration values.',
	constraints: [
		'Requires the Aria runtime package store to provide OCR sidecar assets',
		'Supported file formats: PNG, JPG, JPEG, GIF, BMP, TIFF, PDF',
		'Maximum file size: 100MB per file (configurable)',
		'OCR accuracy depends on image quality and resolution',
		'Language support depends on scribe.js available language packs',
		'Concurrent job limit: 2 by default (configurable)',
	],
	conventions: [
		'Configuration is in config.yaml co-located in the riff directory',
		'Use check-setup to verify OCR dependencies before batch processing',
		'Output files use .txt extension by default (configurable)',
		'Higher confidence thresholds produce fewer but more reliable text extractions',
		'Invocation pattern: $RIFF <command> [args]',
	],
	examples: [
		{
			description: 'Extract text from a single image',
			command: '$RIFF process ./scanned-document.jpg',
			outcome: 'Creates scanned-document.txt with extracted text content in Markdown format',
		},
		{
			description: 'Batch process a directory recursively',
			command: '$RIFF process -r ./scanned-pages',
			outcome: 'Processes all supported files in the directory tree, creating .txt output files for each',
		},
		{
			description: 'Process with Spanish language OCR and high confidence',
			command: '$RIFF process --language spa --confidence 0.8 ./images',
			outcome: 'Extracts only high-confidence Spanish text from images in the directory',
		},
		{
			description: 'Check OCR setup',
			command: '$RIFF check-setup',
			outcome: 'Verifies the OCR runtime package is available and reports OCR configuration status',
		},
	],
};
