/**
 * Audit modules index - exports all audit functions
 */

export { auditCli, auditCliHelp, type CliAuditResult, type CliHelpAuditResult } from './cli-audit.js';
export { auditConfig, type ConfigAuditResult, findJustifiedPeerSections } from './config-audit.js';
export { auditConfigLoader, type ConfigLoaderAuditResult } from './config-loader-audit.js';
export { auditConfigTest, type ConfigTestAuditResult } from './config-test-audit.js';
export { CANONICAL_PROVIDER_KEY_NAMES, isSharedProviderEnvVar, SCHEMA_EXPORT_PATTERNS } from './constants.js';
export { auditDependencies, type DependencyAuditResult } from './dependency-audit.js';
export { auditEnv, type EnvAuditResult } from './env-audit.js';
export { auditLogger, type LoggerAuditResult } from './logger-audit.js';
export { auditPaths, type PathsAuditResult } from './paths-audit.js';
export { auditPrompt, type PromptAuditResult, RiffPromptSchema } from './prompt-audit.js';
export { auditSchema, type SchemaAuditResult } from './schema-audit.js';
export { auditScripts, type ScriptsAuditResult } from './scripts-audit.js';
export { auditSource, type SourceAuditResult } from './source-audit.js';
export { auditStructure, type StructureAuditOptions, type StructureAuditResult } from './structure-audit.js';
export {
	auditTsconfig,
	CANONICAL_TSCONFIG,
	getCanonicalTsconfigString,
	type TsconfigAuditResult,
} from './tsconfig-audit.js';
export { auditTui, type TuiAuditResult } from './tui-audit.js';
export {
	collectUnderscoreKeys,
	countWrapperUsage,
	findRiffRepoRoot,
	findSnakeCaseStringLiterals,
	isDirectory,
	listFilesRecursive,
	listRiffDirs,
	readFileIfExists,
	toPascalCase,
	toScreamingSnakeCase,
} from './utils.js';
export { type ValidationAuditResult, validateConfig } from './validation-audit.js';
export {
	auditRiffWiring,
	CANONICAL_PACKAGE_FILES,
	CANONICAL_PACKAGE_KEYS,
	CANONICAL_RIFF_FILES,
	type RiffWiringAuditResult,
} from './wiring-audit.js';
