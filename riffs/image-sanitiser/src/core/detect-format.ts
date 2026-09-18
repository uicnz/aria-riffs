/**
 * Image format detection using file-type library and Sharp
 */

import * as path from 'node:path';
import { fileTypeFromFile } from 'file-type';
import type { Logger } from 'pino';
import sharp from 'sharp';
import type { ImageSanitiserConfig } from '../lib/schema.js';
import { type DetectionResult, FileDetectionError, UnsupportedImageFormat } from '../lib/types.js';
import { normalizeExtension } from '../utils/utils.js';

export class ImageFormatDetector {
	private logger?: Logger;
	private config: ImageSanitiserConfig;

	constructor(config: ImageSanitiserConfig, logger?: Logger) {
		this.config = config;
		this.logger = logger;
	}

	async detectImageFormat(filePath: string): Promise<DetectionResult> {
		const originalExtension = normalizeExtension(path.extname(filePath));

		try {
			// Primary detection method: file-type (magic bytes)
			const magicBytesResult = await this.detectByMagicBytes(filePath);

			// Secondary detection method: Sharp metadata (if enabled)
			let sharpResult: DetectionResult | null = null;
			if (this.config['image-sanitiser'].detection.useSharpMetadata) {
				try {
					sharpResult = await this.detectBySharpMetadata(filePath);
				} catch (error) {
					this.logger?.warn(
						{ file: path.basename(filePath), error: String(error) },
						'Sharp metadata detection failed'
					);
				}
			}

			// Determine final result based on configuration
			const finalResult = this.reconcileDetectionResults(magicBytesResult, sharpResult, originalExtension);

			return finalResult;
		} catch (error) {
			throw new FileDetectionError(`Failed to detect format for ${filePath}: ${error}`);
		}
	}

	private async detectByMagicBytes(filePath: string): Promise<DetectionResult | null> {
		try {
			const result = await fileTypeFromFile(filePath);

			if (!result) {
				return null;
			}

			const detectedExtension = `.${result.ext}`;
			const needsRename = normalizeExtension(path.extname(filePath)) !== normalizeExtension(detectedExtension);

			return {
				detectedExtension: normalizeExtension(detectedExtension),
				detectedMimeType: result.mime,
				confidence: 'high',
				method: 'magic-bytes',
				originalExtension: normalizeExtension(path.extname(filePath)),
				needsRename,
			};
		} catch (error) {
			this.logger?.warn({ error: String(error) }, 'Magic bytes detection failed');
			return null;
		}
	}

	private async detectBySharpMetadata(filePath: string): Promise<DetectionResult | null> {
		try {
			const metadata = await sharp(filePath).metadata();

			// Extract format information from Sharp metadata
			let detectedFormat = '';
			let mimeType = '';

			if (metadata.format) {
				detectedFormat = metadata.format.toLowerCase();
				// Convert Sharp format names to extensions
				switch (detectedFormat) {
					case 'jpeg':
						detectedFormat = 'jpg';
						mimeType = 'image/jpeg';
						break;
					case 'png':
						mimeType = 'image/png';
						break;
					case 'gif':
						mimeType = 'image/gif';
						break;
					case 'webp':
						mimeType = 'image/webp';
						break;
					case 'tiff':
						mimeType = 'image/tiff';
						break;
					case 'avif':
						mimeType = 'image/avif';
						break;
					case 'heif':
						mimeType = 'image/heif';
						break;
					default:
						mimeType = `image/${detectedFormat}`;
				}
			}

			if (!detectedFormat) {
				return null;
			}

			const detectedExtension = `.${detectedFormat}`;
			const normalizedDetected = normalizeExtension(detectedExtension);
			const originalExtension = normalizeExtension(path.extname(filePath));
			const needsRename = originalExtension !== normalizedDetected;

			return {
				detectedExtension: normalizedDetected,
				detectedMimeType: mimeType,
				confidence: 'high', // Sharp metadata is very reliable
				method: 'sharp-metadata',
				originalExtension,
				needsRename,
			};
		} catch {
			// Sharp metadata reading can fail for various reasons, this is not critical
			return null;
		}
	}

	private reconcileDetectionResults(
		magicBytesResult: DetectionResult | null,
		sharpResult: DetectionResult | null,
		originalExtension: string
	): DetectionResult {
		const preferSharpOverMagic = this.config['image-sanitiser'].detection.preferSharpOverMagic;
		const strictMode = this.config['image-sanitiser'].detection.strictMode;

		// If we have both results, decide which to trust
		if (magicBytesResult && sharpResult) {
			// Check if they agree
			if (magicBytesResult.detectedExtension === sharpResult.detectedExtension) {
				return {
					...magicBytesResult,
					confidence: 'high', // Both methods agree
					method: 'magic-bytes', // Primary method
				};
			}

			// They disagree - use preference
			if (preferSharpOverMagic) {
				return {
					...sharpResult,
					confidence: 'medium', // Disagreement reduces confidence
				};
			} else {
				return {
					...magicBytesResult,
					confidence: 'medium', // Disagreement reduces confidence
				};
			}
		}

		// If only one result is available
		if (magicBytesResult) {
			return magicBytesResult;
		}

		if (sharpResult) {
			return sharpResult;
		}

		// No detection possible - return fallback result
		if (strictMode) {
			throw new UnsupportedImageFormat('Cannot detect image format and strict mode is enabled');
		}

		// Fallback: assume file extension is correct
		return {
			detectedExtension: originalExtension || '.jpg', // Default fallback
			detectedMimeType: this.getMimeTypeFromExtension(originalExtension),
			confidence: 'low',
			method: 'fallback',
			originalExtension,
			needsRename: false,
		};
	}

	private getMimeTypeFromExtension(extension: string): string {
		const extToMimeMap: Record<string, string> = {
			'.jpg': 'image/jpeg',
			'.jpeg': 'image/jpeg',
			'.png': 'image/png',
			'.gif': 'image/gif',
			'.bmp': 'image/bmp',
			'.tiff': 'image/tiff',
			'.tif': 'image/tiff',
			'.webp': 'image/webp',
		};

		return extToMimeMap[extension.toLowerCase()] || 'image/jpeg';
	}

	async cleanup(): Promise<void> {
		// Sharp doesn't require explicit cleanup like ExifRiff
		// This method is kept for compatibility
	}
}
