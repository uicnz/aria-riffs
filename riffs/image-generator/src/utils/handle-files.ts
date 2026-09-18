import { constants } from 'node:fs';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Logger } from 'pino';

/**
 * Verify a file exists and is readable
 */
export async function verifyFileExists(filePath: string, logger?: Logger): Promise<void> {
	try {
		await access(filePath, constants.R_OK);
		logger?.debug({ filePath }, 'File access verified');
	} catch {
		throw new Error(`File not found or not readable: ${filePath}`);
	}
}

/**
 * Get MIME type from file extension
 */
function getMimeType(filePath: string): string {
	const extension = filePath.toLowerCase();
	if (extension.endsWith('.png')) return 'image/png';
	if (extension.endsWith('.jpg') || extension.endsWith('.jpeg')) return 'image/jpeg';
	if (extension.endsWith('.webp')) return 'image/webp';
	if (extension.endsWith('.gif')) return 'image/gif';
	return 'image/png'; // default
}

/**
 * Load an image file as base64 with MIME type detection
 */
export async function loadImageAsBase64(
	filePath: string,
	logger?: Logger
): Promise<{ data: string; mimeType: string; size: number }> {
	const imageBuffer = await readFile(filePath);
	const imageBase64 = imageBuffer.toString('base64');
	const mimeType = getMimeType(filePath);

	logger?.debug({ filePath, mimeType, size: imageBuffer.length }, 'Image loaded as base64');

	return {
		data: imageBase64,
		mimeType,
		size: imageBuffer.length,
	};
}

/**
 * Save a Buffer to disk as an image file
 */
export async function saveImageBuffer(imageData: Buffer, outputPath: string, logger?: Logger): Promise<void> {
	await mkdir(dirname(outputPath), { recursive: true });
	await writeFile(outputPath, imageData);
	logger?.debug({ outputPath, size: imageData.length }, 'Image saved');
}
