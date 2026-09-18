/**
 * SharePoint Manager -- RiffPrompt definition
 */
export const riffPrompt = {
	name: 'sharepoint-manager',
	summary: 'SharePoint link extraction from OneDrive-synced files with dual-method strategy',
	purpose:
		'Extracts SharePoint web view links from OneDrive-synced local files using two complementary methods: instant database extraction (querying OneDrive local SyncEngineDatabase.db for resourceIDs) and AppleScript UI automation (macOS fallback via Finder Copy Link). Features automatic fallback between strategies, dual storage in CSV and SQLite, batch processing with interrupt support, and a clean 3-layer architecture. Handles all special characters in filenames (apostrophes, brackets, quotes, unicode).',
	whenToUse: [
		'Building an index of SharePoint web view links for a OneDrive-synced folder',
		'Generating shareable SharePoint URLs for files stored in local OneDrive sync',
		'Processing large batches of OneDrive files to extract their SharePoint links',
		'Retrying failed link extractions with automatic fallback between database and AppleScript methods',
	],
	pipeline: [
		'Phase 1 (init): Scan OneDrive sync folder and create storage with file metadata and directory/download links',
		'Phase 2 (process): Extract web view links using configured method (database, applescript, or auto)',
		'Database method: Query SyncEngineDatabase.db for resourceID, construct SharePoint URL',
		'AppleScript method: Select file in Finder, trigger Copy Link, extract URL from clipboard',
		'Auto method: Try database first, fall back to AppleScript if needed',
		'Store results in CSV and/or SQLite with full metadata (links, status, resource IDs, timestamps)',
	],
	parameters: [
		{
			name: 'command',
			type: 'enum(init|process|status|retry-failed|setup)',
			required: true,
			description:
				'Action: init creates storage, process extracts links, status shows progress, retry-failed reprocesses failures, setup configures permissions',
		},
		{
			name: '-m, --method',
			type: 'enum(auto|database|applescript)',
			required: false,
			description: 'Extraction method (default: auto which tries database first)',
		},
		{
			name: '-b, --batch',
			type: 'number',
			required: false,
			description: 'Number of files to process in this session',
		},
		{
			name: '--output-format',
			type: 'enum(csv|sqlite|both)',
			required: false,
			description: 'Storage format (default: both)',
		},
		{ name: '--sync-folder', type: 'string', required: false, description: 'Override OneDrive sync folder path' },
		{ name: '--save-interval', type: 'number', required: false, description: 'Save progress every N files' },
		{ name: '-v, --verbose', type: 'flag', required: false, description: 'Enable verbose debug logging' },
	],
	output: 'SharePoint web view links stored in CSV (.aria/db/sharepoint-manager/sharepoint-manager.csv) and/or SQLite (.aria/db/sharepoint-manager/sharepoint-manager.sqlite). Status command shows processing progress. Each record includes file identity, generated links (download, directory view, web view), processing status, and metadata.',
	constraints: [
		'OneDrive must be installed and synced for files to be discoverable',
		'Database method requires the OneDrive SyncEngineDatabase.db path to be configured',
		'AppleScript method is macOS only and requires accessibility permissions for VS Code',
		'Files must exist in the configured OneDrive sync folder',
	],
	conventions: [
		'Always run init before process to create the file index',
		'Use --method database for fastest extraction (approximately 1ms per file)',
		'Use --method auto for reliability (database with AppleScript fallback)',
		'Run status to check progress before and after processing',
		'Configuration is in config.yaml co-located in the riff directory',
		'Invocation pattern: $RIFF [command] [options]',
	],
	examples: [
		{
			description: 'Initialize storage and scan OneDrive folder',
			command: '$RIFF init',
			outcome:
				'Creates CSV and SQLite storage with file metadata and directory/download links for all files in the sync folder',
		},
		{
			description: 'Process all pending files with database method',
			command: '$RIFF process --method database',
			outcome: 'Extracts SharePoint web view links instantly via OneDrive database queries',
		},
		{
			description: 'Process batch with automatic fallback',
			command: '$RIFF process --method auto --batch 100',
			outcome: 'Processes 100 files using database method first, falling back to AppleScript for any failures',
		},
	],
};
