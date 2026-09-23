/**
 * Aria Code Auditor Bun Command Runner - Execute bun commands with test mode support
 */

import { spawnSync } from 'node:child_process';
import type { BunCommandResult } from '../lib/types.js';

/**
 * Test mode flag - set when running in test environment
 */
const TEST_MODE = process.env.CODE_AUDITOR_TEST_MODE === 'true';

/**
 * Run a bun command and return structured results
 */
export async function runBunCommand(args: string[]): Promise<BunCommandResult> {
	// Handle test mode with mock data
	if (TEST_MODE) {
		return handleTestMode(args);
	}

	// Execute real bun command
	return executeBunCommand(args);
}

/**
 * Handle test mode execution with mock data
 */
function handleTestMode(args: string[]): Promise<BunCommandResult> {
	return Promise.resolve({
		stdout: getMockOutput(args),
		stderr: '',
		exitCode: 0,
		success: true,
	});
}

/**
 * Get mock output based on command arguments
 */
function getMockOutput(args: string[]): string {
	// bun pm ls for listing
	if (args.includes('pm') && args.includes('ls')) {
		return process.env.CODE_AUDITOR_MOCK_BUN_LIST !== undefined
			? process.env.CODE_AUDITOR_MOCK_BUN_LIST
			: 'mock-project@1.0.0\n├── chalk@6.0.0\n└── commander@15.0.0';
	}

	if (args.includes('outdated')) {
		return process.env.CODE_AUDITOR_MOCK_BUN_OUTDATED !== undefined
			? process.env.CODE_AUDITOR_MOCK_BUN_OUTDATED
			: 'Package    Current  Wanted  Latest  Location\nchalk        6.0.0   6.0.0   6.0.0   mock-project';
	}

	if (args.includes('test')) {
		return process.env.CODE_AUDITOR_MOCK_BUN_TEST !== undefined
			? process.env.CODE_AUDITOR_MOCK_BUN_TEST
			: 'All tests passed successfully';
	}

	if (args.includes('install') || args.includes('update')) {
		return process.env.CODE_AUDITOR_MOCK_BUN_INSTALL !== undefined
			? process.env.CODE_AUDITOR_MOCK_BUN_INSTALL
			: 'Dependencies updated successfully';
	}

	return '';
}

/**
 * Execute actual bun command
 */
function executeBunCommand(args: string[]): Promise<BunCommandResult> {
	return new Promise(resolve => {
		const bun = process.platform === 'win32' ? 'bun.exe' : 'bun';
		const result = spawnSync(bun, args, {
			encoding: 'utf8',
			timeout: 300000, // 5 minute timeout
		});

		// Handle command execution errors
		if (result.error) {
			resolve({
				stdout: '',
				stderr: result.error.message,
				exitCode: 1,
				success: false,
			});
			return;
		}

		// bun outdated returns non-zero exit code when outdated packages found (expected behavior)
		const isOutdatedCommand = args.includes('outdated');
		const success = result.status === 0 || isOutdatedCommand;

		resolve({
			stdout: result.stdout || '',
			stderr: result.stderr || '',
			exitCode: result.status || 0,
			success,
		});
	});
}

/**
 * Check if bun is available on the system
 */
export async function checkBunAvailable(): Promise<boolean> {
	if (TEST_MODE) {
		return true;
	}

	try {
		const result = await runBunCommand(['--version']);
		return result.success;
	} catch {
		return false;
	}
}

/**
 * Get bun version
 */
export async function getBunVersion(): Promise<string> {
	if (TEST_MODE) {
		return '1.0.0';
	}

	try {
		const result = await runBunCommand(['--version']);
		return result.success ? result.stdout.trim() : 'unknown';
	} catch {
		return 'unknown';
	}
}

/**
 * Run bun test command
 */
export async function runBunTest(testCommand = 'test'): Promise<BunCommandResult> {
	return runBunCommand([testCommand]);
}

/**
 * Run bun install command
 */
export async function runBunInstall(packages?: string[]): Promise<BunCommandResult> {
	const args = ['install'];
	if (packages && packages.length > 0) {
		args.push(...packages);
	}
	return runBunCommand(args);
}

/**
 * Run bun update command
 */
export async function runBunUpdate(packages?: string[]): Promise<BunCommandResult> {
	const args = ['update'];
	if (packages && packages.length > 0) {
		args.push(...packages);
	}
	return runBunCommand(args);
}
