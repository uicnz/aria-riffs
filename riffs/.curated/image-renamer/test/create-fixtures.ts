#!/usr/bin/env bun

/**
 * Script to create test image fixtures for the image processor test suite.
 *
 * This script generates various test images in different formats, sizes, and conditions
 * to support comprehensive testing of the image processing functionality.
 */

import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'fs-extra';
import sharp from 'sharp';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface TestImage {
	filename: string;
	size: [number, number];
	color: string | null;
	format: 'jpeg' | 'png' | 'gif' | 'bmp';
}

/**
 * Create all test image fixtures
 */
async function createTestImages(): Promise<void> {
	// Create test images directory - go up one level from helpers to test root
	const fixturesDir = path.join(__dirname, 'fixtures', 'sample-images');
	await fs.ensureDir(fixturesDir);

	console.log(`Creating test images in: ${fixturesDir}`);

	// Define test images to create
	const testImages: TestImage[] = [
		// Standard test images
		{ filename: 'small_red.jpg', size: [50, 50], color: 'red', format: 'jpeg' },
		{ filename: 'small_green.png', size: [50, 50], color: 'green', format: 'png' },
		{ filename: 'small_blue.gif', size: [50, 50], color: 'blue', format: 'gif' },
		{ filename: 'medium_yellow.jpg', size: [200, 200], color: 'yellow', format: 'jpeg' },
		{ filename: 'tiny_white.png', size: [10, 10], color: 'white', format: 'png' },
		{ filename: 'landscape.jpg', size: [300, 200], color: 'purple', format: 'jpeg' },
		{ filename: 'portrait.png', size: [150, 250], color: 'orange', format: 'png' },
		// Additional test images for variety
		{ filename: 'square_black.bmp', size: [100, 100], color: 'black', format: 'bmp' },
		{ filename: 'wide_cyan.png', size: [400, 100], color: 'cyan', format: 'png' },
		{ filename: 'tall_magenta.jpg', size: [100, 400], color: 'magenta', format: 'jpeg' },
		{ filename: 'gradient_test.png', size: [150, 150], color: null, format: 'png' }, // Special gradient
	];

	let createdCount = 0;

	for (const testImage of testImages) {
		const imagePath = path.join(fixturesDir, testImage.filename);

		try {
			let imageBuffer: Buffer;

			if (testImage.filename === 'gradient_test.png') {
				// Create a gradient image for more complex testing
				imageBuffer = await createGradientImage(testImage.size);
			} else {
				// Create solid color image
				const colorRgb = getColorRgb(testImage.color || 'gray');
				imageBuffer = await sharp({
					create: {
						width: testImage.size[0],
						height: testImage.size[1],
						channels: 3,
						background: { r: colorRgb.r, g: colorRgb.g, b: colorRgb.b },
					},
				})
					.png()
					.toBuffer();
			}

			// Convert to target format and save
			let finalBuffer: Buffer;
			if (testImage.format === 'jpeg') {
				finalBuffer = await sharp(imageBuffer).jpeg({ quality: 95 }).toBuffer();
			} else if (testImage.format === 'png') {
				finalBuffer = await sharp(imageBuffer).png().toBuffer();
			} else if (testImage.format === 'gif') {
				// Sharp doesn't support GIF output, so convert to PNG and rename
				finalBuffer = await sharp(imageBuffer).png().toBuffer();
			} else if (testImage.format === 'bmp') {
				// Sharp doesn't support BMP output, so we'll create a minimal BMP header
				finalBuffer = await createBmpImage(testImage.size, getColorRgb(testImage.color || 'gray'));
			} else {
				finalBuffer = imageBuffer;
			}

			await fs.writeFile(imagePath, finalBuffer);
			console.log(
				`Created ${testImage.filename} - ${testImage.size[0]}x${testImage.size[1]} ${testImage.color || 'gradient'} ${testImage.format.toUpperCase()}`
			);
			createdCount++;
		} catch (error) {
			console.log(`Failed to create ${testImage.filename}: ${error}`);
		}
	}

	// Create edge case test files
	await createEdgeCaseFiles(fixturesDir);

	console.log(`\nSuccessfully created ${createdCount} test images!`);
	console.log(`Total files in ${fixturesDir}: ${(await fs.readdir(fixturesDir)).length}`);
}

/**
 * Create a gradient image for more complex visual testing
 */
