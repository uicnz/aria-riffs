---
name: sharepoint-manager
description: SharePoint link extraction from OneDrive-synced files with dual-method strategy
---

# Sharepoint Manager

## Purpose

Extracts SharePoint web view links from OneDrive-synced local files using two complementary methods: instant database extraction (querying OneDrive local SyncEngineDatabase.db for resourceIDs) and AppleScript UI automation (macOS fallback via Finder Copy Link). Features automatic fallback between strategies, dual storage in CSV and SQLite, batch processing with interrupt support, and a clean 3-layer architecture. Handles all special characters in filenames (apostrophes, brackets, quotes, unicode).

## When to use

- Building an index of SharePoint web view links for a OneDrive-synced folder
- Generating shareable SharePoint URLs for files stored in local OneDrive sync
- Processing large batches of OneDrive files to extract their SharePoint links
- Retrying failed link extractions with automatic fallback between database and AppleScript methods

## Pipeline

1. Phase 1 (init): Scan OneDrive sync folder and create storage with file metadata and directory/download links
2. Phase 2 (process): Extract web view links using configured method (database, applescript, or auto)
3. Database method: Query SyncEngineDatabase.db for resourceID, construct SharePoint URL
4. AppleScript method: Select file in Finder, trigger Copy Link, extract URL from clipboard
5. Auto method: Try database first, fall back to AppleScript if needed
6. Store results in CSV and/or SQLite with full metadata (links, status, resource IDs, timestamps)

## Parameters

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `command` | `enum(init\|process\|status\|retry-failed\|setup)` | yes | Action: init creates storage, process extracts links, status shows progress, retry-failed reprocesses failures, setup configures permissions |
| `-m, --method` | `enum(auto\|database\|applescript)` | no | Extraction method (default: auto which tries database first) |
| `-b, --batch` | `number` | no | Number of files to process in this session |
| `--output-format` | `enum(csv\|sqlite\|both)` | no | Storage format (default: both) |
| `--sync-folder` | `string` | no | Override OneDrive sync folder path |
| `--save-interval` | `number` | no | Save progress every N files |
| `-v, --verbose` | `flag` | no | Enable verbose debug logging |

## Output

SharePoint web view links stored in CSV (.aria/db/sharepoint-manager/sharepoint-manager.csv) and/or SQLite (.aria/db/sharepoint-manager/sharepoint-manager.sqlite). Status command shows processing progress. Each record includes file identity, generated links (download, directory view, web view), processing status, and metadata.

## Constraints

- OneDrive must be installed and synced for files to be discoverable
- Database method requires the OneDrive SyncEngineDatabase.db path to be configured
- AppleScript method is macOS only and requires accessibility permissions for VS Code
- Files must exist in the configured OneDrive sync folder

## Conventions

- Always run init before process to create the file index
- Use --method database for fastest extraction (approximately 1ms per file)
- Use --method auto for reliability (database with AppleScript fallback)
- Run status to check progress before and after processing
- Configuration is in config.yaml co-located in the riff directory
- Invocation pattern: $RIFF [command] [options]

## Examples

### Initialize storage and scan OneDrive folder

```sh
$RIFF init
```

Creates CSV and SQLite storage with file metadata and directory/download links for all files in the sync folder

### Process all pending files with database method

```sh
$RIFF process --method database
```

Extracts SharePoint web view links instantly via OneDrive database queries

### Process batch with automatic fallback

```sh
$RIFF process --method auto --batch 100
```

Processes 100 files using database method first, falling back to AppleScript for any failures
