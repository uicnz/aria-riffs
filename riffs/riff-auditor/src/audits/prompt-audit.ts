/** Canonical Riff prompt contract audit. */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';

const RiffPromptParameterSchema = z
	.object({
		name: z.string().min(1),
		type: z.string().min(1),
		required: z.boolean(),
		description: z.string().min(1),
	})
	.strict();

const RiffPromptExampleSchema = z
	.object({
		description: z.string().min(1),
		command: z.string().min(1),
		outcome: z.string().min(1),
	})
	.strict();

export const RiffPromptSchema = z
	.object({
		name: z.string().min(1),
		summary: z.string().min(1),
		purpose: z.string().min(1),
		whenToUse: z.array(z.string().min(1)).min(1),
		pipeline: z.array(z.string().min(1)).min(1),
		parameters: z.array(RiffPromptParameterSchema),
		output: z.string().min(1),
		constraints: z.array(z.string().min(1)),
		conventions: z.array(z.string().min(1)),
		examples: z.array(RiffPromptExampleSchema).min(1),
	})
	.strict();

export interface PromptAuditResult {
	promptPath: string;
	promptExists: boolean;
	promptLoads: boolean;
	promptMatchesCanonicalSchema: boolean;
	promptValidationIssues: string[];
	promptName: string | null;
	promptNameMatchesRiff: boolean;
	promptExamplesUsePlaceholder: boolean;
}

function invalidResult(promptPath: string, promptExists: boolean, issue: string): PromptAuditResult {
	return {
		promptPath,
		promptExists,
		promptLoads: false,
		promptMatchesCanonicalSchema: false,
		promptValidationIssues: [issue],
		promptName: null,
		promptNameMatchesRiff: false,
		promptExamplesUsePlaceholder: false,
	};
}

export async function auditPrompt(riff: string, repoRoot: string): Promise<PromptAuditResult> {
	const promptPath = resolve(repoRoot, 'riffs', riff, 'src', 'riff-prompt.ts');
	if (!existsSync(promptPath)) return invalidResult(promptPath, false, 'Prompt file not found');

	let candidate: unknown;
	try {
		const module = (await import(pathToFileURL(promptPath).href)) as { riffPrompt?: unknown };
		candidate = module.riffPrompt;
	} catch (error) {
		return invalidResult(promptPath, true, `Prompt module failed to load: ${String(error)}`);
	}

	const parsed = RiffPromptSchema.safeParse(candidate);
	if (!parsed.success) {
		return {
			...invalidResult(promptPath, true, 'Prompt does not match the canonical Riff prompt schema'),
			promptLoads: true,
			promptValidationIssues: parsed.error.issues.map(issue => {
				const path = issue.path.join('.');
				return path ? `${path}: ${issue.message}` : issue.message;
			}),
		};
	}

	return {
		promptPath,
		promptExists: true,
		promptLoads: true,
		promptMatchesCanonicalSchema: true,
		promptValidationIssues: [],
		promptName: parsed.data.name,
		promptNameMatchesRiff: parsed.data.name === riff,
		promptExamplesUsePlaceholder: parsed.data.examples.every(example => example.command.includes('$RIFF')),
	};
}