async function createGradientImage(size: [number, number]): Promise<Buffer> {
	const [width, height] = size;
	const channels = 3;
	const data = Buffer.allocUnsafe(width * height * channels);

	let offset = 0;
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			// Create a diagonal gradient from red to blue
			const r = Math.floor((255 * x) / width);
			const g = Math.floor((128 * (x + y)) / (width + height));
			const b = Math.floor((255 * y) / height);

			data[offset++] = r;
			data[offset++] = g;
			data[offset++] = b;
		}
	}

	return await sharp(data, {
		raw: {
			width,
			height,
			channels,
		},
	})
		.png()
		.toBuffer();
}

/**
 * Create a minimal BMP image
 */
async function createBmpImage(size: [number, number], color: { r: number; g: number; b: number }): Promise<Buffer> {
	const [width, height] = size;
	const pixelDataSize = width * height * 3;
	const fileSize = 54 + pixelDataSize; // BMP header is 54 bytes

	const buffer = Buffer.allocUnsafe(fileSize);

	// BMP Header (14 bytes)
	buffer.write('BM', 0); // Signature
	buffer.writeUInt32LE(fileSize, 2); // File size
	buffer.writeUInt32LE(0, 6); // Reserved
	buffer.writeUInt32LE(54, 10); // Data offset

	// DIB Header (40 bytes)
	buffer.writeUInt32LE(40, 14); // DIB header size
	buffer.writeUInt32LE(width, 18); // Width
	buffer.writeUInt32LE(height, 22); // Height
	buffer.writeUInt16LE(1, 26); // Planes
	buffer.writeUInt16LE(24, 28); // Bits per pixel
	buffer.writeUInt32LE(0, 30); // Compression
	buffer.writeUInt32LE(pixelDataSize, 34); // Image size
	buffer.writeUInt32LE(2835, 38); // X pixels per meter
	buffer.writeUInt32LE(2835, 42); // Y pixels per meter
	buffer.writeUInt32LE(0, 46); // Colors used
	buffer.writeUInt32LE(0, 50); // Important colors

	// Pixel data (BGR format, bottom-up)
	let offset = 54;
	for (let y = height - 1; y >= 0; y--) {
		for (let x = 0; x < width; x++) {
			buffer[offset++] = color.b; // Blue
			buffer[offset++] = color.g; // Green
			buffer[offset++] = color.r; // Red
		}
	}

	return buffer;
}

/**
 * Create edge case files for error testing
 */
async function createEdgeCaseFiles(fixturesDir: string): Promise<void> {
	let edgeCasesCreated = 0;

	// Create a corrupted image file
	const corruptedPath = path.join(fixturesDir, 'corrupted.jpg');
	try {
		await fs.writeFile(corruptedPath, 'This is not a valid JPEG file content - corrupted for testing');
		console.log(`Created corrupted.jpg - corrupted file for error testing`);
		edgeCasesCreated++;
	} catch (error) {
		console.log(`Failed to create corrupted.jpg: ${error}`);
	}

	// Create an oversized file (simulated large image)
	const largePath = path.join(fixturesDir, 'oversized.jpg');
	try {
		const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0]); // JPEG header
		const fakeData = Buffer.alloc(2 * 1024 * 1024 - 4, 'x'); // 2MB total
		await fs.writeFile(largePath, Buffer.concat([jpegHeader, fakeData]));
		console.log(`Created oversized.jpg - oversized file (2MB) for size limit testing`);
		edgeCasesCreated++;
	} catch (error) {
		console.log(`Failed to create oversized.jpg: ${error}`);
	}

	// Create an empty file
	const emptyPath = path.join(fixturesDir, 'empty.jpg');
	try {
		await fs.writeFile(emptyPath, '');
		console.log(`Created empty.jpg - empty file for edge case testing`);
		edgeCasesCreated++;
	} catch (error) {
		console.log(`Failed to create empty.jpg: ${error}`);
	}

	// Create files with problematic names
	const problematicNames = [
		'file with spaces.jpg',
		'file-with-dashes.png',
		'file_with_underscores.gif',
		'UPPERCASE.JPG',
		'MiXeD_CaSe-File.png',
		'numbers123.jpg',
		'special!@#chars.png',
	];

	for (const problematicName of problematicNames) {
		try {
			const problemPath = path.join(fixturesDir, problematicName);
			const imageBuffer = await sharp({
				create: {
					width: 30,
					height: 30,
					channels: 3,
					background: { r: 128, g: 128, b: 128 }, // Gray
				},
			})
				.png()
				.toBuffer();

			// Determine format from extension
			const ext = problematicName.toLowerCase().split('.').pop();
			let finalBuffer: Buffer;

			if (ext === 'jpg' || ext === 'jpeg') {
				finalBuffer = await sharp(imageBuffer).jpeg().toBuffer();
			} else if (ext === 'png') {
				finalBuffer = await sharp(imageBuffer).png().toBuffer();
			} else {
				finalBuffer = imageBuffer; // Default to PNG buffer
			}

			await fs.writeFile(problemPath, finalBuffer);
			console.log(`Created '${problematicName}' - filename edge case testing`);
			edgeCasesCreated++;
		} catch (error) {
			console.log(`Failed to create '${problematicName}': ${error}`);
		}
	}

	console.log(`\nCreated ${edgeCasesCreated} edge case test files`);
}

