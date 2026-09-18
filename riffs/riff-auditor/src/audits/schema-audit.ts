/**
 * Schema file audits - checks schema.ts structure and patterns
 */

import { resolve } from 'node:path';
import { readFileIfExists, toPascalCase } from './utils.js';

// =============================================================================
// TYPES
// =============================================================================

export interface SchemaAuditResult {
	schemaPath?: string;
	schemaExists: boolean;
	schemaHasWrapper: boolean;
	schemaHasLogging: boolean;
	loggingSchemaName: string;
	loggingTypeExportName: string;
	loggingDefaultPattern: string;
	usesLogLevelsConstant: boolean;
	riffSchemaExported: boolean;
	loggingNestedInRiffSchema: boolean;
	loggingEnumLowercase: boolean;
	loggingDefaultsStandard: boolean;
	loggingDefaultsMaxFileSizeMb?: number;
	loggingDefaultsMaxFiles?: number;
	loggingExtraFields: string[];
	schemaRootStrict: boolean;
	schemaExtraRootSections: string[];
}

// =============================================================================
// LOGGING SCHEMA CHECKS
// =============================================================================

function checkLoggingSchemaName(content: string): string {
	const riffPrefixMatch = content.match(/export\s+const\s+([A-Z][a-zA-Z]+Logging(?:Config)?Schema)\s*=/);
	if (riffPrefixMatch && !riffPrefixMatch[1].match(/^Logging(?:Config)?Schema$/)) {
		return riffPrefixMatch[1];
	}
	if (/export\s+const\s+LoggingSchema\s*=/.test(content)) return 'LoggingSchema';
	if (/export\s+const\s+LoggingConfigSchema\s*=/.test(content)) return 'LoggingConfigSchema';
	if (/const\s+LoggingSchema\s*=/.test(content)) return 'LoggingSchema (not exported)';
	if (/const\s+LoggingConfigSchema\s*=/.test(content)) return 'LoggingConfigSchema (not exported)';
	return 'missing';
}

function checkLoggingTypeExport(content: string): string {
	const riffPrefixMatch = content.match(/export\s+type\s+([A-Z][a-zA-Z]+Logging)\s*=/);
	if (riffPrefixMatch && riffPrefixMatch[1] !== 'LoggingConfig') {
		return riffPrefixMatch[1];
	}
	if (/export\s+type\s+LoggingYamlConfig\s*=/.test(content)) return 'LoggingYamlConfig';
	if (/export\s+type\s+LoggingConfig\s*=/.test(content)) return 'LoggingConfig';
	return 'missing';
}

