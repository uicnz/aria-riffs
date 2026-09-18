/**
 * Service wrapper for shell command execution
 */

import { execSync } from 'node:child_process';
import type { Logger } from 'pino';

// Module-level logger (set by setLogger)
let logger: Logger;

/**
 * Set the logger instance for this service
 */
export function setLogger(loggerInstance: Logger): void {
	logger = loggerInstance;
}

export interface ExecOptions {
	cwd?: string;
	encoding?: BufferEncoding;
}

/**
 * Execute a shell command and return output
 * @param command - Command to execute
 * @param options - Execution options
 * @returns Command output as string
 */
export function exec(command: string, options?: ExecOptions): string {
	try {
		return execSync(command, {
			encoding: options?.encoding || 'utf-8',
			stdio: ['pipe', 'pipe', 'pipe'],
			cwd: options?.cwd,
		}) as string;
	} catch (error) {
		const errorObj = error as {
			stdout?: string;
			stderr?: string;
			status?: number;
			code?: number;
			message?: string;
		};
		logger.error(
			{
				command,
				stdout: errorObj.stdout,
				stderr: errorObj.stderr,
				exitCode: errorObj.status || errorObj.code,
				error: error instanceof Error ? error.message : String(error),
			},
			'Shell command execution failed'
		);
		throw error;
	}
}

/**
 * Execute a shell command silently (suppresses output in case of error)
 * @param command - Command to execute
 * @param options - Execution options
 * @returns Command output as string
 */
export function execSilent(command: string, options?: ExecOptions): string {
	return execSync(command, {
		encoding: options?.encoding || 'utf-8',
		stdio: ['pipe', 'pipe', 'pipe'],
		cwd: options?.cwd,
	}) as string;
}
