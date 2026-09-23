import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'fs-extra';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseManager } from '../../src/db/database.js';
import { loadConfig } from '../../src/lib/config.js';
import { createMockLogger } from '../unit/fakes.js';

describe('image-sanitiser CLI database integration', () => {
	let testDir: string;
	let dbManager: DatabaseManager;
	let processExitSpy: any;

	beforeEach(async () => {
		// Create temporary directory for test
		testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sanitiser-db-integration-'));

		// Mock process.exit to capture exit code
		processExitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: string | number | null) => {
			throw new Error(`process.exit(${code})`);
		}) as any);
	});

	afterEach(async () => {
		if (dbManager) {
			dbManager.close();
		}
		if (testDir) {
			await fs.remove(testDir);
		}
		processExitSpy?.mockRestore();
	});

	it('given jpg file with png extension in database, when sanitise via CLI, then renames file and updates database', async () => {
		// Given: Create a JPEG image with .png extension
		const wrongExtPath = path.join(testDir, 'test-image.png');
		const correctExtPath = path.join(testDir, 'test-image.jpg');

		// Create actual JPEG image data
		const jpegBuffer = await sharp({
			create: {
				width: 100,
				height: 100,
				channels: 3,
				background: { r: 255, g: 0, b: 0 },
			},
		})
			.jpeg()
			.toBuffer();

		await fs.writeFile(wrongExtPath, jpegBuffer);

		// Load config for this test
		const config = loadConfig();

		// Initialize database manager with config and temporary database path
		const testDbPath = path.join(testDir, 'test-descriptions.db');
		dbManager = new DatabaseManager(config, testDbPath);

		// Add the file to the database with wrong path
		const description = 'Test image with wrong extension';
		await dbManager.saveDescription(wrongExtPath, description);

		// Verify file exists in database with wrong path
		const beforeDescription = await dbManager.getDescription(wrongExtPath);
		expect(beforeDescription).toBe(description);

		// When: Use ImageSanitiser directly with database manager
		// (Testing the core functionality, not the CLI wrapper)
		const { ImageSanitiser } = await import('../../src/core/sanitise-images.js');
		const mockLogger = createMockLogger();
		const sanitiser = new ImageSanitiser(mockLogger, config, undefined, dbManager);

		const success = await sanitiser.sanitizeSingleFile(wrongExtPath, false);
		await sanitiser.cleanup();

		// Then: Operation should succeed
		expect(success).toBe(true);

		// And: File should be renamed
		expect(await fs.pathExists(correctExtPath)).toBe(true);
		expect(await fs.pathExists(wrongExtPath)).toBe(false);

		// And: Database should be updated with new path and detection info
		const afterDescriptionNew = await dbManager.getDescription(correctExtPath);
		// Note: The description is now the detection result, not the pre-existing one
		expect(afterDescriptionNew).toBe('Detected: image/jpeg (magic-bytes, high)');

		// And: Old path should not exist in database
		const afterDescriptionOld = await dbManager.getDescription(wrongExtPath);
		expect(afterDescriptionOld).toBeNull();
	});
});
