/**
 * Progress indicator utilities for vector-indexer
 */

import ora, { type Ora } from 'ora';

/**
 * Create a progress spinner
 */
export function createSpinner(text: string): Ora {
	return ora({
		text,
		color: 'cyan',
	}).start();
}

/**
 * Update spinner with success
 */
export function succeedSpinner(spinner: Ora, text: string): void {
	spinner.succeed(text);
}

/**
 * Update spinner with failure
 */
export function failSpinner(spinner: Ora, text: string): void {
	spinner.fail(text);
}

/**
 * Update spinner with warning
 */
export function warnSpinner(spinner: Ora, text: string): void {
	spinner.warn(text);
}

/**
 * Update spinner with info
 */
export function infoSpinner(spinner: Ora, text: string): void {
	spinner.info(text);
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
	if (bytes === 0) return '0 B';
	const k = 1024;
	const sizes = ['B', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${(bytes / k ** i).toFixed(2)} ${sizes[i]}`;
}

/**
 * Format duration to human-readable string
 */
export function formatDuration(ms: number): string {
	const seconds = Math.floor(ms / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);

	if (hours > 0) {
		return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
	}
	if (minutes > 0) {
		return `${minutes}m ${seconds % 60}s`;
	}
	return `${seconds}s`;
}

/**
 * Create progress bar for batch operations
 */
export function createProgressBar(
	total: number,
	label: string
): {
	update: (current: number) => void;
	finish: () => void;
} {
	const spinner = ora({
		text: `${label}: 0/${total}`,
		color: 'cyan',
	}).start();

	return {
		update: (current: number) => {
			const percentage = ((current / total) * 100).toFixed(1);
			spinner.text = `${label}: ${current}/${total} (${percentage}%)`;
		},
		finish: () => {
			spinner.succeed(`${label}: ${total}/${total} (100%)`);
		},
	};
}
