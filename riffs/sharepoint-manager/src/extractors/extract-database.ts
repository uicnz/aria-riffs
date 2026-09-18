/**
 * SharePoint link extraction using OneDrive local database
 */

import * as fs from 'node:fs';
import { homedir } from 'node:os';
import * as path from 'node:path';
import Database from 'libsql';
import { BaseExtractor, type ExtractionResult } from './define-extractor.js';

/**
 * Known Microsoft Office type codes
 */
const TYPE_CODE_MAP: Record<string, { code: string; usesResourceId: boolean }> = {
	'.docx': { code: 'w', usesResourceId: true },
	'.doc': { code: 'w', usesResourceId: true },
	'.dotx': { code: 'w', usesResourceId: true },
	'.dotm': { code: 'w', usesResourceId: true },
	'.xlsx': { code: 'x', usesResourceId: true },
	'.xls': { code: 'x', usesResourceId: true },
	'.xlsm': { code: 'x', usesResourceId: true },
	'.pptx': { code: 'p', usesResourceId: true },
	'.vsdx': { code: 'u', usesResourceId: true },
	'.vsd': { code: 'u', usesResourceId: true },
	'.png': { code: 'i', usesResourceId: true },
	'.jpg': { code: 'i', usesResourceId: true },
	'.jpeg': { code: 'i', usesResourceId: true },
	'.gif': { code: 'i', usesResourceId: true },
	'.bmp': { code: 'i', usesResourceId: true },
	'.webp': { code: 'i', usesResourceId: true },
	'.heic': { code: 'i', usesResourceId: true },
	'.avif': { code: 'i', usesResourceId: true },
	'.svg': { code: 'i', usesResourceId: true },
	'.pdf': { code: 'b', usesResourceId: false },
};

/**
 * OneDrive database record structure
 */
interface OneDriveRecord {
	resourceID: string;
	parentResourceID?: string;
	eTag?: string;
}

/**
 * Database extractor - Extracts SharePoint links from OneDrive local database
 */
export class DatabaseExtractor extends BaseExtractor {
	private db: Database.Database | undefined;

	async validate(): Promise<boolean> {
		if (!this.config.oneDriveDbPath) {
			return false;
		}

		const expandedPath = this.config.oneDriveDbPath.replace(/^~/, homedir());
		return fs.existsSync(expandedPath);
	}

	getName(): string {
		return 'database';
	}

	async extract(filePath: string): Promise<ExtractionResult> {
		try {
			// Ensure database connection
			if (!this.db) {
				const expandedPath = this.config.oneDriveDbPath?.replace(/^~/, homedir());
				if (!expandedPath) {
					throw new Error('oneDriveDbPath is not configured');
				}
				this.db = new Database(expandedPath, { readonly: true });
			}

			// Extract filename and extension
			// Normalize to NFC to match OneDrive database encoding
			const fileName = path.basename(filePath).normalize('NFC');
			const fileExt = path.extname(filePath).toLowerCase();

			// Query for resourceID
			const row = this.db
				.prepare('SELECT resourceID, parentResourceID, eTag FROM od_ClientFile_Records WHERE fileName = ?')
				.get(fileName) as OneDriveRecord | undefined;

			if (!row) {
				return {
					url: null,
					error: 'File not found in OneDrive sync database',
					method: 'database',
				};
			}

			// Get type info or default to universal
			const typeInfo = TYPE_CODE_MAP[fileExt] || { code: 'u', usesResourceId: false };

			// Construct SharePoint URL
			const url = this.buildSharePointUrl(filePath, row.resourceID, typeInfo);

			const result: ExtractionResult = {
				url,
				method: 'database',
				resourceId: row.resourceID,
			};

			if (row.parentResourceID) result.parentResourceId = row.parentResourceID;
			if (row.eTag) result.etag = row.eTag;

			return result;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			return {
				url: null,
				error: `Database extraction failed: ${errorMessage}`,
				method: 'database',
			};
		}
	}

	/**
	 * Construct SharePoint URL from resourceID and file path
	 */
	private buildSharePointUrl(
		filePath: string,
		resourceId: string,
		typeInfo: { code: string; usesResourceId: boolean }
	): string {
		if (!this.config.syncFolder) {
			throw new Error('syncFolder must be configured for database extraction');
		}
		if (!this.config.sharePointBase) {
			throw new Error('sharePointBase must be configured for database extraction');
		}
		if (!this.config.sharePointWebBasePath) {
			throw new Error('sharePointWebBasePath must be configured for database extraction');
		}

		// Get relative path from sync folder
		const relativePath = path.relative(this.config.syncFolder, filePath);
		const encodedRelativePath = encodeURIComponent(relativePath).replace(/%2F/g, '/');

		// Extract domain from sharePointBase
		const baseUrl = new URL(this.config.sharePointBase);
		const domain = baseUrl.origin;

		// Combine web base path with relative path
		const fullPath = `${this.config.sharePointWebBasePath}/${encodedRelativePath}`;

		// Add d= parameter only for types that use resourceID
		const resourceParam = typeInfo.usesResourceId ? `d=w${resourceId}&` : '';

		return `${domain}/:${typeInfo.code}:/r/${fullPath}?${resourceParam}csf=1&web=1&e=auto`;
	}

	/**
	 * Close database connection
	 */
	cleanup(): void {
		if (this.db) {
			this.db.close();
			this.db = undefined;
		}
	}
}
