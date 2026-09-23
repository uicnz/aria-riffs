/**
 * Git rebase automation utilities for commit message rewriting
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Logger } from 'pino';
import type { AuthorConfig, FormattingResult } from '../lib/types.js';

/**
 * Apply all formatting results using interactive rebase
 */
export async function applyAllChanges(
	results: FormattingResult[],
	authorConfig: AuthorConfig,
	dryRun: boolean = false,
	logger: Logger
): Promise<void> {
	if (results.length === 0) {
		return;
	}

	// Sort results by commit order (oldest first)
	const sortedResults = results.sort((_a, _b) => {
		// We'll need to sort by actual commit order
		return 0; // For now, assume they're already sorted
	});

	if (dryRun) {
		logger.info('DRY RUN - Would apply these changes:');
		sortedResults.forEach(result => {
			logger.info(`  ${result.hash.slice(0, 7)}: ${result.original} → ${result.suggested}`);
		});
		return;
	}

	// Get the oldest commit's parent
	const oldestHash = sortedResults[0].hash;
	const parentHash = getParentCommit(oldestHash);

	// Create rebase script and message files
	const { scriptPath, seqEditorPath, messageFiles } = createRebaseScript(sortedResults, authorConfig);
	const editorPath = messageFiles[messageFiles.length - 1]; // Last item is the editor script

	try {
		// Execute rebase with custom editors
		const env = {
			...process.env,
			GIT_SEQUENCE_EDITOR: seqEditorPath,
			GIT_EDITOR: editorPath,
		};

		execSync(`git rebase -i ${parentHash}`, {
			encoding: 'utf-8',
			stdio: 'inherit',
			env,
		});
	} finally {
		// Cleanup all temporary files
		if (fs.existsSync(seqEditorPath)) {
			fs.unlinkSync(seqEditorPath);
		}
		if (fs.existsSync(scriptPath)) {
			fs.unlinkSync(scriptPath);
		}
		messageFiles.forEach(msgFile => {
			if (fs.existsSync(msgFile)) {
				fs.unlinkSync(msgFile);
			}
		});
	}
}

/**
 * Create a rebase script file and custom editor for git
 */
function createRebaseScript(
	results: FormattingResult[],
	authorConfig: AuthorConfig
): { scriptPath: string; seqEditorPath: string; messageFiles: string[] } {
	const tempDir = os.tmpdir();
	const timestamp = Date.now();
	const scriptPath = path.join(tempDir, `git-rebase-${timestamp}.txt`);

	// Create message mapping file using msgnum (1-based)
	const messageMappingPath = path.join(tempDir, `commit-messages-${timestamp}.json`);
	const messageMapping: Record<string, string> = {};

	results.forEach((result, index) => {
		messageMapping[(index + 1).toString()] = result.suggested;
	});

	fs.writeFileSync(messageMappingPath, JSON.stringify(messageMapping, null, 2), 'utf-8');

	// Create custom editor script using msgnum
	const editorPath = path.join(tempDir, `git-editor-${timestamp}.sh`);
	let editorScript = '#!/bin/bash\n\n';
	editorScript += 'MSG_FILE="$1"\n\n';
	editorScript += 'if [[ "$MSG_FILE" == *"COMMIT_EDITMSG"* ]] && [ -f .git/rebase-merge/msgnum ]; then\n';
	editorScript += '  MSG_NUM=$(cat .git/rebase-merge/msgnum)\n';
	editorScript += `  NEW_MSG=$(bun -e 'const map = JSON.parse(await Bun.file("${messageMappingPath}").text()); process.stdout.write(map[process.argv[2]] || "")' placeholder "$MSG_NUM")\n`;
	editorScript += '  if [ -n "$NEW_MSG" ]; then\n';
	editorScript += '    echo "$NEW_MSG" > "$MSG_FILE"\n';
	editorScript += '  fi\n';
	editorScript += 'fi\n';

	fs.writeFileSync(editorPath, editorScript, { mode: 0o755 });

	// Create rebase todo script
	let script = '';

	results.forEach(result => {
		const shortHash = result.hash.slice(0, 7);

		// Use reword to trigger editor with custom message
		script += `reword ${shortHash}\n`;
	});

	// Handle author rewriting if needed
	if (authorConfig.mode === 'rewrite' && authorConfig.name && authorConfig.email) {
		script += `exec git filter-branch -f --env-filter 'export GIT_AUTHOR_NAME="${authorConfig.name}"; export GIT_AUTHOR_EMAIL="${authorConfig.email}"; export GIT_COMMITTER_NAME="${authorConfig.name}"; export GIT_COMMITTER_EMAIL="${authorConfig.email}"' HEAD~${results.length}..HEAD\n`;
	}

	fs.writeFileSync(scriptPath, script, 'utf-8');

	// Create sequence editor script that writes todo to file
	const seqEditorPath = path.join(tempDir, `seq-editor-${timestamp}.sh`);
	const seqEditorScript = `#!/bin/bash\ncat "${scriptPath}" > "$1"\n`;
	fs.writeFileSync(seqEditorPath, seqEditorScript, { mode: 0o755 });

	return { scriptPath, seqEditorPath, messageFiles: [messageMappingPath, editorPath] };
}

