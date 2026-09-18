/**
 * Image Sanitiser -- RiffPrompt definition
 */
export const riffPrompt = {
	name: 'image-sanitiser',
	summary: 'Image file extension verification and correction via magic byte detection',
	purpose:
		'Detects actual image file formats by reading magic bytes and EXIF metadata, then corrects mismatched file extensions. Uses the file-type library for magic byte detection and Sharp for image metadata analysis. Supports JPEG, PNG, GIF, BMP, TIFF, and WebP formats. Stores results in a SQLite database for tracking. Essential for preparing image collections where files may have incorrect extensions from downloads, migrations, or batch uploads.',
	whenToUse: [
		'Fixing files with wrong extensions (e.g., a PNG file incorrectly named .jpg)',
		'Batch processing directories to verify and correct image file types',
		'Preparing images for downstream riffs that require correct extensions (such as image-metadata or image-alttext)',
		'Validating image collections for format consistency before archival or publishing',
		'Auditing image directories after migration from systems that changed extensions incorrectly',
	],
	pipeline: [
		'Scan input directory for image files matching supported extensions',
		'Read magic bytes from each file using file-type library',
		'Optionally verify format via Sharp image metadata analysis',
		'Compare detected format against current file extension',
		'Report mismatches (in dry-run or analyse mode) or rename files to correct extension',
		'Verify renamed files are still readable (when verifyAfterRename is enabled)',
		'Record results in SQLite database',
	],
	parameters: [
		{
			name: 'command',
			type: 'enum(sanitise|analyse|detect|check-deps)',
			required: true,
			description:
				'Action to perform: sanitise fixes extensions, analyse is dry-run, detect checks a single file, check-deps verifies prerequisites',
		},
		{
			name: 'path',
			type: 'string',
			required: false,
			description: 'Path to image file (for detect) or directory (for sanitise/analyse)',
		},
		{ name: '--dry-run', type: 'flag', required: false, description: 'Preview changes without renaming files' },
		{ name: '-r, --recursive', type: 'flag', required: false, description: 'Process subdirectories recursively' },
		{ name: '-v, --verbose', type: 'flag', required: false, description: 'Enable verbose debug logging' },
	],
	output: 'Console report of detected vs expected formats per file. Files with mismatched extensions are renamed in-place (unless --dry-run). Results stored in .aria/db/image-sanitiser/image-sanitiser.sqlite.',
	constraints: [
		'Sharp must be installed (automatically included via dependencies)',
		'Input path must contain image files with supported extensions (.jpg, .jpeg, .png, .gif, .bmp, .tiff, .tif, .webp)',
		'Maximum file size is 100MB by default (configurable)',
		'File rename operations use safe-move with retries to avoid data loss',
	],
	conventions: [
		'Always run analyse or --dry-run first to preview changes before sanitising',
		'Use detect for single-file inspection when debugging format issues',
		'Configuration is in config.yaml co-located in the riff directory',
		'Invocation pattern: $RIFF [command] [args]',
	],
	examples: [
		{
			description: 'Detect format of a single image file',
			command: '$RIFF detect ./image.jpg',
			outcome: 'Reports the actual format detected via magic bytes and whether the extension matches',
		},
		{
			description: 'Analyse directory for mismatched extensions (dry-run)',
			command: '$RIFF analyse -r ./images',
			outcome:
				'Scans all images recursively and reports which files have incorrect extensions without changing anything',
		},
		{
			description: 'Fix incorrect extensions in a directory',
			command: '$RIFF sanitise -r ./images',
			outcome:
				'Renames files with mismatched extensions to their correct format and records changes in the database',
		},
	],
};
