/**
 * Console logger that coordinates output with cli-progress bars.
 * Pauses the progress bar before writing, then resumes it after.
 */

import type cliProgress from 'cli-progress';
import { loadConfig } from '../lib/config.js';
import { createLogger } from '../lib/logger.js';

const appConfig = loadConfig();

export class ConsoleLogger {
	private progressBar: cliProgress.SingleBar | null = null;
	private currentProgress = 0;
	private totalItems = 0;
	private logger = createLogger({
		level: appConfig.logging.level,
		verbose: appConfig.logging.verbose,
		file: appConfig.logging.file,
		maxFileSizeMb: appConfig.logging.maxFileSizeMb,
		maxFiles: appConfig.logging.maxFiles,
	});

	/**
	 * Set the progress bar to coordinate with
	 */
	setProgressBar(bar: cliProgress.SingleBar | null, total = 0): void {
		this.progressBar = bar;
		this.totalItems = total;
	}

	/**
	 * Update the current progress value
	 */
	setProgress(current: number): void {
		this.currentProgress = current;
	}

	/**
	 * Log a message, pausing progress bar if active
	 */
	log(message: string): void {
		if (this.progressBar) {
			this.progressBar.stop();
			this.logger.info(message);
			this.progressBar.start(this.totalItems, this.currentProgress);
		} else {
			this.logger.info(message);
		}
	}

	/**
	 * Log an error message, pausing progress bar if active
	 */
	error(message: string): void {
		if (this.progressBar) {
			this.progressBar.stop();
			this.logger.error(message);
			this.progressBar.start(this.totalItems, this.currentProgress);
		} else {
			this.logger.error(message);
		}
	}

	/**
	 * Log a warning message, pausing progress bar if active
	 */
	warn(message: string): void {
		if (this.progressBar) {
			this.progressBar.stop();
			this.logger.warn(message);
			this.progressBar.start(this.totalItems, this.currentProgress);
		} else {
			this.logger.warn(message);
		}
	}
}
