/**
 * SharePoint Manager - Core business logic for file tracking and link extraction
 */

import type { Logger } from 'pino';
import { csvExists, loadRecords as loadCsvRecords, saveRecords as saveCsvRecords } from '../db/store-csv.js';
import {
	loadRecords as loadSqliteRecords,
	saveRecords as saveSqliteRecords,
	sqliteExists,
} from '../db/store-sqlite.js';
import {
	AppleScriptExtractor,
	DatabaseExtractor,
	ExtractionOrchestrator,
	type ExtractorConfig,
} from '../extractors/index.js';
import type { SharepointManagerRiffConfig } from '../lib/schema.js';
import type { FileRecord } from '../lib/types.js';
import { scanFiles } from './scan-files.js';

/**
 * Main manager for SharePoint file tracking and link extraction workflow
 */
export class SharepointManager {
	private records: FileRecord[] = [];
	private config: SharepointManagerRiffConfig;
	private orchestrator: ExtractionOrchestrator;
	private logger: Logger;

	constructor(config: SharepointManagerRiffConfig, logger: Logger, method?: 'auto' | 'database' | 'applescript') {
		this.config = config;
		this.logger = logger;

		const effectiveMethod = method ?? config.database.method;

		// Configure extractors
		const extractorConfig: ExtractorConfig = {
			extractionDelay: config.links.extractionDelay,
			oneDriveDbPath: config.paths.input.onedriveDb,
			sharePointBase: config.links.sharePointBase,
			sharePointWebBasePath: config.database.sharePointWebBasePath,
			syncFolder: config.paths.input.onedrive,
		};

		// Create extractors array (database first for speed, AppleScript as fallback)
		const extractors = [];

		// Add database extractor if configured
		if (config.paths.input.onedriveDb && config.database.sharePointWebBasePath) {
			extractors.push(new DatabaseExtractor(extractorConfig));
		}

		// Always add AppleScript extractor
		extractors.push(new AppleScriptExtractor(extractorConfig));

		// Create orchestrator with specified method
		this.orchestrator = new ExtractionOrchestrator(effectiveMethod, extractors, true, logger);
	}

	/**
	 * Initial scan - creates master file with all columns except web view links
	 */
	async initialScan(): Promise<void> {
		this.records = await scanFiles(this.config.paths.input.onedrive, this.config.links.sharePointBase, this.logger);
		await this.saveRecords();
		this.logger.debug({ outputFormat: this.config.output.format }, `Output format: ${this.config.output.format}`);
		if (this.config.output.format === 'csv' || this.config.output.format === 'both') {
			this.logger.debug(
				{ csvFile: this.config.paths.output.index },
				`CSV file: ${this.config.paths.output.index}`
			);
		}
		if (this.config.output.format === 'sqlite' || this.config.output.format === 'both') {
			this.logger.debug(
				{ sqliteDb: this.config.paths.database.file },
				`SQLite database: ${this.config.paths.database.file}`
			);
		}
	}

	/**
	 * Load records from storage
	 */
	async loadRecords(): Promise<void> {
		const format = this.config.output.format;

		if (format === 'csv') {
			this.records = await loadCsvRecords(this.config.paths.output.index);
		} else if (format === 'sqlite') {
			this.records = await loadSqliteRecords(this.config.paths.database.file);
		} else if (format === 'both') {
			// Prefer SQLite if both exist, fall back to CSV
			if (sqliteExists(this.config.paths.database.file)) {
				this.records = await loadSqliteRecords(this.config.paths.database.file);
			} else if (csvExists(this.config.paths.output.index)) {
				this.records = await loadCsvRecords(this.config.paths.output.index);
			}
		}
	}

	/**
	 * Save records to storage
	 */
	async saveRecords(): Promise<void> {
		const format = this.config.output.format;

		if (format === 'csv' || format === 'both') {
			await saveCsvRecords(this.config.paths.output.index, this.records);
		}

		if (format === 'sqlite' || format === 'both') {
			await saveSqliteRecords(this.config.paths.database.file, this.records);
		}
	}

	/**
	 * Check if storage exists
	 */
	storageExists(): boolean {
		const format = this.config.output.format;

		if (format === 'csv') {
			return csvExists(this.config.paths.output.index);
		} else if (format === 'sqlite') {
			return sqliteExists(this.config.paths.database.file);
		} else {
			return csvExists(this.config.paths.output.index) || sqliteExists(this.config.paths.database.file);
		}
	}

