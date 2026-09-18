#!/usr/bin/env bun
import fs from 'node:fs';
import { RULES } from '../rules/index.js';
import { parseMarkdownlintRules } from '../utils/parse-rules.js';
import { configPath, loadConfig } from './config.js';
import { createLogger } from './logger.js';

/**
 * Generates a YAML config file with rule descriptions as comments
 */
function generateConfigYaml(): string {
	const lines: string[] = [];

	lines.push('doc-converter:');
	lines.push('  paths:');
	lines.push('    input:');
	lines.push("      dir: 'sources'");
	lines.push('    output:');
	lines.push("      dir: '.aria/exports/doc-converter'");
	lines.push('  type: auto');
	lines.push('  cleanFirst: false');
	lines.push('');
	lines.push('logging:');
	lines.push("  level: 'INFO'");
	lines.push('  verbose: false');
	lines.push("  file: '.aria/logs/doc-converter.log'");
	lines.push('  maxFileSizeMb: 10');
	lines.push('  maxFiles: 7');
	lines.push('');
	lines.push('markdownlint:');
	lines.push('  enabled: false');
	lines.push('  fix: false');
	lines.push('  configPath: null');
	lines.push('');
	lines.push('ariaRules:');
	lines.push('  enabled: true');
	lines.push('  rules:');

	// Sort rule codes for consistent output
	const ruleCodes = Object.keys(RULES).sort();

	for (const code of ruleCodes) {
		const rule = RULES[code];
		if (!rule) continue;

		lines.push('');
		lines.push(`    # ${rule.description}`);

		// Special handling for AR011 - disabled by default
		const defaultEnabled = code !== 'AR011';
		lines.push(`    ${code}: ${defaultEnabled}`);
	}

	// Add markdownlintRules section
	lines.push('');
	lines.push('markdownlintRules:');
	lines.push('  enabled: false');
	lines.push('  rules:');

	const mdRules = parseMarkdownlintRules();
	const mdCodes = Object.keys(mdRules).sort((a, b) => {
		const numA = Number.parseInt(a.replace('MD', ''), 10);
		const numB = Number.parseInt(b.replace('MD', ''), 10);
		return numA - numB;
	});

	for (const code of mdCodes) {
		const rule = mdRules[code];
		lines.push('');
		lines.push(`    # ${rule.description}`);

		// Default most rules to true, but disable MD013 (line-length) for docs
		const defaultEnabled = code !== 'MD013';
		lines.push(`    ${code}: ${defaultEnabled}`);
	}

	return `${lines.join('\n')}\n`;
}

// Generate and write config if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
	const config = loadConfig();
	const logger = createLogger({
		level: config.logging.level,
		verbose: config.logging.verbose,
		file: config.logging.file,
		maxFileSizeMb: config.logging.maxFileSizeMb,
		maxFiles: config.logging.maxFiles,
	});
	const yaml = generateConfigYaml();
	fs.writeFileSync(configPath, yaml, 'utf8');
	logger.info({ configPath }, 'Generated config');
}

export { generateConfigYaml };