/**
 * Get parent commit hash
 */
function getParentCommit(hash: string): string {
	try {
		return execSync(`git rev-parse ${hash}^`, { encoding: 'utf-8' }).trim();
	} catch (_error) {
		// If no parent (root commit), use --root
		return '--root';
	}
}

/**
 * Escape commit message for shell
 */
function escapeMessage(message: string): string {
	return message.replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/`/g, '\\`');
}

/**
 * Rewrite commit message only (for HEAD)
 */
export function rewriteLastCommit(
	newMessage: string,
	authorConfig: AuthorConfig,
	dryRun: boolean = false,
	logger: Logger
): void {
	if (dryRun) {
		logger.info(`DRY RUN - Would rewrite HEAD to: ${newMessage}`);
		return;
	}

	let command = `git commit --amend -m "${escapeMessage(newMessage)}" --no-verify`;

	if (authorConfig.mode === 'rewrite' && authorConfig.name && authorConfig.email) {
		command += ` --author="${authorConfig.name} <${authorConfig.email}>"`;
	}

	execSync(command, { encoding: 'utf-8' });
}

/**
 * Rewrite a specific commit by hash
 */
export async function rewriteCommit(
	commitHash: string,
	newMessage: string,
	_authorConfig: AuthorConfig,
	logger: Logger
): Promise<void> {
	const tempDir = os.tmpdir();
	const timestamp = Date.now();

	const parentHash = getParentCommit(commitHash);
	const shortHash = commitHash.slice(0, 7);

	logger.info({ commit: shortHash }, `Rewriting commit ${shortHash}`);

	// Create editor script
	const editorPath = path.join(tempDir, `git-editor-target-${timestamp}.sh`);
	const escapedMessage = escapeMessage(newMessage);
	const editorScript = `#!/bin/bash\nif [[ "$1" == *"COMMIT_EDITMSG"* ]]; then\n  echo "${escapedMessage}" > "$1"\nfi\n`;
	fs.writeFileSync(editorPath, editorScript, { mode: 0o755 });

	// Create sequence editor
	const seqEditorPath = path.join(tempDir, `seq-editor-target-${timestamp}.sh`);
	const seqEditorScript = `#!/bin/bash\nsed -i '' 's/^pick ${shortHash}/reword ${shortHash}/' "$1"\n`;
	fs.writeFileSync(seqEditorPath, seqEditorScript, { mode: 0o755 });

	try {
		const env = {
			...process.env,
			GIT_SEQUENCE_EDITOR: seqEditorPath,
			GIT_EDITOR: editorPath,
		};

		execSync(`git rebase -i ${parentHash}`, {
			encoding: 'utf-8',
			stdio: 'inherit',
			env,
		});

		logger.info({ commit: shortHash }, `Successfully rewrote commit ${shortHash}`);
	} finally {
		if (fs.existsSync(editorPath)) {
			fs.unlinkSync(editorPath);
		}
		if (fs.existsSync(seqEditorPath)) {
			fs.unlinkSync(seqEditorPath);
		}
	}
}

/**
 * Generate manual rebase instructions
 */
