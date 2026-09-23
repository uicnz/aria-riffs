import { join } from 'node:path';
import type { AspectRatio, ImageGenerationConfig, ImageSize } from '../lib/types.js';

/**
 * Output configuration for resolving output paths
 */
export interface OutputConfig {
	filenamePattern: string;
	timestampFormat: string;
}

/**
 * Build Gemini image generation config with optional parameters
 */
export function buildImageConfig(
	aspectRatio?: AspectRatio,
	imageSize?: ImageSize,
	googleSearch = false
): ImageGenerationConfig {
	const config: ImageGenerationConfig = {
		responseModalities: ['TEXT', 'IMAGE'],
	};

	if (aspectRatio || imageSize) {
		config.imageConfig = {};
		if (aspectRatio) {
			config.imageConfig.aspectRatio = aspectRatio;
		}
		if (imageSize) {
			config.imageConfig.imageSize = imageSize;
		}
	}

	if (googleSearch) {
		config.riffs = [{ googleSearch: {} }];
	}

	return config;
}

/**
 * Format a timestamp string using a pattern
 * Supports: YYYY (year), MM (month), DD (day), HH (hour), mm (minute), ss (second)
 */
function formatTimestamp(format: string = 'YYYY-MM-DD_HH-mm-ss'): string {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, '0');
	const day = String(now.getDate()).padStart(2, '0');
	const hours = String(now.getHours()).padStart(2, '0');
	const minutes = String(now.getMinutes()).padStart(2, '0');
	const seconds = String(now.getSeconds()).padStart(2, '0');

	return format
		.replace('YYYY', String(year))
		.replace('MM', month)
		.replace('DD', day)
		.replace('HH', hours)
		.replace('mm', minutes)
		.replace('ss', seconds);
}

/**
 * Generate a filename from a pattern template
 * Uses config pattern with {timestamp} and {operation} placeholders
 */
function generateFilename(operation: string, pattern: string, timestampFormat: string): string {
	const timestamp = formatTimestamp(timestampFormat);
	return pattern.replace('{timestamp}', timestamp).replace('{operation}', operation);
}

/**
 * Resolve output path with priority:
 * 1. Explicit path (if provided)
 * 2. outputDirFlag + auto-generated filename
 * 3. defaultDir + auto-generated filename
 *
 * @param explicitPath - Explicit output path from CLI argument
 * @param outputDirFlag - Output directory from --output-dir flag
 * @param config - Output config with filenamePattern, timestampFormat
 * @param defaultDir - Default output directory from paths config
 * @param operation - Operation name for filename (generate, edit, compose)
 * @param counter - Optional counter for batch mode (appends _1, _2, etc.)
 * @returns Resolved output path
 */
export function resolveOutputPath(
	explicitPath: string | undefined,
	outputDirFlag: string | undefined,
	config: OutputConfig,
	defaultDir: string,
	operation: string,
	counter?: number
): string {
	// Priority 1: Explicit path provided
	if (explicitPath) {
		// For batch mode with explicit path, append counter before extension
		if (counter !== undefined) {
			const lastDot = explicitPath.lastIndexOf('.');
			if (lastDot > 0) {
				return `${explicitPath.slice(0, lastDot)}_${counter}${explicitPath.slice(lastDot)}`;
			}
			return `${explicitPath}_${counter}`;
		}
		return explicitPath;
	}

	// Generate filename from pattern
	let filename = generateFilename(operation, config.filenamePattern, config.timestampFormat);

	// Append counter for batch mode
	if (counter !== undefined) {
		filename = `${filename}_${counter}`;
	}

	// Add .png extension (default format)
	filename = `${filename}.png`;

	// Priority 2: outputDirFlag provided
	// Priority 3: Fall back to defaultDir
	const directory = outputDirFlag ?? defaultDir;

	return join(directory, filename);
}