	/**
	 * Update web view links incrementally
	 */
	async updateWebViewLinks(maxUpdates?: number): Promise<void> {
		const pending = this.records.filter(
			r =>
				r.web_view_status === 'pending' ||
				r.web_view_status === 'failed' ||
				!r.web_view_link ||
				r.web_view_link === ''
		);

		if (pending.length === 0) {
			this.logger.info({}, 'All web view links are already complete');
			return;
		}

		this.logger.info({ pendingCount: pending.length }, 'Phase 2: Web View Link Extraction');

		const toProcess = maxUpdates ? pending.slice(0, maxUpdates) : pending;
		const estimatedSeconds = Math.round(toProcess.length * 2.5);
		const estimatedMinutes = (toProcess.length * 2.5) / 60;

		this.logger.info(
			{ batchSize: toProcess.length, estimatedSeconds, estimatedMinutes: estimatedMinutes.toFixed(1) },
			`Processing batch of ${toProcess.length} files`
		);

		let completed = 0;

		// Handle Ctrl+C gracefully
		process.on('SIGINT', async () => {
			this.logger.warn({}, 'Interrupted by user - saving progress...');
			try {
				await this.saveRecords();
				this.showSummary();
				this.logger.warn({}, 'Gracefully interrupted. Progress saved.');
				process.exit(0);
			} catch (error) {
				this.logger.error(
					{ error: error instanceof Error ? error.message : String(error) },
					'ERROR saving progress during interrupt'
				);
				process.exit(1);
			}
		});

		for (const record of toProcess) {
			completed++;
			this.logger.debug(
				{ current: completed, total: toProcess.length, fileName: record.name.slice(0, 50) },
				`Processing [${completed}/${toProcess.length}] ${record.name.slice(0, 50)}`
			);

			const result = await this.orchestrator.extract(record.full_path);

			if (result.url) {
				record.web_view_link = result.url;
				record.web_view_status = 'completed';
				if ('error_message' in record) delete record.error_message;
				if (result.method) record.extraction_method = result.method;
				if (result.resourceId) record.resource_id = result.resourceId;
				if (result.parentResourceId) record.parent_resource_id = result.parentResourceId;
				if (result.etag) record.etag = result.etag;
				this.logger.info({ fileName: record.name, method: result.method }, `COMPLETED (${result.method})`);
			} else {
				record.web_view_status = 'failed';
				record.error_message = result.error || 'Unknown error';
				this.logger.error(
					{ fileName: record.name, error: result.error },
					`ERROR: ${result.error || 'Unknown error'}`
				);
			}

			// Save progress every N files
			if (completed % this.config.output.saveInterval === 0) {
				await this.saveRecords();
				this.logger.debug(
					{ processed: completed, remaining: toProcess.length - completed },
					`Progress saved: ${completed} processed, ${toProcess.length - completed} remaining`
				);
			}
		}

		await this.saveRecords();
		this.showSummary();
	}

	/**
	 * Show progress summary
	 */
	showSummary(): void {
		const completed = this.records.filter(r => r.web_view_status === 'completed').length;
		const pending = this.records.filter(r => r.web_view_status === 'pending').length;
		const failed = this.records.filter(r => r.web_view_status === 'failed').length;
		const total = this.records.length;

		const completedPct = total > 0 ? ((completed / total) * 100).toFixed(1) : '0.0';
		const pendingPct = total > 0 ? ((pending / total) * 100).toFixed(1) : '0.0';
		const estimatedMinutes = ((pending * 2.5) / 60).toFixed(1);

		this.logger.info(
			{
				completed,
				pending,
				failed,
				total,
				completedPct,
				pendingPct,
				estimatedMinutes: pending > 0 ? estimatedMinutes : null,
			},
			`PROGRESS SUMMARY - Completed: ${completed}/${total} (${completedPct}%), Pending: ${pending}, Failed: ${failed}`
		);
	}

	/**
	 * Show current status
	 */
	async showStatus(): Promise<void> {
		if (!this.storageExists()) {
			this.logger.warn({}, 'No data found. Run with init command first.');
			return;
		}

		await this.loadRecords();

		this.logger.info(
			{
				storageFormat: this.config.output.format,
				csvFile:
					this.config.output.format === 'csv' || this.config.output.format === 'both'
						? this.config.paths.output.index
						: undefined,
				sqliteDb:
					this.config.output.format === 'sqlite' || this.config.output.format === 'both'
						? this.config.paths.database.file
						: undefined,
				totalFiles: this.records.length,
			},
			`Status: ${this.records.length} files in ${this.config.output.format} storage`
		);
		this.showSummary();
	}

	/**
	 * Retry failed links
	 */
	async retryFailed(): Promise<void> {
		await this.loadRecords();

		const failedCount = this.records.filter(r => r.web_view_status === 'failed').length;
		if (failedCount > 0) {
			this.logger.info({ failedCount }, `Resetting ${failedCount} failed files to pending`);
			this.records.forEach(r => {
				if (r.web_view_status === 'failed') {
					r.web_view_status = 'pending';
				}
			});
			await this.saveRecords();
		}
	}
}