export function generateManualInstructions(results: FormattingResult[], authorConfig: AuthorConfig): string {
	if (results.length === 0) {
		return 'No changes to apply.';
	}

	let instructions = '\n';
	instructions += `${'='.repeat(60)}\n`;
	instructions += 'MANUAL REBASE INSTRUCTIONS\n';
	instructions += `${'='.repeat(60)}\n\n`;

	instructions += 'Option 1: Interactive Rebase (Safest)\n';
	instructions += `${'-'.repeat(40)}\n`;

	const oldestHash = results[0].hash;
	instructions += `1. Start interactive rebase:\n`;
	instructions += `   git rebase -i ${oldestHash}^\n\n`;

	instructions += `2. Change 'pick' to 'reword' (or 'r') for these commits:\n`;
	results.forEach(result => {
		instructions += `   ${result.hash.slice(0, 7)} - ${result.original}\n`;
	});

	instructions += `\n3. Git will open an editor for each commit. Use these messages:\n\n`;
	results.forEach(result => {
		instructions += `   Commit ${result.hash.slice(0, 7)}:\n`;
		instructions += `   ${result.suggested}\n\n`;
	});

	if (authorConfig.mode === 'rewrite' && authorConfig.name && authorConfig.email) {
		instructions += `4. After rebase, rewrite authors:\n`;
		instructions += `   git filter-branch --env-filter '\n`;
		instructions += `     export GIT_AUTHOR_NAME="${authorConfig.name}"\n`;
		instructions += `     export GIT_AUTHOR_EMAIL="${authorConfig.email}"\n`;
		instructions += `     export GIT_COMMITTER_NAME="${authorConfig.name}"\n`;
		instructions += `     export GIT_COMMITTER_EMAIL="${authorConfig.email}"\n`;
		instructions += `   ' ${oldestHash}^..HEAD\n\n`;
	}

	instructions += `\nOption 2: Automated Script\n`;
	instructions += `${'-'.repeat(40)}\n`;
	instructions += 'Run the riff with --apply flag:\n';
	instructions += `  bun run commit-formatter:format -- --apply\n\n`;

	instructions += 'After rewriting history:\n';
	instructions += `${'-'.repeat(40)}\n`;
	instructions += '1. Verify changes: git log --oneline\n';
	instructions += '2. Force push: git push --force-with-lease origin main\n';
	instructions += '3. Notify team members to re-clone or reset\n\n';

	return instructions;
}

/**
 * Create a shell script for manual execution
 */
export function createManualScript(
	results: FormattingResult[],
	_authorConfig: AuthorConfig,
	outputPath?: string
): string {
	const scriptPath = outputPath || path.join(process.cwd(), 'apply-commit-formatting.sh');

	let script = '#!/bin/bash\n\n';
	script += '# Commit message formatting script\n';
	script += '# Generated by Aria commit-formatter\n\n';

	script += 'set -e  # Exit on error\n\n';

	script += '# Create backup branch\n';
	script += `BACKUP_BRANCH="backup-before-reformat-$(date +%Y%m%d-%H%M%S)"\n`;
	script += 'git branch "$BACKUP_BRANCH"\n';
	script += 'echo "Created backup branch: $BACKUP_BRANCH"\n\n';

	const oldestHash = results[0].hash;
	script += '# Start interactive rebase\n';
	script += `echo "Starting rebase from ${oldestHash}..."\n`;
	script += `git rebase -i ${oldestHash}^\n\n`;

	script += '# Note: You will need to manually change pick to reword in the editor\n';
	script += '# Use these commit messages:\n\n';

	results.forEach(result => {
		script += `# ${result.hash.slice(0, 7)}: ${result.suggested}\n`;
	});

	script += '\necho "Rebase complete!"\n';
	script += 'echo "Review with: git log --oneline"\n';
	script += 'echo "Force push with: git push --force-with-lease origin main"\n';

	fs.writeFileSync(scriptPath, script, { mode: 0o755 });

	return scriptPath;
}

/**
 * Verify rebase was successful
 */
export function verifyRebase(): boolean {
	try {
		// Check if we're in the middle of a rebase
		const rebaseDir = path.join(process.cwd(), '.git', 'rebase-merge');
		if (fs.existsSync(rebaseDir)) {
			return false; // Rebase in progress or failed
		}

		// Check if any conflicts exist
		const status = execSync('git status --porcelain', { encoding: 'utf-8' });
		if (status.includes('UU')) {
			return false; // Unmerged conflicts
		}

		return true;
	} catch {
		return false;
	}
}

/**
 * Abort current rebase
 */
export function abortRebase(): void {
	try {
		execSync('git rebase --abort', { encoding: 'utf-8' });
	} catch (_error) {
		// Rebase might not be in progress
	}
}
