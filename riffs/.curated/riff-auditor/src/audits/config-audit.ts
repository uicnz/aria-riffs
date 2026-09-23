/**
 * Config file audits - checks YAML config file structure
 *
 * Configs are co-located with their riffs (config.yaml in the riff directory)
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import * as yaml from 'js-yaml';
import { collectUnderscoreKeys, readFileIfExists, riffRoot } from './utils.js';

// =============================================================================
// TYPES
// =============================================================================

export interface ConfigAuditResult {
	configPath?: string;
	configExists: boolean;
	configWrapper: boolean;
	configLoggingPeer: boolean;
	configAriaRiffPeer: boolean;
	configAriaRiffHasName: boolean;
	configAriaRiffHasDescription: boolean;
	configAriaRiffHasCategory: boolean;
	configAriaRiffCategory: string | null;
	configUnderscoreKeys: string[];
	configWrapperUnderscoreKeys: string[];
	configLoggingUnderscoreKeys: string[];
	configPeerUnderscoreKeys: string[];
	justifiedPeerSections: string[];
}

// =============================================================================
// JUSTIFIED PEER SECTIONS
// =============================================================================

/**
 * Find sections marked with @aria-config: justified-peer comment.
 * These are peer sections that are explicitly justified and should not be flagged.
 */
export function findJustifiedPeerSections(configPath: string): string[] {
	const content = readFileIfExists(configPath);
	if (!content) return [];

	const justified: string[] = [];
	const lines = content.split('\n');

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (line.includes('@aria-config: justified-peer')) {
			for (let j = i + 1; j < lines.length; j++) {
				const nextLine = lines[j].trim();
				if (nextLine === '' || nextLine.startsWith('#')) continue;
				if (!lines[j].startsWith(' ') && !lines[j].startsWith('\t')) {
					const keyMatch = nextLine.match(/^([a-zA-Z][a-zA-Z0-9_-]*):/);
					if (keyMatch) {
						justified.push(keyMatch[1]);
					}
				}
				break;
			}
		}
	}

	return justified;
}

// =============================================================================
// YAML CONFIG READING
// =============================================================================

function readYamlConfig(configPath: string): unknown {
	const contents = readFileIfExists(configPath);
	if (!contents) return undefined;
	return yaml.load(contents);
}

// =============================================================================
// MAIN AUDIT FUNCTION
// =============================================================================

export function auditConfig(riff: string, repoRoot: string): ConfigAuditResult {
	// Config is co-located with the riff (config.yaml in the riff's directory)
	const riffDir = riffRoot(repoRoot, riff);
	const configPath = resolve(riffDir, 'config.yaml');
	const configExists = existsSync(configPath);

	if (!configExists) {
		return {
			configPath: undefined,
			configExists: false,
			configWrapper: false,
			configLoggingPeer: false,
			configAriaRiffPeer: false,
			configAriaRiffHasName: false,
			configAriaRiffHasDescription: false,
			configAriaRiffHasCategory: false,
			configAriaRiffCategory: null,
			configUnderscoreKeys: [],
			configWrapperUnderscoreKeys: [],
			configLoggingUnderscoreKeys: [],
			configPeerUnderscoreKeys: [],
			justifiedPeerSections: [],
		};
	}

	const configData = readYamlConfig(configPath) as Record<string, unknown> | undefined;
	const configWrapper = !!(configData && Object.hasOwn(configData, riff));
	const configLoggingPeer = !!(configData && Object.hasOwn(configData, 'logging'));
	const configAriaRiffPeer = !!(configData && Object.hasOwn(configData, 'aria-riff'));

	// Check aria-riff section structure
	let configAriaRiffHasName = false;
	let configAriaRiffHasDescription = false;
	let configAriaRiffHasCategory = false;
	let configAriaRiffCategory: string | null = null;

	if (configAriaRiffPeer && configData) {
		const ariaRiff = configData['aria-riff'] as Record<string, unknown> | undefined;
		if (ariaRiff && typeof ariaRiff === 'object') {
			configAriaRiffHasName = typeof ariaRiff.name === 'string' && ariaRiff.name.length > 0;
			configAriaRiffHasDescription = typeof ariaRiff.description === 'string' && ariaRiff.description.length > 0;
			configAriaRiffHasCategory = typeof ariaRiff.category === 'string' && ariaRiff.category.length > 0;
			if (configAriaRiffHasCategory) {
				configAriaRiffCategory = ariaRiff.category as string;
			}
		}
	}

	const configUnderscoreKeys: string[] = [];
	const configWrapperUnderscoreKeys: string[] = [];
	const configLoggingUnderscoreKeys: string[] = [];
	const configPeerUnderscoreKeys: string[] = [];

	if (configData) {
		collectUnderscoreKeys(configData, '', configUnderscoreKeys);
		if (configWrapper) {
			collectUnderscoreKeys(configData[riff], riff, configWrapperUnderscoreKeys);
		}
		if (configLoggingPeer) {
			collectUnderscoreKeys(configData.logging, 'logging', configLoggingUnderscoreKeys);
		}
		for (const [key, value] of Object.entries(configData)) {
			if (key === riff || key === 'logging' || key === 'aria-riff') continue;
			collectUnderscoreKeys(value, key, configPeerUnderscoreKeys);
		}
	}

	const justifiedPeerSections = findJustifiedPeerSections(configPath);

	return {
		configPath,
		configExists,
		configWrapper,
		configLoggingPeer,
		configAriaRiffPeer,
		configAriaRiffHasName,
		configAriaRiffHasDescription,
		configAriaRiffHasCategory,
		configAriaRiffCategory,
		configUnderscoreKeys,
		configWrapperUnderscoreKeys,
		configLoggingUnderscoreKeys,
		configPeerUnderscoreKeys,
		justifiedPeerSections,
	};
}
