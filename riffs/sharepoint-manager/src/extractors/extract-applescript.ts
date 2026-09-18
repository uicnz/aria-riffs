/**
 * SharePoint link extraction using AppleScript automation
 */

import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import type { Logger } from 'pino';
import { BaseExtractor, type ExtractionResult } from './define-extractor.js';

/**
 * Check if we have accessibility permissions for automation
 */
export async function checkPermissions(): Promise<boolean> {
	const testScript = `
    tell application "System Events"
      keystroke "test"
    end tell
  `;

	try {
		execSync(`osascript -e '${testScript}'`, { stdio: 'ignore' });
		return true;
	} catch {
		return false;
	}
}

/**
 * Guide user through setting up accessibility permissions
 */
export async function setupPermissions(logger: Logger): Promise<boolean> {
	logger.info({}, '='.repeat(60));
	logger.info({}, 'ACCESSIBILITY PERMISSIONS SETUP');
	logger.info({}, '='.repeat(60));

	if (await checkPermissions()) {
		logger.info({}, 'COMPLETED Permissions are already configured!');
		return true;
	}

	logger.info({}, 'VS Code needs accessibility permissions to automate OneDrive.');
	logger.info({}, 'Opening System Settings...');
	execSync('open "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"');

	logger.info({}, 'Steps:');
	logger.info({}, '1. Click the lock icon and enter your password');
	logger.info({}, '2. Click + to add Visual Studio Code.app');
	logger.info({}, '3. Make sure VS Code is checked/enabled');
	logger.info({}, '4. You may need to restart VS Code');

	// Wait for user input
	logger.info({}, 'Press Enter after granting permissions...');
	await new Promise(resolve => {
		process.stdin.once('data', resolve);
	});

	if (await checkPermissions()) {
		logger.info({}, 'SUCCESS! Permissions are working.');
		return true;
	} else {
		logger.error({}, 'ERROR Permissions not working yet. Please check System Settings.');
		return false;
	}
}

/**
 * AppleScript-based extractor class
 */
export class AppleScriptExtractor extends BaseExtractor {
	async validate(): Promise<boolean> {
		return checkPermissions();
	}

	getName(): string {
		return 'applescript';
	}

	async extract(filePath: string): Promise<ExtractionResult> {
		const extractionDelay = this.config.extractionDelay || 1500;

		// Check if file exists
		if (!fs.existsSync(filePath)) {
			return { url: null, error: 'File not found on disk', method: 'applescript' };
		}

		// Clear clipboard
		try {
			execSync('pbcopy < /dev/null');
		} catch {}

		const appleScript = `tell application "Finder"
  activate
  reveal POSIX file ${JSON.stringify(filePath)} as alias
  select POSIX file ${JSON.stringify(filePath)} as alias
  delay 0.5
end tell

tell application "System Events"
  key code 36 using control down
  delay 0.8
  keystroke "Copy Link"
  delay 0.5
  keystroke return
end tell`;

		// Write to temp file to avoid shell escaping issues
		const tempScript = '/tmp/sharepoint_script.scpt';
		fs.writeFileSync(tempScript, appleScript);

		try {
			execSync(`osascript ${tempScript}`, { stdio: 'pipe' });

			// Wait for clipboard to be populated
			await new Promise(resolve => setTimeout(resolve, extractionDelay));

			// Get clipboard content
			const clipboard = execSync('pbpaste', { encoding: 'utf8' }).trim();

			// Close the Finder window to prevent accumulation
			try {
				execSync('osascript -e \'tell application "Finder" to close window 1\'', { stdio: 'ignore' });
			} catch {
				// Ignore close errors
			}

			// Verify we got a SharePoint URL
			if (clipboard?.includes('sharepoint.com')) {
				return { url: clipboard, method: 'applescript' };
			}

			// If clipboard doesn't have sharepoint.com, capture what we got
			if (clipboard && clipboard.length > 0) {
				return {
					url: null,
					error: `Invalid clipboard content (not SharePoint): ${clipboard.substring(0, 50)}`,
					method: 'applescript',
				};
			}

			return { url: null, error: 'Clipboard empty after extraction delay', method: 'applescript' };
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			return { url: null, error: `AppleScript execution failed: ${errorMessage}`, method: 'applescript' };
		}
	}
}
