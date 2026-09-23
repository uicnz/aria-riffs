import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { saveImageBuffer } from '../../src/utils/handle-files.js';

describe('handle-files', () => {
	it('given nested output path, when saveImageBuffer called, then creates parent directories and writes file', async () => {
		const baseDir = await mkdtemp(join(tmpdir(), 'aria-image-generator-'));
		const outputPath = join(baseDir, 'nested', 'images', 'output.png');
		const imageData = Buffer.from('test-image-bytes');

		try {
			await saveImageBuffer(imageData, outputPath);
			const savedData = await readFile(outputPath);
			expect(savedData.equals(imageData)).toBe(true);
		} finally {
			await rm(baseDir, { recursive: true, force: true });
		}
	});
});
