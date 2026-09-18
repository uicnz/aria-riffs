import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const execAsync = promisify(exec);

describe('CLI Integration', () => {
	it('given CLI run directly, when executed with process command, then parses and runs', async () => {
		const { stdout } = await execAsync(
			'bun riffs/image-transcoder/src/cli.ts process riffs/image-transcoder/images/test-image.jpg'
		);

		// Pino logger outputs structured logs with filepath
		expect(stdout).toContain('test-image.jpg');
		expect(stdout).toContain('Processing file');
	});
});
