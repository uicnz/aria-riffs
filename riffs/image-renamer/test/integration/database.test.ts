import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'fs-extra';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseManager } from '../../src/db/database.js';
import { loadConfig } from '../../src/lib/config.js';
import { createMockLogger } from '../unit/fakes.js';

describe('image-renamer database integration', () => {
	let testDir: string;
	let dbManager: DatabaseManager;
	let processExitSpy: any;

	beforeEach(async () => {
		// Create temporary directory for test
		testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renamer-db-integration-'));

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

	it('given image file in database, when renamed via ImageRenamer, then updates database path', async () => {
		// Given: Create a JPEG image
		const originalPath = path.join(testDir, 'original-photo.jpg');
		const expectedNewPath = path.join(testDir, 'test-descriptive-name.jpg');

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

		await fs.writeFile(originalPath, jpegBuffer);

		// Load config for this test
		const config = loadConfig();

		// Initialize database manager with config and temporary database path
		const testDbPath = path.join(testDir, 'test-descriptions.db');
		dbManager = new DatabaseManager(config, testDbPath);

		// Add the file to the database
		const description = 'Test image for renaming';
		await dbManager.saveDescription(originalPath, description);

		// Verify file exists in database with original path
		const beforeDescription = await dbManager.getDescription(originalPath);
		expect(beforeDescription).toBe(description);

		// When: Create a mock LLM client that returns predictable filename
		const mockLlmClient = {
			generateFilename: vi.fn().mockResolvedValue('test-descriptive-name'),
			testConnection: vi.fn().mockResolvedValue(true),
			listModels: vi.fn().mockResolvedValue([]),
			modelName: 'test-model',
			endpointUrl: 'http://test',
		};

		// Use ImageRenamer with mock logger, mock LLM, database manager, and config
		const { ImageRenamer } = await import('../../src/core/rename-images.js');
		const mockLogger = createMockLogger();
		const renamer = new ImageRenamer(mockLogger, mockLlmClient, dbManager, config);

		// When: Rename the image
		await renamer.renameSingleImage(originalPath, false);

		// Then: File should be renamed
		expect(await fs.pathExists(expectedNewPath)).toBe(true);
		expect(await fs.pathExists(originalPath)).toBe(false);

		// And: Database should be updated with new path and new description from LLM
		const afterDescriptionNew = await dbManager.getDescription(expectedNewPath);
		// Note: The description is now the LLM-generated one ('test-descriptive-name'), not the pre-existing one
		expect(afterDescriptionNew).toBe('test-descriptive-name');

		// And: Old path should not exist in database
		const afterDescriptionOld = await dbManager.getDescription(originalPath);
		expect(afterDescriptionOld).toBeNull();
	});
});
