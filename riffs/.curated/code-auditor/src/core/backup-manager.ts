/**
 * Aria Code Auditor Backup Manager - Handle backup creation and restoration
 */

import { existsSync, promises as fs } from 'node:fs';
import path from 'node:path';
import type { Logger } from 'pino';
import type { BackupInfo, ValidationResult } from '../lib/types.js';

const BACKUP_FILES = ['package.json', 'package-lock.json', 'npm-shrinkwrap.json'];

// TODO: create BackupManager class to encapsulate these functions. Holds backupDir as state.
// Perhaps also keep backupCount as state.

/**
 * Create backup of package files before updates
 */
export async function createBackup(
	backupDir: string,
	logger: Logger,
	projectDir: string = process.cwd()
): Promise<BackupInfo> {
	const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
	const backupPath = path.join(backupDir, `backup-${timestamp}`);

	const backupInfo: BackupInfo = {
		path: backupPath,
		timestamp,
		files: [],
		created: false,
	};

	try {
		// Ensure backup directory exists
		await fs.mkdir(backupPath, { recursive: true });
		logger.debug({ backupPath }, 'Creating backup');

		// Copy each backup file if it exists
		for (const fileName of BACKUP_FILES) {
			const sourcePath = path.join(projectDir, fileName);

			if (existsSync(sourcePath)) {
				const destPath = path.join(backupPath, fileName);
				await fs.copyFile(sourcePath, destPath);
				backupInfo.files.push(fileName);
				logger.debug({ fileName }, 'Backed up file');
			}
		}

		if (backupInfo.files.length > 0) {
			backupInfo.created = true;
			logger.info({ fileCount: backupInfo.files.length }, 'Backup created successfully');
		} else {
			logger.warn('No backup files found to copy');
		}
	} catch (error) {
		logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Error creating backup');
		backupInfo.created = false;
	}

	return backupInfo;
}

/**
 * Restore from backup
 */
export async function restoreFromBackup(
	backupPath: string,
	logger: Logger,
	projectDir: string = process.cwd()
): Promise<boolean> {
	try {
		logger.debug({ backupPath }, 'Restoring from backup');

		if (!existsSync(backupPath)) {
			logger.error({ backupPath }, 'Backup directory not found');
			return false;
		}

		let restoredCount = 0;

		// Restore each backup file
		for (const fileName of BACKUP_FILES) {
			const backupFilePath = path.join(backupPath, fileName);
			const destPath = path.join(projectDir, fileName);

			if (existsSync(backupFilePath)) {
				await fs.copyFile(backupFilePath, destPath);
				restoredCount++;
				logger.debug({ fileName }, 'Restored file');
			}
		}

		if (restoredCount > 0) {
			logger.info({ restoredCount }, 'Backup restored successfully');
			return true;
		} else {
			logger.warn('No files found in backup to restore');
			return false;
		}
	} catch (error) {
		logger.error(
			{ error: error instanceof Error ? error.message : 'Unknown error' },
			'Error restoring from backup'
		);
		return false;
	}
}

/**
 * List available backups
 */
export async function listBackups(backupDir: string, logger: Logger): Promise<string[]> {
	try {
		if (!existsSync(backupDir)) {
			return [];
		}

		const entries = await fs.readdir(backupDir);
		const backupDirs = [];

		for (const entry of entries) {
			const entryPath = path.join(backupDir, entry);
			const stats = await fs.stat(entryPath);

			if (stats.isDirectory() && entry.startsWith('backup-')) {
				backupDirs.push(entryPath);
			}
		}

		return backupDirs.sort().reverse(); // Most recent first
	} catch (error) {
		logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Error listing backups');
		return [];
	}
}

/**
 * Get the most recent backup
 */
export async function getMostRecentBackup(backupDir: string, logger: Logger): Promise<string | null> {
	const backups = await listBackups(backupDir, logger);
	return backups.length > 0 ? backups[0] : null;
}

/**
 * Clean old backups (keep only the most recent N backups)
 */
export async function cleanOldBackups(backupDir: string, logger: Logger, keepCount: number = 5): Promise<number> {
	try {
		const backups = await listBackups(backupDir, logger);

		if (backups.length <= keepCount) {
			return 0; // Nothing to clean
		}

		const backupsToDelete = backups.slice(keepCount);
		let deletedCount = 0;

		for (const backupPath of backupsToDelete) {
			try {
				await fs.rm(backupPath, { recursive: true, force: true });
				deletedCount++;
				logger.debug({ backup: path.basename(backupPath) }, 'Cleaned old backup');
			} catch (error) {
				logger.warn(
					{ backupPath, error: error instanceof Error ? error.message : 'Unknown error' },
					'Failed to delete backup'
				);
			}
		}

		if (deletedCount > 0) {
			logger.info({ deletedCount }, 'Cleaned old backups');
		}

		return deletedCount;
	} catch (error) {
		logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Error cleaning old backups');
		return 0;
	}
}

/**
 * Validate backup integrity
 */
export async function validateBackup(backupPath: string): Promise<ValidationResult> {
	const result: ValidationResult = {
		valid: true,
		errors: [],
		warnings: [],
	};

	try {
		if (!existsSync(backupPath)) {
			result.valid = false;
			result.errors.push(`Backup directory not found: ${backupPath}`);
			return result;
		}

		// Check if backup contains at least package.json
		const packageJsonPath = path.join(backupPath, 'package.json');
		if (!existsSync(packageJsonPath)) {
			result.valid = false;
			result.errors.push('Backup does not contain package.json');
		}

		// Check if files are readable
		for (const fileName of BACKUP_FILES) {
			const filePath = path.join(backupPath, fileName);
			if (existsSync(filePath)) {
				try {
					await fs.access(filePath, fs.constants.R_OK);
				} catch {
					result.valid = false;
					result.errors.push(`Cannot read backup file: ${fileName}`);
				}
			}
		}

		// Warn if no lock file is present
		const hasLockFile =
			existsSync(path.join(backupPath, 'package-lock.json')) ||
			existsSync(path.join(backupPath, 'npm-shrinkwrap.json'));

		if (!hasLockFile) {
			result.warnings.push('Backup does not contain lock file - dependency versions may not be exact');
		}
	} catch (error) {
		result.valid = false;
		result.errors.push(`Error validating backup: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}

	return result;
}

/**
 * Get backup information
 */
export async function getBackupInfo(backupPath: string, logger: Logger): Promise<BackupInfo | null> {
	try {
		if (!existsSync(backupPath)) {
			return null;
		}

		const stats = await fs.stat(backupPath);
		const files: string[] = [];

		// Check which backup files exist
		for (const fileName of BACKUP_FILES) {
			const filePath = path.join(backupPath, fileName);
			if (existsSync(filePath)) {
				files.push(fileName);
			}
		}

		return {
			path: backupPath,
			timestamp: stats.mtime.toISOString(),
			files,
			created: true,
		};
	} catch (error) {
		logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Error getting backup info');
		return null;
	}
}