/**
 * Create a nested directory structure with images for recursive testing
 */
async function createNestedDirectoryStructure(fixturesDir: string): Promise<void> {
	const nestedDir = path.join(fixturesDir, 'nested_test_structure');
	await fs.ensureDir(nestedDir);

	// Create subdirectories
	const subdirs = [
		path.join(nestedDir, 'level1'),
		path.join(nestedDir, 'level1', 'level2'),
		path.join(nestedDir, 'level1', 'level2', 'level3'),
		path.join(nestedDir, 'another_branch'),
	];

	for (const subdir of subdirs) {
		await fs.ensureDir(subdir);
	}

	// Create images in each directory
	let imagesCreated = 0;
	const colors = ['red', 'green', 'blue', 'yellow'];

	for (let i = 0; i < subdirs.length; i++) {
		const subdir = subdirs[i];
		const colorName = colors[i % 4];
		if (subdir === undefined || colorName === undefined) continue;

		try {
			const imagePath = path.join(subdir, `nested_image_${i}.jpg`);
			const color = getColorRgb(colorName);

			const imageBuffer = await sharp({
				create: {
					width: 40,
					height: 40,
					channels: 3,
					background: { r: color.r, g: color.g, b: color.b },
				},
			})
				.jpeg()
				.toBuffer();

			await fs.writeFile(imagePath, imageBuffer);
			console.log(`Created ${path.relative(fixturesDir, imagePath)} - nested structure testing`);
			imagesCreated++;
		} catch (error) {
			console.log(`Failed to create nested image in ${subdir}: ${error}`);
		}
	}

	console.log(`Created nested directory structure with ${imagesCreated} images`);
}

/**
 * Remove all test image fixtures
 */
async function cleanTestImages(): Promise<void> {
	const fixturesDir = path.join(__dirname, '..', 'fixtures', 'sample-images');

	if (!(await fs.pathExists(fixturesDir))) {
		console.log('No test images directory found to clean.');
		return;
	}

	let removedCount = 0;
	const items = await fs.readdir(fixturesDir);

	for (const item of items) {
		const itemPath = path.join(fixturesDir, item);
		const stats = await fs.stat(itemPath);

		try {
			if (stats.isFile()) {
				await fs.unlink(itemPath);
				removedCount++;
			} else if (stats.isDirectory()) {
				await fs.remove(itemPath);
				removedCount++;
			}
		} catch (error) {
			console.log(`Failed to remove ${item}: ${error}`);
		}
	}

	console.log(`Removed ${removedCount} test files/directories`);
}

/**
 * Get RGB values for color names
 */
function getColorRgb(color: string): { r: number; g: number; b: number } {
	const colors: { [key: string]: { r: number; g: number; b: number } } = {
		red: { r: 255, g: 0, b: 0 },
		green: { r: 0, g: 255, b: 0 },
		blue: { r: 0, g: 0, b: 255 },
		yellow: { r: 255, g: 255, b: 0 },
		white: { r: 255, g: 255, b: 255 },
		purple: { r: 128, g: 0, b: 128 },
		orange: { r: 255, g: 165, b: 0 },
		black: { r: 0, g: 0, b: 0 },
		cyan: { r: 0, g: 255, b: 255 },
		magenta: { r: 255, g: 0, b: 255 },
	};

	return colors[color] || { r: 128, g: 128, b: 128 }; // Default to gray
}

/**
 * Main function to handle command line arguments
 */
async function main(): Promise<void> {
	const args = process.argv.slice(2);

	if (args.includes('--clean')) {
		console.log('Cleaning existing test images...');
		await cleanTestImages();
		return;
	}

	if (args.includes('--with-nested')) {
		console.log('Creating test images with nested directory structure...');
		await createTestImages();
		const fixturesDir = path.join(__dirname, '..', 'fixtures', 'sample-images');
		await createNestedDirectoryStructure(fixturesDir);
		return;
	}

	console.log('Creating test image fixtures...');
	console.log('Use --clean to remove existing test images');
	console.log('Use --with-nested to include nested directory structure');
	console.log();

	await createTestImages();
}

// Check if this file is being run directly
if (import.meta.url === `file://${process.argv[1]}`) {
	main().catch(error => {
		console.error('Error creating test images:', error);
		process.exit(1);
	});
}
