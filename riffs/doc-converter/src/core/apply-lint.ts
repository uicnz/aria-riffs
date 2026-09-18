import fs from 'node:fs';
import { applyFixes } from 'markdownlint';
import { lint, readConfig } from 'markdownlint/sync';

export async function applyMarkdownlint(
	filePath: string,
	options: { fix?: boolean; configPath?: string; rules?: Record<string, boolean> }
): Promise<void> {
	let config = options.configPath ? readConfig(options.configPath) : undefined;

	// Merge rule toggles into config
	if (options.rules) {
		config = { ...config, ...options.rules };
	}

	const result = lint({
		files: [filePath],
		config,
	});

	const output = result.toString();
	if (output) {
		process.stdout.write(`${output}\n`);
	}

	// Apply fixes if requested
	if (options.fix && result[filePath] && result[filePath].length > 0) {
		const content = fs.readFileSync(filePath, 'utf8');
		const fixed = applyFixes(content, result[filePath]);
		fs.writeFileSync(filePath, fixed, 'utf8');
	}
}
