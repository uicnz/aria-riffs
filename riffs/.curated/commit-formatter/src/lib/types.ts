/**
 * Type definitions for commit formatter
 */

import type { Logger } from 'pino';

export interface CommitInfo {
	hash: string;
	message: string;
	author: string;
	date: string;
	filesChanged: string[];
	diffSummary: string;
}

export interface ConventionalCommit {
	type: string;
	scope?: string;
	subject: string;
	breaking?: boolean;
}

export interface FormattingResult {
	hash: string;
	original: string;
	suggested: string;
	approved: boolean;
	applied: boolean;
}

export interface ProcessingStats {
	total: number;
	formatted: number;
	skipped: number;
	errors: number;
}

export type ProcessingMode = 'automatic' | 'assisted' | 'advisory' | 'preview';

export type AuthorMode = 'preserve' | 'rewrite';

export interface AuthorConfig {
	mode: AuthorMode;
	name?: string;
	email?: string;
}

export interface ProcessingOptions {
	mode: ProcessingMode;
	count?: number;
	dryRun: boolean;
	skipConventional: boolean;
	createBackup: boolean;
	generateReport: boolean;
	author: AuthorConfig;
	logger: Logger;
}

export interface BackupInfo {
	branchName: string;
	createdAt: string;
	originalBranch: string;
	commitCount: number;
}

export interface ReviewFile {
	timestamp: string;
	branch: string;
	results: FormattingResult[];
	approved: boolean;
}

export interface RewriteReport {
	timestamp: string;
	originalBranch: string;
	backupBranch?: string;
	mode: ProcessingMode;
	stats: ProcessingStats;
	results: FormattingResult[];
	warnings: string[];
}

export interface ProviderSettings {
	apiKey: string;
	model: string;
	temperature?: number;
	maxTokens: number;
	baseUrl: string;
	timeout: number;
}

export interface LLMConfig {
	provider: 'anthropic' | 'gemini' | 'openai';
	anthropic: ProviderSettings;
	gemini: ProviderSettings;
	openai: ProviderSettings;
}

export interface DefaultsConfig {
	mode: ProcessingMode;
	count: number;
	skipConventional: boolean;
	createBackup: boolean;
	generateReport: boolean;
}

export interface AuthorRewriteConfig {
	mode: AuthorMode;
	name?: string;
	email?: string;
}

export interface ConventionalCommitsConfig {
	requiredTypes: string[];
	additionalTypes: string[];
	maxDescriptionLength: number;
	allowBreakingChanges: boolean;
	scopeOptional: boolean;
}

export interface BackupConfig {
	branchPrefix: string;
	pushToRemote: boolean;
	cleanupAfterDays: number;
}

export interface ReportsConfig {
	jsonFilenameTemplate: string;
	markdownFilenameTemplate: string;
	includeDiffSummary: boolean;
}

export class CommitFormatterError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'CommitFormatterError';
	}
}