function checkLoggingDefaultPattern(content: string): string {
	if (/logging:\s*\w+Schema\.default\s*\(\s*\w+Schema\.parse\s*\(\s*\{\s*\}\s*\)\s*\)/.test(content)) {
		return '.parse({})';
	}
	if (/logging:\s*\w+Schema\.optional\s*\(\s*\)\.default\s*\(\s*\{/.test(content)) {
		return '.optional().default()';
	}
	if (/logging:\s*\w+Schema\.optional\s*\(\s*\)\s*[,}]/.test(content)) {
		return '.optional()-no-default';
	}
	if (/logging:\s*\w+Schema\.default\s*\(\s*\{/.test(content)) {
		return 'inline';
	}
	return 'unknown';
}

function checkUsesLogLevelsConstant(content: string): boolean {
	return /const\s+LOG_LEVELS\s*=/.test(content);
}

function checkRiffSchemaExported(content: string, riff: string): boolean {
	const pascalRiff = toPascalCase(riff);
	const exportPattern = new RegExp(`export\\s+const\\s+${pascalRiff}RiffSchema\\s*=`);
	const constPattern = new RegExp(`const\\s+${pascalRiff}RiffSchema\\s*=`);
	if (exportPattern.test(content)) return true;
	if (constPattern.test(content)) return false;
	return true;
}

function checkLoggingNestedInRiffSchema(content: string, riff: string): boolean {
	const pascalRiff = toPascalCase(riff);
	const riffSchemaPattern = new RegExp(
		`${pascalRiff}RiffSchema\\s*=\\s*z\\.object\\s*\\(\\s*\\{[^}]*\\blogging\\s*:`,
		's'
	);
	return riffSchemaPattern.test(content);
}

function checkLoggingEnumLowercase(content: string): boolean {
	const enumMatch = content.match(/level:\s*z\.enum\s*\(\s*\[([^\]]+)\]\s*\)/);
	if (!enumMatch) {
		const constMatch = content.match(/const\s+LOG_LEVELS\s*=\s*\[([^\]]+)\]/);
		if (constMatch) {
			const values = constMatch[1];
			return /'trace'/.test(values) && !/'TRACE'/.test(values);
		}
		if (/level:\s*z\.string\s*\(\s*\)/.test(content)) {
			return false;
		}
		return true;
	}
	const values = enumMatch[1];
	return (/'trace'/.test(values) || /'debug'/.test(values)) && !/'TRACE'/.test(values) && !/'DEBUG'/.test(values);
}

function checkLoggingDefaults(content: string): { standard: boolean; maxFileSizeMb?: number; maxFiles?: number } {
	const sizeMatch = content.match(/maxFileSizeMb[^.]*\.default\s*\(\s*(\d+)\s*\)/);
	const filesMatch = content.match(/maxFiles[^.]*\.default\s*\(\s*(\d+)\s*\)/);
	const maxFileSizeMb = sizeMatch ? parseInt(sizeMatch[1], 10) : undefined;
	const maxFiles = filesMatch ? parseInt(filesMatch[1], 10) : undefined;
	const standard =
		(maxFileSizeMb === 10 || maxFileSizeMb === undefined) && (maxFiles === 7 || maxFiles === undefined);
	return { standard, maxFileSizeMb, maxFiles };
}

function checkLoggingExtraFields(content: string): string[] {
	const standardFields = ['level', 'verbose', 'file', 'maxFileSizeMb', 'maxFiles'];
	const extraFields: string[] = [];
	const loggingMatch = content.match(
		/(?:Logging(?:Config)?Schema|LoggingSchema)\s*=\s*z\.object\s*\(\s*\{([^}]+)\}/s
	);
	if (!loggingMatch) return [];
	const schemaBody = loggingMatch[1];
	const fieldMatches = schemaBody.matchAll(/(\w+)\s*:/g);
	for (const match of fieldMatches) {
		if (!standardFields.includes(match[1])) {
			extraFields.push(match[1]);
		}
	}
	return extraFields;
}

function checkRootSchemaStrict(content: string, riff: string): boolean {
	const pascalRiff = toPascalCase(riff);
	const declaration = new RegExp(`export\\s+const\\s+${pascalRiff}Config(?:File)?Schema\\s*=`, 'm').exec(content);
	if (declaration?.index === undefined) return false;
	const nextExport = content.indexOf('\nexport ', declaration.index + declaration[0].length);
	const schemaSource = content.slice(declaration.index, nextExport === -1 ? undefined : nextExport);
	return /\.strict\s*\(\s*\)/.test(schemaSource);
}

function checkSchemaExtraRootSections(content: string, riff: string): string[] {
	const allowedSections = ['aria-riff', riff, 'logging'];
	const extraSections: string[] = [];
	const pascalRiff = toPascalCase(riff);
	const fileSchemaPattern = new RegExp(
		`export\\s+const\\s+${pascalRiff}ConfigFileSchema\\s*=\\s*z\\s*\\.\\s*object\\s*\\(\\s*\\{`
	);
	const configSchemaPattern = new RegExp(
		`export\\s+const\\s+${pascalRiff}ConfigSchema\\s*=\\s*z\\s*\\.\\s*object\\s*\\(\\s*\\{`
	);
	let match = content.match(fileSchemaPattern);
	if (!match) {
		match = content.match(configSchemaPattern);
	}
	if (!match || match.index === undefined) return [];
	const startIdx = match.index + match[0].length;
	let depth = 1;
	let currentKey = '';
	let inKey = true;
	for (let i = startIdx; i < content.length && depth > 0; i++) {
		const char = content[i];
		if (char === '{') depth++;
		else if (char === '}') depth--;
		else if (depth === 1 && inKey) {
			if (char === ':') {
				const key = currentKey.trim().replace(/['"]/g, '');
				if (key && !allowedSections.includes(key)) {
					extraSections.push(key);
				}
				currentKey = '';
				inKey = false;
			} else if (char === ',' || char === '\n') {
				currentKey = '';
				inKey = true;
			} else {
				currentKey += char;
			}
		} else if (depth === 1 && (char === ',' || char === '\n')) {
			inKey = true;
		}
	}
	return extraSections;
}

// =============================================================================
// MAIN AUDIT FUNCTION
// =============================================================================

export function auditSchema(riff: string, repoRoot: string, justifiedPeerSections: string[] = []): SchemaAuditResult {
	const schemaPath = resolve(repoRoot, 'riffs', riff, 'src', 'lib', 'schema.ts');
	const schemaContent = readFileIfExists(schemaPath);
	const schemaExists = schemaContent !== undefined;

	if (!schemaExists || !schemaContent) {
		return {
			schemaPath: undefined,
			schemaExists: false,
			schemaHasWrapper: false,
			schemaHasLogging: false,
			loggingSchemaName: 'missing',
			loggingTypeExportName: 'missing',
			loggingDefaultPattern: 'unknown',
			usesLogLevelsConstant: false,
			riffSchemaExported: true,
			loggingNestedInRiffSchema: false,
			loggingEnumLowercase: true,
			loggingDefaultsStandard: true,
			loggingExtraFields: [],
			schemaRootStrict: false,
			schemaExtraRootSections: [],
		};
	}

	const schemaHasWrapper = new RegExp(`['"]${riff}['"]\\s*:`).test(schemaContent);
	const schemaHasLogging = /\blogging\s*:/.test(schemaContent);
	const loggingSchemaName = checkLoggingSchemaName(schemaContent);
	const loggingTypeExportName = checkLoggingTypeExport(schemaContent);
	const loggingDefaultPattern = checkLoggingDefaultPattern(schemaContent);
	const usesLogLevelsConstant = checkUsesLogLevelsConstant(schemaContent);
	const riffSchemaExported = checkRiffSchemaExported(schemaContent, riff);
	const loggingNestedInRiffSchema = checkLoggingNestedInRiffSchema(schemaContent, riff);
	const loggingEnumLowercase = checkLoggingEnumLowercase(schemaContent);
	const loggingDefaults = checkLoggingDefaults(schemaContent);
	const loggingExtraFields = checkLoggingExtraFields(schemaContent);
	const schemaRootStrict = checkRootSchemaStrict(schemaContent, riff);
	const schemaExtraRootSectionsRaw = checkSchemaExtraRootSections(schemaContent, riff);
	const schemaExtraRootSections = schemaExtraRootSectionsRaw.filter(
		section => !justifiedPeerSections.includes(section)
	);

	return {
		schemaPath,
		schemaExists,
		schemaHasWrapper,
		schemaHasLogging,
		loggingSchemaName,
		loggingTypeExportName,
		loggingDefaultPattern,
		usesLogLevelsConstant,
		riffSchemaExported,
		loggingNestedInRiffSchema,
		loggingEnumLowercase,
		loggingDefaultsStandard: loggingDefaults.standard,
		loggingDefaultsMaxFileSizeMb: loggingDefaults.maxFileSizeMb,
		loggingDefaultsMaxFiles: loggingDefaults.maxFiles,
		loggingExtraFields,
		schemaRootStrict,
		schemaExtraRootSections,
	};
}
