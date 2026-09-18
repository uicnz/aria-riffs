/**
 * Config validation audits - validates YAML configs against Zod schemas
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as yaml from 'js-yaml';
import { ZodObject, type ZodRawShape, type ZodTypeAny, z } from 'zod';
import type { ValidationIssue, ValidationStatus } from '../lib/types.js';
import { SCHEMA_EXPORT_PATTERNS } from './constants.js';
import { toPascalCase } from './utils.js';

// =============================================================================
// TYPES
// =============================================================================

export interface ValidationAuditResult {
	validationStatus: ValidationStatus;
	validationIssues: ValidationIssue[];
}

// =============================================================================
// SCHEMA HELPERS
// =============================================================================

function makeStrict<T extends ZodRawShape>(schema: ZodObject<T>): ZodObject<T> {
	const shape = schema.shape;
	const strictShape: Record<string, ZodTypeAny> = {};

	for (const [key, value] of Object.entries(shape)) {
		if (value instanceof ZodObject) {
			strictShape[key] = makeStrict(value as ZodObject<ZodRawShape>);
		} else {
			strictShape[key] = value as ZodTypeAny;
		}
	}

	return z.object(strictShape).strict() as unknown as ZodObject<T>;
}

async function loadSchema(riff: string, repoRoot: string): Promise<ZodTypeAny | null> {
	const pascalName = toPascalCase(riff);
	const schemaPath = resolve(repoRoot, 'riffs', riff, 'src', 'lib', 'schema.ts');
	if (!existsSync(schemaPath)) return null;

	try {
		const mod = await import(pathToFileURL(schemaPath).href);

		for (const pattern of SCHEMA_EXPORT_PATTERNS) {
			const exportName = pattern(pascalName);
			if (mod[exportName]) {
				return mod[exportName];
			}
		}

		const exports = Object.keys(mod).filter(k => k.includes('Schema'));
		for (const exp of exports) {
			if (exp.endsWith('ConfigSchema') || exp.endsWith('ConfigFileSchema')) {
				return mod[exp];
			}
		}

		return null;
	} catch {
		return null;
	}
}

// =============================================================================
// MAIN VALIDATION FUNCTION
// =============================================================================

export async function validateConfig(riff: string, repoRoot: string): Promise<ValidationAuditResult> {
	const configPath = resolve(repoRoot, 'riffs', riff, 'config.yaml');
	const issues: ValidationIssue[] = [];

	if (!existsSync(configPath)) {
		return {
			validationStatus: 'error',
			validationIssues: [{ type: 'parse_error', path: '', message: 'Config file not found' }],
		};
	}

	let yamlData: unknown;
	try {
		const yamlContent = readFileSync(configPath, 'utf-8');
		yamlData = yaml.load(yamlContent);
	} catch (error) {
		return {
			validationStatus: 'error',
			validationIssues: [{ type: 'parse_error', path: '', message: `Failed to parse YAML: ${error}` }],
		};
	}

	const schema = await loadSchema(riff, repoRoot);
	if (!schema) {
		return {
			validationStatus: 'error',
			validationIssues: [{ type: 'schema_not_found', path: '', message: 'No matching schema export found' }],
		};
	}

	let strictSchema: ZodTypeAny;
	try {
		if (schema instanceof ZodObject) {
			strictSchema = makeStrict(schema as ZodObject<ZodRawShape>);
		} else {
			strictSchema = schema;
		}
	} catch {
		strictSchema = schema;
	}

	const parseResult = strictSchema.safeParse(yamlData);

	if (!parseResult.success) {
		let hasError = false;
		for (const issue of parseResult.error.issues) {
			const path = issue.path.join('.');

			if (issue.code === 'unrecognized_keys') {
				const keys = (issue as { keys: string[] }).keys;
				for (const key of keys) {
					issues.push({
						type: 'unknown_key',
						path: path ? `${path}.${key}` : key,
						message: `Unknown key "${key}" - being silently dropped`,
					});
				}
			} else if (issue.code === 'invalid_type') {
				hasError = true;
				const invalidTypeIssue = issue as { expected: string; received?: string };
				issues.push({
					type: 'type_error',
					path,
					message: `Type error: expected ${invalidTypeIssue.expected}${invalidTypeIssue.received ? `, got ${invalidTypeIssue.received}` : ''}`,
				});
			} else {
				hasError = true;
				issues.push({
					type: 'type_error',
					path,
					message: issue.message,
				});
			}
		}

		return { validationStatus: hasError ? 'error' : 'warning', validationIssues: issues };
	}

	return { validationStatus: 'ok', validationIssues: [] };
}
