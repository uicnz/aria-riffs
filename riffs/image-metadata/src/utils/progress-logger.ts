import type cliProgress from 'cli-progress';
import { loadConfig } from '../lib/config.js';
import { createLogger } from '../lib/logger.js';

/**
 * Coordinates progress bar and logging output
 * Ensures progress bar stops during logger output and restarts after
 */

const appConfig = loadConfig();

export class ProgressLogger {
	private progressBar: cliProgress.SingleBar | undefined;
	private logger = createLogger({
		level: appConfig.logging.level,
		verbose: appConfig.logging.verbose,
		file: appConfig.logging.file,
		maxFileSizeMb: appConfig.logging.maxFileSizeMb,
		maxFiles: appConfig.logging.maxFiles,
	});

	constructor() {
		this.progressBar = undefined;
	}

	setProgressBar(progressBar: cliProgress.SingleBar | null | undefined): void {
		this.progressBar = progressBar ?? undefined;
	}

	log(message: string): void {
		if (this.progressBar) {
			this.progressBar.stop();
			this.logger.info(message);
			this.progressBar.start(this.progressBar.getTotal(), this.progressBar.getProgress());
		} else {
			this.logger.info(message);
		}
	}

	warn(message: string): void {
		if (this.progressBar) {
			this.progressBar.stop();
			this.logger.warn(message);
			this.progressBar.start(this.progressBar.getTotal(), this.progressBar.getProgress());
		} else {
			this.logger.warn(message);
		}
	}

	error(message: string): void {
		if (this.progressBar) {
			this.progressBar.stop();
			this.logger.error(message);
			this.progressBar.start(this.progressBar.getTotal(), this.progressBar.getProgress());
		} else {
			this.logger.error(message);
		}
	}

	async start(total: number): Promise<void> {
		const cliProgress = await import('cli-progress');
		this.progressBar = new cliProgress.default.SingleBar({
			format: 'Processing |{bar}| {percentage}% | {value}/{total} Files',
			barCompleteChar: '\u2588',
			barIncompleteChar: '\u2591',
		});
		this.progressBar.start(total, 0);
	}

	update(value: number): void {
		if (this.progressBar) {
			this.progressBar.update(value);
		}
	}

	stop(): void {
		if (this.progressBar) {
			this.progressBar.stop();
		}
	}
}
