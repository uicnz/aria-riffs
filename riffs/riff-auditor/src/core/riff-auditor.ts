/**
 * RiffAuditor - Main class for enforcing canonical Riff health
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Logger } from 'pino';

import {
	auditCli,
	auditCliHelp,
	auditConfig,
	auditConfigLoader,
	auditConfigTest,
	auditDependencies,
	auditEnv,
	auditLogger,
	auditPaths,
	auditPrompt,
	auditRiffWiring,
	auditSchema,
	auditScripts,
	auditSource,
	auditStructure,
	auditTsconfig,
	auditTui,
	findRiffRepoRoot,
	listRiffDirs,
	validateConfig,
} from '../audits/index.js';
import { classifyHealthStatus } from '../lib/health-status.js';
import type { RiffAuditorRiffConfig } from '../lib/schema.js';
import type { HealthSummary, RiffHealth, ValidationStatus } from '../lib/types.js';

// =============================================================================
// RIFF AUDITOR CLASS
// =============================================================================

export class RiffAuditor {
	private logger: Logger;
	private config: RiffAuditorRiffConfig;
	private repoRoot: string;

	constructor(config: RiffAuditorRiffConfig, logger: Logger, repoRoot?: string) {
		this.config = config;
		this.logger = logger;
		this.repoRoot = repoRoot ?? findRiffRepoRoot(process.cwd(), config.paths.input.riffs);
	}

	/**
	 * Audit a single riff and return its health status.
	 */
	async auditRiff(riff: string): Promise<RiffHealth> {
		this.logger.debug({ riff }, 'Auditing riff');

		const { audits, rules } = this.config;
		const wiringResult = auditRiffWiring(riff, this.repoRoot);
		const promptResult = await auditPrompt(riff, this.repoRoot);

		// Run audits based on config
		const configResult = audits.config ? auditConfig(riff, this.repoRoot) : null;
		const schemaResult = audits.schema
			? auditSchema(riff, this.repoRoot, configResult?.justifiedPeerSections ?? [])
			: null;
		const cliResult = audits.cli ? auditCli(riff, this.repoRoot) : null;
		const cliHelpResult = audits.cli ? auditCliHelp(riff, this.repoRoot) : null;
		const envResult = audits.env ? auditEnv(riff, this.repoRoot) : null;
		const loggerResult = audits.logger ? auditLogger(riff, this.repoRoot) : null;
		const sourceResult = audits.source ? auditSource(riff, this.repoRoot) : null;
		const structureResult = audits.structure
			? auditStructure(riff, this.repoRoot, {
					allowGitkeepPlaceholders: rules.allowGitkeepPlaceholders,
				})
			: null;
		const tuiResult = audits.tui ? auditTui(riff, this.repoRoot) : null;
		const scriptsResult = audits.scripts ? auditScripts(riff, this.repoRoot) : null;
		const tsconfigResult = audits.tsconfig ? auditTsconfig(riff, this.repoRoot) : null;
		const pathsResult = audits.paths ? auditPaths(riff, this.repoRoot) : null;
		const validationResult = audits.validation ? await validateConfig(riff, this.repoRoot) : null;
		const configTestResult = audits.configTest ? auditConfigTest(riff, this.repoRoot) : null;
		const configLoaderResult = audits.configLoader ? auditConfigLoader(riff, this.repoRoot) : null;
		const dependencyResult = audits.dependencies ? auditDependencies(riff, this.repoRoot) : null;

		// Collect issues
		const issues: string[] = [];

		if (wiringResult.missingCanonicalFiles.length > 0) {
			issues.push(`Missing canonical Riff files: ${wiringResult.missingCanonicalFiles.join(', ')}`);
		}
		if (wiringResult.packageExists && !wiringResult.packageJsonValid) {
			issues.push('package.json must contain valid JSON');
		}
		if (wiringResult.configExists && !wiringResult.metadataNameMatchesRiff) {
			issues.push(`aria-riff.name must equal "${riff}"`);
		}
		if (wiringResult.packageExists && !wiringResult.packageNameMatchesRiff) {
			issues.push(`package name must equal "@aria/${riff}"`);
		}
		if (
			wiringResult.configExists &&
			wiringResult.packageJsonValid &&
			!wiringResult.metadataDescriptionMatchesPackage
		) {
			issues.push('aria-riff.description must equal package description');
		}
		if (wiringResult.packageJsonValid && !wiringResult.packageKeysMatchCanonical) {
			issues.push('package.json keys must match the canonical Riff package scaffold');
		}
		if (wiringResult.packageJsonValid && !wiringResult.packageVersionMatchesWorkspace) {
			issues.push('package version must match the workspace version');
		}
		if (wiringResult.packageJsonValid && !wiringResult.packageTypeMatchesCanonical) {
			issues.push('package type must equal "module"');
		}
		if (wiringResult.packageJsonValid && !wiringResult.packageMainMatchesCanonical) {
			issues.push('package main must equal "dist/cli.js"');
		}
		if (wiringResult.packageExists && !wiringResult.binNameMatchesRiff) {
			issues.push(`package binary must expose only "${riff}"`);
		}
		if (wiringResult.packageJsonValid && !wiringResult.binPathMatchesCanonical) {
			issues.push(`package binary "${riff}" must equal "dist/cli.js"`);
		}
		if (wiringResult.packageJsonValid && !wiringResult.packageFilesMatchCanonical) {
			issues.push('package files must equal: dist/, src/, config.yaml');
		}
		if (promptResult.promptExists && !promptResult.promptLoads) {
			issues.push('src/riff-prompt.ts must export a loadable riffPrompt');
		}
		if (promptResult.promptLoads && !promptResult.promptMatchesCanonicalSchema) {
			issues.push(
				`riffPrompt must match the canonical schema: ${promptResult.promptValidationIssues.join('; ')}`
			);
		}
		if (promptResult.promptMatchesCanonicalSchema && !promptResult.promptNameMatchesRiff) {
			issues.push(`riffPrompt.name must equal "${riff}"`);
		}
		if (promptResult.promptMatchesCanonicalSchema && !promptResult.promptExamplesUsePlaceholder) {
			issues.push('Every riffPrompt example command must use the $RIFF invocation placeholder');
		}

		// Config issues
		if (configResult) {
			if (rules.requireConfigWrapper && !configResult.configExists) issues.push('Missing config YAML');
			if (rules.requireConfigWrapper && configResult.configExists && !configResult.configWrapper)
				issues.push('Config missing riff wrapper');
			if (rules.requireLoggingPeer && configResult.configExists && !configResult.configLoggingPeer)
				issues.push('Config missing logging peer section');
			if (rules.requireAriaRiffPeer && configResult.configExists && !configResult.configAriaRiffPeer)
				issues.push('Config missing aria-riff peer section');
			if (rules.requireAriaRiffPeer && configResult.configAriaRiffPeer) {
				if (!configResult.configAriaRiffHasName) issues.push('aria-riff section missing name');
				if (!configResult.configAriaRiffHasDescription) issues.push('aria-riff section missing description');
				if (!configResult.configAriaRiffHasCategory) issues.push('aria-riff section missing category');
				if (configResult.configAriaRiffHasCategory) {
					const validCategories = ['documents', 'images', 'knowledge', 'development', 'utilities'];
					if (!validCategories.includes(configResult.configAriaRiffCategory ?? '')) {
						issues.push(
							`aria-riff.category must be one of: ${validCategories.join(', ')} (got: ${configResult.configAriaRiffCategory})`
						);
					}
				}
			}
			if (configResult.configWrapperUnderscoreKeys.length > 0) issues.push('Config wrapper has snake_case keys');
			if (configResult.configLoggingUnderscoreKeys.length > 0) issues.push('Logging config has snake_case keys');
			if (configResult.configPeerUnderscoreKeys.length > 0) issues.push('Peer sections include snake_case keys');
		}

		// Schema issues
		if (schemaResult) {
			if (!schemaResult.schemaExists) issues.push('Missing schema.ts');
			if (schemaResult.schemaExists && !schemaResult.schemaHasWrapper) issues.push('Schema missing riff wrapper');
			if (rules.requireLoggingSchema && schemaResult.schemaExists && !schemaResult.schemaHasLogging)
				issues.push('Schema missing logging section');
			if (schemaResult.schemaExists && !schemaResult.loggingEnumLowercase)
				issues.push('Logging enum not lowercase');
			if (schemaResult.schemaExists && !schemaResult.loggingDefaultsStandard) {
				issues.push(
					`Non-standard logging defaults (maxFileSizeMb: ${schemaResult.loggingDefaultsMaxFileSizeMb}, maxFiles: ${schemaResult.loggingDefaultsMaxFiles})`
				);
			}
			if (schemaResult.loggingExtraFields.length > 0)
				issues.push(`Extra logging fields: ${schemaResult.loggingExtraFields.join(', ')}`);
			if (rules.requireStrictRoot && schemaResult.schemaExists && !schemaResult.schemaRootStrict)
				issues.push('Root config schema must use .strict()');
			if (schemaResult.schemaExtraRootSections.length > 0)
				issues.push(`Extra root sections: ${schemaResult.schemaExtraRootSections.join(', ')}`);

			// Logging schema enforcement
			if (schemaResult.schemaExists && schemaResult.loggingSchemaName !== 'LoggingConfigSchema') {
				issues.push(
					`Logging schema name must be 'LoggingConfigSchema', found '${schemaResult.loggingSchemaName}'`
				);
			}
			if (schemaResult.schemaExists && schemaResult.loggingDefaultPattern !== '.parse({})') {
				issues.push(
					`Logging default pattern must be '.parse({})', found '${schemaResult.loggingDefaultPattern}'`
				);
			}
			if (schemaResult.schemaExists && schemaResult.loggingNestedInRiffSchema) {
				issues.push('Logging is nested inside RiffSchema (must be peer section only)');
			}
			if (schemaResult.schemaExists && !schemaResult.riffSchemaExported) {
				issues.push('Riff schema must be exported');
			}
		}

		// Config loader issues
		if (envResult) {
			if (!envResult.configLoaderExists) issues.push('Missing config.ts');
			if (envResult.configLoaderExists && !envResult.configLoaderUsesWrapper)
				issues.push('Config loader not using riff wrapper');
			if (envResult.configLoaderExists && !envResult.configLoaderUsesSchema)
				issues.push('Config loader not using schema');
			if (!envResult.dotEnvLoaderExists) issues.push('Missing src/lib/load-dotenv.ts');
			if (envResult.dotEnvLoaderExists && !envResult.hasAriaHomeConstant)
				issues.push('Dotenv loader must export ARIA_HOME');
			if (envResult.dotEnvLoaderExists && !envResult.hasGetAriaHome)
				issues.push('Dotenv loader must export getAriaHome()');
			if (envResult.dotEnvLoaderExists && !envResult.hasLoadDotEnv)
				issues.push('Dotenv loader must export loadDotEnv()');
			if (envResult.dotEnvLoaderExists && !envResult.hasCanonicalDotEnvPrecedence) {
				issues.push('Dotenv precedence must be process env > project .aria/.env > user ~/.aria/.env');
			}
			if (envResult.configLoaderExists && !envResult.configLoadsDotEnv)
				issues.push('Config loader must call canonical loadDotEnv()');
			if (envResult.envNonCanonicalVars.length > 0) {
				issues.push(`Riff source uses non-canonical env vars: ${envResult.envNonCanonicalVars.join(', ')}`);
			}
			if (envResult.nonCanonicalProviderKeyNames.length > 0) {
				issues.push(
					`Riff source names non-canonical provider keys: ${envResult.nonCanonicalProviderKeyNames.join(', ')}`
				);
			}
			if (envResult.configLoaderExists && !envResult.envPrefixUsed && envResult.envSharedVarsUsed.length === 0) {
				issues.push('Config loader missing env prefix usage');
			}
			if (envResult.configLoaderExists && !envResult.applyEnvOverridesReturnsConfig)
				issues.push('applyEnvOverrides() returns void instead of config');
			if (envResult.configLoaderExists && !envResult.hasApplyEnvOverridesFunc)
				issues.push('Config loader missing applyEnvOverrides() function');
			if (envResult.configLoaderExists && !envResult.loadConfigReturnsFullConfig)
				issues.push('loadConfig() must return the full canonical config type');
			if (envResult.configLoaderExists && !envResult.hasConfigErrorClass)
				issues.push('Missing ConfigError class');
			if (envResult.configLoaderExists && envResult.hasProcessExit)
				issues.push('Config loader uses process.exit()');
			if (rules.requireBracketNotation && envResult.configLoaderExists && !envResult.usesBracketNotation)
				issues.push('Uses dot notation for env vars instead of bracket notation');
		}

		// Source code issues
		if (loggerResult) {
			if (!loggerResult.loggerExists) {
				issues.push('Missing src/lib/logger.ts');
			}
			if (loggerResult.loggerExists && !loggerResult.isStandaloneSafe) {
				issues.push('Logger does not match the canonical standalone logger scaffold');
			}
		}

		// Source code issues
		if (sourceResult) {
			if (sourceResult.srcWrapperUsageCount === 0) issues.push('No riff wrapper usage found in src/test code');
			if (!sourceResult.testDirExists) issues.push('Missing test/ directory');
			if (!sourceResult.typesFileExists && !sourceResult.typesIsDirectory) issues.push('Missing types.ts file');
			if (sourceResult.typesIsDirectory) {
				issues.push('types/ is directory instead of types.ts file');
			}
			if (sourceResult.hasDeprecatedExports) {
				issues.push(`Has deprecated exports: ${sourceResult.deprecatedExports.join(', ')}`);
			}
			if (sourceResult.hasCompatibilityVestigeComments) {
				issues.push('Has compatibility-vestige comments - remove backward-compat framing');
			}
			if (sourceResult.hasDirectConsoleUsage) {
				issues.push(`Console boundary violations found: ${sourceResult.directConsoleUsage.join(', ')}`);
			}
			if (sourceResult.hasChalkUsage) {
				issues.push(`Chalk usage found: ${sourceResult.chalkUsageFiles.join(', ')}`);
			}
			if (sourceResult.hasNonBunShebang) {
				issues.push(`Non-Bun shebang found: ${sourceResult.nonBunShebangFiles.join(', ')}`);
			}
			if (sourceResult.hasNonBunRuntimeInvocations) {
				issues.push(`Non-Bun runtime invocation found: ${sourceResult.nonBunRuntimeInvocations.join(', ')}`);
			}
		}

		// Config loader issues
		if (configLoaderResult) {
			if (configLoaderResult.configLoaderExists && !configLoaderResult.hasGetRiffRoot) {
				issues.push('Config loader missing getRiffRoot() function');
			}
			if (configLoaderResult.hasGetRiffRoot && configLoaderResult.usesHardcodedRelativePath) {
				issues.push(
					'getRiffRoot() uses hardcoded relative path -- must walk up looking for config.yaml for bundle compatibility'
				);
			}
			if (configLoaderResult.hasGetRiffRoot && !configLoaderResult.usesWalkUpPattern) {
				issues.push('getRiffRoot() missing walk-up pattern (existsSync config.yaml search)');
			}
		}

		// CLI pattern enforcement
		if (cliResult) {
			if (rules.requireCreateProgramFunc && cliResult.cliExists && !cliResult.cliHasCreateProgramFunc) {
				issues.push('CLI missing createProgram() function - use factory pattern for testability');
			}
			if (rules.disallowModuleLevelProgram && cliResult.cliExists && cliResult.cliHasModuleLevelProgram) {
				issues.push('CLI has module-level program instantiation - move into createProgram() function');
			}
			if (rules.requireExecutionGuard && cliResult.cliExists && !cliResult.cliHasExecutionGuard) {
				issues.push(
					'CLI missing execution guard - add if (process.argv[1] === fileURLToPath(import.meta.url))'
				);
			}
			if (rules.requireProgramNameMatchesRiff && cliResult.cliExists && !cliResult.cliProgramNameMatchesRiff) {
				issues.push(
					`CLI program.name() mismatch: expected "${riff}", got "${cliResult.cliProgramName ?? '(none)'}"`
				);
			}
			if (cliResult.cliExists && !cliResult.cliImportsPackageManifest) {
				issues.push('CLI must import its package manifest as packageManifest');
			}
			if (cliResult.cliExists && !cliResult.cliUsesPackageDescription) {
				issues.push('CLI description must use packageManifest.description');
			}
			if (cliResult.cliExists && !cliResult.cliUsesPackageVersion) {
				issues.push('CLI version must use packageManifest.version');
			}
			if (cliHelpResult && !cliHelpResult.cliHelpRenders) {
				issues.push(
					`CLI --help must exit successfully and begin with "Usage: ${riff}" (exit ${cliHelpResult.cliHelpExitCode})`
				);
			}
		}

		// Structure issues
		if (structureResult) {
			if (!structureResult.readmeExists) {
				issues.push('Missing README.md');
			}
			if (rules.requireCore) {
				if (!structureResult.coreDirExists) {
					issues.push('Missing src/core/ directory');
				} else if (!structureResult.coreDirHasFiles) {
					issues.push('Empty src/core/ directory - needs business logic');
				}
			}
			if (rules.requireLib) {
				if (!structureResult.libDirExists) {
					issues.push('Missing src/lib/ directory');
				} else if (!structureResult.libDirHasFiles) {
					issues.push('Empty src/lib/ directory - needs schema.ts, config.ts, types.ts');
				}
			}
			if (rules.requireTui) {
				if (!structureResult.tuiDirExists) {
					issues.push('Missing src/tui/ directory');
				} else if (!structureResult.tuiDirHasFiles) {
					issues.push('Empty src/tui/ directory - needs render.tsx');
				}
			}
			if (rules.requireTestUnit) {
				if (!structureResult.testUnitDirExists) {
					issues.push('Missing test/unit/ directory');
				} else if (!structureResult.testUnitDirHasFiles) {
					issues.push('Empty test/unit/ directory - add .gitkeep or test files');
				}
			}
			if (rules.requireTestIntegration) {
				if (!structureResult.testIntegrationDirExists) {
					issues.push('Missing test/integration/ directory');
				} else if (!structureResult.testIntegrationDirHasFiles) {
					issues.push('Empty test/integration/ directory - add .gitkeep or test files');
				}
			}
			if (structureResult.emptyDirectories.length > 0) {
				issues.push(`Empty directories found: ${structureResult.emptyDirectories.join(', ')}`);
			}
		}

		// TUI issues
		if (tuiResult && rules.requireTui) {
			if (!tuiResult.tuiRenderExists) {
				issues.push('Missing src/tui/render.tsx');
			} else {
				if (rules.requireTuiAppExport && !tuiResult.tuiExportsApp) {
					issues.push('TUI missing App component export');
				}
				if (rules.requireTuiRenderAppExport && !tuiResult.tuiExportsRenderApp) {
					issues.push('TUI missing renderApp function export');
				}
				if (rules.requireTuiControllerExport && !tuiResult.tuiExportsTuiController) {
					issues.push('TUI missing TuiController interface export');
				}
				if (rules.requireAriaTuiPackage && !tuiResult.tuiUsesAriaTuiPackage) {
					issues.push('TUI not using @aria/tui package');
				}
				if (rules.requireAppShell && !tuiResult.tuiHasAppShell) {
					issues.push('TUI not using AppShell component');
				}
			}
		}

		// Package.json scripts issues
		if (scriptsResult) {
			const missingRequired: string[] = [];
			if (rules.requireBuildScript && !scriptsResult.hasBuildScript) {
				missingRequired.push('build');
			}
			if (rules.requireStartScript && !scriptsResult.hasStartScript) {
				missingRequired.push('start');
			}
			if (rules.requireTestScript && !scriptsResult.hasTestScript) {
				missingRequired.push('test');
			}
			if (rules.requireTypecheckScript && !scriptsResult.hasTypecheckScript) {
				missingRequired.push('typecheck');
			}
			if (missingRequired.length > 0) {
				issues.push(`Missing package-local scripts: ${missingRequired.join(', ')}`);
			}
			if (scriptsResult.nonCanonicalScripts.length > 0) {
				issues.push(`Non-canonical package-local scripts: ${scriptsResult.nonCanonicalScripts.join('; ')}`);
			}
		}

		// Package dependency issues
		if (dependencyResult) {
			if (dependencyResult.packageExists && !dependencyResult.packageJsonValid) {
				issues.push('[Dependencies] package.json is not valid JSON');
			}
			if (dependencyResult.packageJsonValid && !dependencyResult.packageManagerMatchesCanonical) {
				issues.push(
					`[Dependencies] packageManager must match the canonical Bun release (found: ${dependencyResult.packageManager ?? 'missing'})`
				);
			}
			if (dependencyResult.packageJsonValid && !dependencyResult.bunEngineMatchesCanonical) {
				issues.push(
					`[Dependencies] Bun engine must match the canonical range (found: ${dependencyResult.bunEngine ?? 'missing'})`
				);
			}
			if (dependencyResult.packageJsonValid && !dependencyResult.nodeEngineMatchesCanonical) {
				issues.push(
					`[Dependencies] Node engine must match the canonical interoperability range (found: ${dependencyResult.nodeEngine ?? 'missing'})`
				);
			}
			if (dependencyResult.packageJsonValid && !dependencyResult.dependenciesSorted) {
				issues.push('[Dependencies] dependencies must be sorted alphabetically');
			}
			for (const invalidSpec of dependencyResult.invalidDependencySpecs) {
				issues.push(`[Dependencies] dependency must use a caret-prefixed release: ${invalidSpec}`);
			}
			for (const mismatch of dependencyResult.sharedDependencyVersionMismatches) {
				issues.push(`[Dependencies] shared dependency version mismatch: ${mismatch}`);
			}
			if (dependencyResult.undeclaredSourceDependencies.length > 0) {
				issues.push(
					`[Dependencies] source imports undeclared packages: ${dependencyResult.undeclaredSourceDependencies.join(', ')}`
				);
			}
			if (dependencyResult.unusedDeclaredDependencies.length > 0) {
				issues.push(
					`[Dependencies] declared packages are unused by src/: ${dependencyResult.unusedDeclaredDependencies.join(', ')}`
				);
			}
		}

		// TSConfig issues
		if (tsconfigResult) {
			if (!tsconfigResult.tsconfigExists) {
				issues.push('Missing tsconfig.json');
			} else if (!tsconfigResult.tsconfigMatchesCanonical) {
				if (tsconfigResult.tsconfigHasExtends) {
					issues.push('TSConfig uses extends (must be standalone for portability)');
				}
				// Report first few differences to keep output manageable
				const maxDiffs = 3;
				const diffCount = tsconfigResult.tsconfigDifferences.length;
				for (let i = 0; i < Math.min(maxDiffs, diffCount); i++) {
					issues.push(`TSConfig: ${tsconfigResult.tsconfigDifferences[i]}`);
				}
				if (diffCount > maxDiffs) {
					issues.push(`TSConfig: ... and ${diffCount - maxDiffs} more differences`);
				}
			}
		}

		// Paths structure issues
		if (pathsResult) {
			if (!pathsResult.pathsHasNestedStructure) {
				issues.push('Paths do not use nested structure');
			}
			if (pathsResult.pathsInvalidCategories.length > 0) {
				issues.push(`Invalid path categories: ${pathsResult.pathsInvalidCategories.join(', ')}`);
			}
			if (pathsResult.pathsHasFlatKeys) {
				issues.push(`Flat path keys found: ${pathsResult.pathsFlatKeys.join(', ')}`);
			}
			if (pathsResult.pathsNonCanonicalCacheReferences.length > 0) {
				issues.push(
					`Non-canonical cache-path references found: ${pathsResult.pathsNonCanonicalCacheReferences.join(', ')}`
				);
			}
			if (!pathsResult.pathsLoggingHasFile) {
				issues.push('Logging section missing file key');
			}
			if (pathsResult.pathsLoggingHasFile && !pathsResult.pathsLoggingFollowsConvention) {
				issues.push('Logging file does not follow .aria/logs/{riff}.log convention');
			}
		}

		// Config test pattern issues
		if (configTestResult) {
			if (!configTestResult.hasExpandTilde) issues.push('Config missing expandTilde function');
			if (!configTestResult.hasExpandTildePaths) issues.push('Config missing expandTildePaths function');
			if (!configTestResult.loadConfigCallsExpandTildePaths)
				issues.push('loadConfig() does not call expandTildePaths');
			if (!configTestResult.hasConfigUnitTest) issues.push('Missing test/unit/config.test.ts');
			if (!configTestResult.hasConfigIntegrationTest) issues.push('Missing test/integration/config.test.ts');
			if (configTestResult.hasConfigUnitTest && !configTestResult.hasTildeExpansionTest)
				issues.push('Config unit test missing tilde expansion test');
			for (const assertion of configTestResult.fragileAssertions) {
				issues.push(`Fragile assertion: ${assertion}`);
			}
			if (configTestResult.nonCanonicalFixtureConfigPaths.length > 0) {
				issues.push(
					`Fixture YAML configs must be named config.yaml: ${configTestResult.nonCanonicalFixtureConfigPaths.join(', ')}`
				);
			}
		}

		// Validation issues (only add if validation actually ran, not if skipped)
		if (validationResult && validationResult.validationStatus !== 'skipped') {
			for (const vi of validationResult.validationIssues) {
				issues.push(`[Validation] ${vi.message}${vi.path ? ` at ${vi.path}` : ''}`);
			}
		}

		// Determine status
		const status = classifyHealthStatus(issues);

		return {
			riff,
			wiringMissingCanonicalFiles: wiringResult.missingCanonicalFiles,
			wiringConfigExists: wiringResult.configExists,
			wiringPackageExists: wiringResult.packageExists,
			wiringPackageJsonValid: wiringResult.packageJsonValid,
			wiringCliExists: wiringResult.cliExists,
			wiringMetadataName: wiringResult.metadataName,
			wiringMetadataNameMatchesRiff: wiringResult.metadataNameMatchesRiff,
			wiringMetadataDescription: wiringResult.metadataDescription,
			wiringPackageName: wiringResult.packageName,
			wiringPackageNameMatchesRiff: wiringResult.packageNameMatchesRiff,
			wiringPackageDescription: wiringResult.packageDescription,
			wiringMetadataDescriptionMatchesPackage: wiringResult.metadataDescriptionMatchesPackage,
			wiringPackageKeysMatchCanonical: wiringResult.packageKeysMatchCanonical,
			wiringPackageVersion: wiringResult.packageVersion,
			wiringPackageVersionMatchesWorkspace: wiringResult.packageVersionMatchesWorkspace,
			wiringPackageTypeMatchesCanonical: wiringResult.packageTypeMatchesCanonical,
			wiringPackageMainMatchesCanonical: wiringResult.packageMainMatchesCanonical,
			wiringBinNameMatchesRiff: wiringResult.binNameMatchesRiff,
			wiringBinPathMatchesCanonical: wiringResult.binPathMatchesCanonical,
			wiringPackageFilesMatchCanonical: wiringResult.packageFilesMatchCanonical,
			promptPath: promptResult.promptPath,
			promptExists: promptResult.promptExists,
			promptLoads: promptResult.promptLoads,
			promptMatchesCanonicalSchema: promptResult.promptMatchesCanonicalSchema,
			promptValidationIssues: promptResult.promptValidationIssues,
			promptName: promptResult.promptName,
			promptNameMatchesRiff: promptResult.promptNameMatchesRiff,
			promptExamplesUsePlaceholder: promptResult.promptExamplesUsePlaceholder,
			// Config
			configPath: configResult?.configPath,
			configExists: configResult?.configExists ?? false,
			configWrapper: configResult?.configWrapper ?? false,
			configLoggingPeer: configResult?.configLoggingPeer ?? false,
			configAriaRiffPeer: configResult?.configAriaRiffPeer ?? false,
			configAriaRiffHasName: configResult?.configAriaRiffHasName ?? false,
			configAriaRiffHasDescription: configResult?.configAriaRiffHasDescription ?? false,
			configAriaRiffHasCategory: configResult?.configAriaRiffHasCategory ?? false,
			configAriaRiffCategory: configResult?.configAriaRiffCategory ?? null,
			configUnderscoreKeys: configResult?.configUnderscoreKeys ?? [],
			configWrapperUnderscoreKeys: configResult?.configWrapperUnderscoreKeys ?? [],
			configLoggingUnderscoreKeys: configResult?.configLoggingUnderscoreKeys ?? [],
			configPeerUnderscoreKeys: configResult?.configPeerUnderscoreKeys ?? [],
			// Schema
			schemaPath: schemaResult?.schemaPath,
			schemaExists: schemaResult?.schemaExists ?? false,
			schemaHasWrapper: schemaResult?.schemaHasWrapper ?? false,
			schemaHasLogging: schemaResult?.schemaHasLogging ?? false,
			loggingSchemaName: schemaResult?.loggingSchemaName ?? '',
			loggingTypeExportName: schemaResult?.loggingTypeExportName ?? '',
			loggingDefaultPattern: schemaResult?.loggingDefaultPattern ?? '',
			usesLogLevelsConstant: schemaResult?.usesLogLevelsConstant ?? false,
			riffSchemaExported: schemaResult?.riffSchemaExported ?? false,
			loggingNestedInRiffSchema: schemaResult?.loggingNestedInRiffSchema ?? false,
			loggingEnumLowercase: schemaResult?.loggingEnumLowercase ?? false,
			loggingDefaultsStandard: schemaResult?.loggingDefaultsStandard ?? false,
			loggingExtraFields: schemaResult?.loggingExtraFields ?? [],
			schemaRootStrict: schemaResult?.schemaRootStrict ?? false,
			schemaExtraRootSections: schemaResult?.schemaExtraRootSections ?? [],
			// Config loader / Env
			configLoaderPath: envResult?.configLoaderPath,
			configLoaderExists: envResult?.configLoaderExists ?? false,
			configLoaderUsesWrapper: envResult?.configLoaderUsesWrapper ?? false,
			configLoaderUsesSchema: envResult?.configLoaderUsesSchema ?? false,
			dotEnvLoaderPath: envResult?.dotEnvLoaderPath,
			dotEnvLoaderExists: envResult?.dotEnvLoaderExists ?? false,
			hasAriaHomeConstant: envResult?.hasAriaHomeConstant ?? false,
			hasGetAriaHome: envResult?.hasGetAriaHome ?? false,
			hasLoadDotEnv: envResult?.hasLoadDotEnv ?? false,
			hasCanonicalDotEnvPrecedence: envResult?.hasCanonicalDotEnvPrecedence ?? false,
			configLoadsDotEnv: envResult?.configLoadsDotEnv ?? false,
			loggerPath: loggerResult?.loggerPath,
			loggerExists: loggerResult?.loggerExists ?? false,
			loggerUsesPinoPrettyImport: loggerResult?.usesPinoPrettyImport ?? false,
			loggerUsesStdoutDestination: loggerResult?.usesStdoutDestination ?? false,
			loggerUsesPinoTransportCall: loggerResult?.usesPinoTransportCall ?? false,
			loggerUsesInlineTransportConfig: loggerResult?.usesInlineTransportConfig ?? false,
			loggerUsesTransportTargets: loggerResult?.usesTransportTargets ?? false,
			loggerUsesPinoPrettyTarget: loggerResult?.usesPinoPrettyTarget ?? false,
			loggerUsesPinoRollTarget: loggerResult?.usesPinoRollTarget ?? false,
			loggerUsesDestinationStreams: loggerResult?.usesDestinationStreams ?? false,
			loggerUsesMultistream: loggerResult?.usesMultistream ?? false,
			loggerIsStandaloneSafe: loggerResult?.isStandaloneSafe ?? false,
			envPrefix: envResult?.envPrefix ?? '',
			envPrefixUsed: envResult?.envPrefixUsed ?? false,
			envNonCanonicalVars: envResult?.envNonCanonicalVars ?? [],
			envSharedVarsUsed: envResult?.envSharedVarsUsed ?? [],
			providerKeyNamesUsed: envResult?.providerKeyNamesUsed ?? [],
			nonCanonicalProviderKeyNames: envResult?.nonCanonicalProviderKeyNames ?? [],
			applyEnvOverridesReturnsConfig: envResult?.applyEnvOverridesReturnsConfig ?? false,
			hasApplyEnvOverridesFunc: envResult?.hasApplyEnvOverridesFunc ?? false,
			hasConfigErrorClass: envResult?.hasConfigErrorClass ?? false,
			hasProcessExit: envResult?.hasProcessExit ?? false,
			usesBracketNotation: envResult?.usesBracketNotation ?? false,
			loadConfigReturnsFullConfig: envResult?.loadConfigReturnsFullConfig ?? false,
			// Source
			srcWrapperUsageCount: sourceResult?.srcWrapperUsageCount ?? 0,
			srcSnakeCaseStringLiterals: sourceResult?.srcSnakeCaseStringLiterals ?? [],
			hasDirectConsoleUsage: sourceResult?.hasDirectConsoleUsage ?? false,
			directConsoleUsage: sourceResult?.directConsoleUsage ?? [],
			hasChalkUsage: sourceResult?.hasChalkUsage ?? false,
			chalkUsageFiles: sourceResult?.chalkUsageFiles ?? [],
			hasNonBunShebang: sourceResult?.hasNonBunShebang ?? false,
			nonBunShebangFiles: sourceResult?.nonBunShebangFiles ?? [],
			hasNonBunRuntimeInvocations: sourceResult?.hasNonBunRuntimeInvocations ?? false,
			nonBunRuntimeInvocations: sourceResult?.nonBunRuntimeInvocations ?? [],
			hasDeprecatedExports: sourceResult?.hasDeprecatedExports ?? false,
			deprecatedExports: sourceResult?.deprecatedExports ?? [],
			hasCompatibilityVestigeComments: sourceResult?.hasCompatibilityVestigeComments ?? false,
			testDirExists: sourceResult?.testDirExists ?? false,
			typesFileExists: sourceResult?.typesFileExists ?? false,
			typesIsDirectory: sourceResult?.typesIsDirectory ?? false,
			// CLI
			cliPath: cliResult?.cliPath,
			cliExists: cliResult?.cliExists ?? false,
			cliHasCreateProgramFunc: cliResult?.cliHasCreateProgramFunc ?? false,
			cliHasModuleLevelProgram: cliResult?.cliHasModuleLevelProgram ?? false,
			cliHasExecutionGuard: cliResult?.cliHasExecutionGuard ?? false,
			cliProgramNameMatchesRiff: cliResult?.cliProgramNameMatchesRiff ?? false,
			cliProgramName: cliResult?.cliProgramName ?? null,
			cliImportsPackageManifest: cliResult?.cliImportsPackageManifest ?? false,
			cliUsesPackageDescription: cliResult?.cliUsesPackageDescription ?? false,
			cliUsesPackageVersion: cliResult?.cliUsesPackageVersion ?? false,
			cliHelpRenders: cliHelpResult?.cliHelpRenders ?? false,
			cliHelpExitCode: cliHelpResult?.cliHelpExitCode ?? -1,
			cliHelpOutput: cliHelpResult?.cliHelpOutput ?? '',
			// Structure
			readmeExists: structureResult?.readmeExists ?? false,
			testUnitDirExists: structureResult?.testUnitDirExists ?? false,
			testUnitDirHasFiles: structureResult?.testUnitDirHasFiles ?? false,
			testIntegrationDirExists: structureResult?.testIntegrationDirExists ?? false,
			testIntegrationDirHasFiles: structureResult?.testIntegrationDirHasFiles ?? false,
			tuiDirExists: structureResult?.tuiDirExists ?? false,
			tuiDirHasFiles: structureResult?.tuiDirHasFiles ?? false,
			coreDirExists: structureResult?.coreDirExists ?? false,
			coreDirHasFiles: structureResult?.coreDirHasFiles ?? false,
			libDirExists: structureResult?.libDirExists ?? false,
			libDirHasFiles: structureResult?.libDirHasFiles ?? false,
			emptyDirectories: structureResult?.emptyDirectories ?? [],
			// TUI
			tuiPath: tuiResult?.tuiPath,
			tuiRenderExists: tuiResult?.tuiRenderExists ?? false,
			tuiExportsApp: tuiResult?.tuiExportsApp ?? false,
			tuiExportsRenderApp: tuiResult?.tuiExportsRenderApp ?? false,
			tuiExportsTuiController: tuiResult?.tuiExportsTuiController ?? false,
			tuiUsesAriaTuiPackage: tuiResult?.tuiUsesAriaTuiPackage ?? false,
			tuiUsesInk: tuiResult?.tuiUsesInk ?? false,
			tuiHasAppShell: tuiResult?.tuiHasAppShell ?? false,
			// Package.json scripts
			hasBuildScript: scriptsResult?.hasBuildScript ?? false,
			hasStartScript: scriptsResult?.hasStartScript ?? false,
			hasTestScript: scriptsResult?.hasTestScript ?? false,
			hasTypecheckScript: scriptsResult?.hasTypecheckScript ?? false,
			missingScripts: scriptsResult?.missingScripts ?? [],
			nonCanonicalScripts: scriptsResult?.nonCanonicalScripts ?? [],
			// Package dependencies
			packageManager: dependencyResult?.packageManager ?? null,
			packageManagerMatchesCanonical: dependencyResult?.packageManagerMatchesCanonical ?? false,
			bunEngine: dependencyResult?.bunEngine ?? null,
			bunEngineMatchesCanonical: dependencyResult?.bunEngineMatchesCanonical ?? false,
			nodeEngine: dependencyResult?.nodeEngine ?? null,
			nodeEngineMatchesCanonical: dependencyResult?.nodeEngineMatchesCanonical ?? false,
			dependencyNames: dependencyResult?.dependencyNames ?? [],
			sourceDependencies: dependencyResult?.sourceDependencies ?? [],
			dependenciesSorted: dependencyResult?.dependenciesSorted ?? false,
			invalidDependencySpecs: dependencyResult?.invalidDependencySpecs ?? [],
			sharedDependencyVersionMismatches: dependencyResult?.sharedDependencyVersionMismatches ?? [],
			undeclaredSourceDependencies: dependencyResult?.undeclaredSourceDependencies ?? [],
			unusedDeclaredDependencies: dependencyResult?.unusedDeclaredDependencies ?? [],
			hasCanonicalDependencies: dependencyResult?.hasCanonicalDependencies ?? false,
			// TSConfig
			tsconfigPath: tsconfigResult?.tsconfigPath,
			tsconfigExists: tsconfigResult?.tsconfigExists ?? false,
			tsconfigMatchesCanonical: tsconfigResult?.tsconfigMatchesCanonical ?? false,
			tsconfigHasExtends: tsconfigResult?.tsconfigHasExtends ?? false,
			tsconfigDifferences: tsconfigResult?.tsconfigDifferences ?? [],
			// Paths structure
			pathsHasNestedStructure: pathsResult?.pathsHasNestedStructure ?? false,
			pathsValidCategories: pathsResult?.pathsValidCategories ?? true,
			pathsHasFlatKeys: pathsResult?.pathsHasFlatKeys ?? false,
			pathsFlatKeys: pathsResult?.pathsFlatKeys ?? [],
			pathsInvalidCategories: pathsResult?.pathsInvalidCategories ?? [],
			pathsNonCanonicalCacheReferences: pathsResult?.pathsNonCanonicalCacheReferences ?? [],
			pathsLoggingHasFile: pathsResult?.pathsLoggingHasFile ?? false,
			pathsLoggingFollowsConvention: pathsResult?.pathsLoggingFollowsConvention ?? false,
			pathsOrphanedSections: pathsResult?.pathsOrphanedSections ?? [],
			// Config test pattern
			hasExpandTilde: configTestResult?.hasExpandTilde ?? false,
			hasExpandTildePaths: configTestResult?.hasExpandTildePaths ?? false,
			loadConfigCallsExpandTildePaths: configTestResult?.loadConfigCallsExpandTildePaths ?? false,
			hasConfigUnitTest: configTestResult?.hasConfigUnitTest ?? false,
			hasConfigIntegrationTest: configTestResult?.hasConfigIntegrationTest ?? false,
			hasTildeExpansionTest: configTestResult?.hasTildeExpansionTest ?? false,
			fragileAssertions: configTestResult?.fragileAssertions ?? [],
			nonCanonicalFixtureConfigPaths: configTestResult?.nonCanonicalFixtureConfigPaths ?? [],
			// Validation
			validationStatus: (validationResult?.validationStatus as ValidationStatus) ?? 'skipped',
			validationIssues: validationResult?.validationIssues ?? [],
			// Status
			status,
			issues,
		};
	}

	/**
	 * Run health check on all riffs and return summary.
	 */
	async runHealthCheck(): Promise<HealthSummary> {
		const riffsDir = resolve(this.repoRoot, this.config.paths.input.riffs);

		const riffs = listRiffDirs(riffsDir);

		// Check for co-located configs (config.yaml in each riff's directory)
		const riffsWithConfigMissing = riffs.filter(riff => {
			const configPath = resolve(riffsDir, riff, 'config.yaml');
			return !existsSync(configPath);
		});
		// With co-located configs, orphan configs can't exist (config lives with riff)
		const configsWithoutRiffs: string[] = [];

		this.logger.info({ riffCount: riffs.length }, 'Starting riff audit');

		const details: RiffHealth[] = [];
		for (const riff of riffs) {
			details.push(await this.auditRiff(riff));
		}
		const healthy = details.filter(d => d.status === 'healthy').map(d => d.riff);
		const hasIssues = details.filter(d => d.status === 'issues').map(d => d.riff);
		const unhealthy = details.filter(d => d.status === 'unhealthy').map(d => d.riff);

		this.logger.info(
			{
				total: riffs.length,
				healthy: healthy.length,
				hasIssues: hasIssues.length,
				unhealthy: unhealthy.length,
			},
			'Riff audit complete'
		);

		return {
			riffsTotal: riffs.length,
			riffsWithConfigMissing,
			configsWithoutRiffs,
			healthy,
			hasIssues,
			unhealthy,
			details,
		};
	}

	/**
	 * Write health summary to JSON file.
	 */
	writeReport(summary: HealthSummary): string {
		const outputDir = this.config.paths.output.dir;
		const outputPath = resolve(outputDir, this.config.paths.output.filename);

		mkdirSync(outputDir, { recursive: true });
		writeFileSync(outputPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

		this.logger.info({ path: outputPath }, 'Report written');
		return outputPath;
	}

	/**
	 * Run full audit and write report.
	 */
	async execute(): Promise<HealthSummary> {
		const summary = await this.runHealthCheck();
		this.writeReport(summary);

		// Log individual riff status
		for (const riff of summary.healthy) {
			this.logger.info({ riff, status: 'healthy' }, 'Riff OK');
		}

		for (const riff of summary.hasIssues) {
			const detail = summary.details.find(d => d.riff === riff);
			if (detail) {
				this.logger.warn({ riff, issues: detail.issues }, 'Riff has issues');
			}
		}

		for (const riff of summary.unhealthy) {
			const detail = summary.details.find(d => d.riff === riff);
			if (detail) {
				this.logger.error({ riff, issues: detail.issues }, 'Riff unhealthy');
			}
		}

		return summary;
	}
}
