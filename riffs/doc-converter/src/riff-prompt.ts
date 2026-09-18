/**
 * Doc Converter -- RiffPrompt definition
 */
export const riffPrompt = {
	name: 'doc-converter',
	summary: 'DOCX to Markdown conversion with 18 Aria Rules for normalization',
	purpose:
		'Converts DOCX files to normalized Markdown through a multi-stage pipeline: Pandoc converts DOCX to HTML, cheerio preprocesses the HTML, Pandoc converts HTML to GFM Markdown, then 18 mandatory Aria Rules (AR001-AR018) normalize headings, lists, tables, images, links, and whitespace. An optional markdownlint pass is available after AR rules. This is the primary document ingestion riff for the Aria platform.',
	whenToUse: [
		'Converting Word documents (.docx) to Markdown for indexing, publishing, or further processing',
		'Normalizing inconsistent Markdown formatting with the 18 Aria Rules',
		'Batch converting entire directories of DOCX files with --dirs-recurse',
		'Cleaning up messy documents with --clean-first (Pandoc round-trip normalization)',
		'Generating lint reports or auto-fixing Markdown with --lint and --lint-fix',
	],
	pipeline: [
		'Optional pre-clean via Pandoc DOCX-to-DOCX round-trip (--clean-first)',
		'DOCX to HTML5 via Pandoc with --extract-media, --wrap=none, --standalone',
		'Extract and rename media files to {docxname}-{N}.{ext}',
		'Update image references in HTML to match renamed media',
		'HTML preprocessing via cheerio: convert links and tables to Markdown syntax',
		'HTML to Markdown via Pandoc GFM with --wrap=none',
		'Apply 18 AR rules in fixed order across 4 phases: initial cleanup, basic formatting, structural, final polish',
		'Optional markdownlint report or auto-fix',
		'Add .gitkeep files to intermediate directories (default behavior)',
	],
	parameters: [
		{
			name: 'input',
			type: 'string',
			required: true,
			description: 'Path to source DOCX file or directory of DOCX files',
		},
		{
			name: 'output',
			type: 'string',
			required: true,
			description: 'Path for output Markdown file or output directory',
		},
		{
			name: '--type',
			type: 'enum(docx|pptx|xlsx|auto)',
			required: false,
			description: 'Document type, defaults to auto-detect',
		},
		{
			name: '--clean-first',
			type: 'flag',
			required: false,
			description: 'Run Pandoc DOCX-to-DOCX round-trip to normalize before conversion',
		},
		{ name: '--lint', type: 'flag', required: false, description: 'Run markdownlint validation after AR rules' },
		{
			name: '--lint-fix',
			type: 'flag',
			required: false,
			description: 'Auto-fix markdownlint issues after AR rules',
		},
		{
			name: '--lint-config',
			type: 'string',
			required: false,
			description: 'Path to custom .markdownlintrc configuration',
		},
		{
			name: '--in-place',
			type: 'flag',
			required: false,
			description: 'Export next to source document (single files only)',
		},
		{ name: '--dirs-recurse', type: 'flag', required: false, description: 'Traverse subdirectories recursively' },
		{
			name: '--dirs-preserve',
			type: 'flag',
			required: false,
			description: 'Preserve source directory hierarchy in output (requires --dirs-recurse)',
		},
		{
			name: '--no-gitkeep',
			type: 'flag',
			required: false,
			description: 'Disable .gitkeep file generation in intermediate directories',
		},
		{ name: '--config', type: 'string', required: false, description: 'Path to YAML or JSON configuration file' },
	],
	output: 'Markdown file(s) at the specified output path. Each DOCX produces one .md file. Media files are extracted and renamed alongside the Markdown. If --lint is used, a lint report is written to stdout. If --in-place is used, output is placed in a directory next to the source file (e.g., sources/my-doc/my-doc.md).',
	constraints: [
		'Pandoc must be installed and on PATH (verify with: pandoc --version)',
		'Input must be a valid DOCX file or a directory containing DOCX files',
		'Output parent directory must exist',
		'Only DOCX is currently supported (PPTX and XLSX are not implemented)',
		'AR rules are applied in a fixed order and cannot be reordered',
		'Individual AR rules can be toggled on/off via config.yaml but the order is immutable',
	],
	conventions: [
		'Always use absolute paths for input and output',
		'Use --clean-first for documents with accumulated formatting cruft or complex styling from multiple editors',
		'Use --lint-fix for best results on first conversion',
		'Use --dirs-recurse --dirs-preserve for batch conversions that need to maintain source hierarchy',
		'Configuration is in config.yaml co-located in the riff directory',
		'Individual AR rules can be disabled in the ariaRules.rules section of config.yaml',
		'Invocation pattern: $RIFF [args]',
	],
	examples: [
		{
			description: 'Convert a single DOCX to Markdown',
			command: '$RIFF sources/proposal.docx .aria/exports/doc-converter/proposal.md',
			outcome: 'Creates proposal.md with normalized Markdown and extracted media alongside it',
		},
		{
			description: 'Convert in-place next to source',
			command: '$RIFF sources/my-doc.docx --in-place',
			outcome: 'Creates sources/my-doc/my-doc.md with media in the same directory',
		},
		{
			description: 'Batch convert directory preserving structure',
			command: '$RIFF sources/rfp/ vault/ --dirs-recurse --dirs-preserve',
			outcome: 'Converts all DOCX files in sources/rfp/ mirroring the directory structure into vault/',
		},
		{
			description: 'Convert with auto-fix linting',
			command: '$RIFF sources/messy.docx output.md --lint --lint-fix',
			outcome: 'Creates output.md with AR rules applied, then markdownlint auto-fixes remaining issues',
		},
	],
};
