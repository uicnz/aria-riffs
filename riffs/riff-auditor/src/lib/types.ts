/**
 * Type definitions for riff-auditor
 */

// =============================================================================
// VALIDATION TYPES
// =============================================================================

export type ValidationIssueType =
	| 'unknown_key'
	| 'type_error'
	| 'missing_required'
	| 'schema_not_found'
	| 'parse_error';

export interface ValidationIssue {
	type: ValidationIssueType;
	path: string;
	message: string;
}

// =============================================================================
// RIFF HEALTH TYPES
// =============================================================================

export type RiffHealthStatus = 'healthy' | 'issues' | 'unhealthy';

export type ValidationStatus = 'ok' | 'error' | 'warning' | 'skipped';

export interface RiffHealth {
	riff: string;
	// Canonical wiring contract
	wiringMissingCanonicalFiles: string[];
	wiringConfigExists: boolean;
	wiringPackageExists: boolean;
	wiringPackageJsonValid: boolean;
	wiringCliExists: boolean;
	wiringMetadataName: string | null;
	wiringMetadataNameMatchesRiff: boolean;
	wiringMetadataDescription: string | null;
	wiringPackageName: string | null;
	wiringPackageNameMatchesRiff: boolean;
	wiringPackageDescription: string | null;
	wiringMetadataDescriptionMatchesPackage: boolean;
	wiringPackageKeysMatchCanonical: boolean;
	wiringPackageVersion: string | null;
	wiringPackageVersionMatchesWorkspace: boolean;
	wiringPackageTypeMatchesCanonical: boolean;
	wiringPackageMainMatchesCanonical: boolean;
	wiringBinNameMatchesRiff: boolean;
	wiringBinPathMatchesCanonical: boolean;
	wiringPackageFilesMatchCanonical: boolean;
	promptPath: string;
	promptExists: boolean;
	promptLoads: boolean;
	promptMatchesCanonicalSchema: boolean;
	promptValidationIssues: string[];
	promptName: string | null;
	promptNameMatchesRiff: boolean;
	promptExamplesUsePlaceholder: boolean;
	// Config file checks
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
	// Schema checks
	schemaPath?: string;
	schemaExists: boolean;
	schemaHasWrapper: boolean;
	schemaHasLogging: boolean;
	// Config loader checks
	configLoaderPath?: string;
	configLoaderExists: boolean;
	configLoaderUsesWrapper: boolean;
	configLoaderUsesSchema: boolean;
	dotEnvLoaderPath?: string;
	dotEnvLoaderExists: boolean;
	hasAriaHomeConstant: boolean;
	hasGetAriaHome: boolean;
	hasLoadDotEnv: boolean;
	hasCanonicalDotEnvPrecedence: boolean;
	configLoadsDotEnv: boolean;
	// Logger implementation checks
	loggerPath?: string;
	loggerExists: boolean;
	loggerUsesPinoPrettyImport: boolean;
	loggerUsesStdoutDestination: boolean;
	loggerUsesPinoTransportCall: boolean;
	loggerUsesInlineTransportConfig: boolean;
	loggerUsesTransportTargets: boolean;
	loggerUsesPinoPrettyTarget: boolean;
	loggerUsesPinoRollTarget: boolean;
	loggerUsesDestinationStreams: boolean;
	loggerUsesMultistream: boolean;
	loggerIsStandaloneSafe: boolean;
	// Environment variable checks
	envPrefix: string;
	envPrefixUsed: boolean;
	envNonCanonicalVars: string[];
	envSharedVarsUsed: string[];
	providerKeyNamesUsed: string[];
	nonCanonicalProviderKeyNames: string[];
	// Source code checks
	srcWrapperUsageCount: number;
	srcSnakeCaseStringLiterals: string[];
	hasDirectConsoleUsage: boolean;
	directConsoleUsage: string[];
	hasChalkUsage: boolean;
	chalkUsageFiles: string[];
	hasNonBunShebang: boolean;
	nonBunShebangFiles: string[];
	hasNonBunRuntimeInvocations: boolean;
	nonBunRuntimeInvocations: string[];
	// Implementation pattern checks
	applyEnvOverridesReturnsConfig: boolean;
	hasConfigErrorClass: boolean;
	hasProcessExit: boolean;
	usesBracketNotation: boolean;
	loggingEnumLowercase: boolean;
	loggingDefaultsStandard: boolean;
	loggingExtraFields: string[];
	schemaRootStrict: boolean;
	schemaExtraRootSections: string[];
	testDirExists: boolean;
	typesFileExists: boolean;
	typesIsDirectory: boolean;
	// Parity pattern data
	loggingSchemaName: string;
	loggingTypeExportName: string;
	loggingDefaultPattern: string;
	hasApplyEnvOverridesFunc: boolean;
	usesLogLevelsConstant: boolean;
	riffSchemaExported: boolean;
	loadConfigReturnsFullConfig: boolean;
	loggingNestedInRiffSchema: boolean;
	// Deprecated exports
	hasDeprecatedExports: boolean;
	deprecatedExports: string[];
	// Compatibility vestige markers
	hasCompatibilityVestigeComments: boolean;
	// CLI pattern checks
	cliPath?: string;
	cliExists: boolean;
	cliHasCreateProgramFunc: boolean;
	cliHasModuleLevelProgram: boolean;
	cliHasExecutionGuard: boolean;
	cliProgramNameMatchesRiff: boolean;
	cliProgramName: string | null;
	cliImportsPackageManifest: boolean;
	cliUsesPackageDescription: boolean;
	cliUsesPackageVersion: boolean;
	cliHelpRenders: boolean;
	cliHelpExitCode: number;
	cliHelpOutput: string;
	// Structure checks
	readmeExists: boolean;
	testUnitDirExists: boolean;
	testUnitDirHasFiles: boolean;
	testIntegrationDirExists: boolean;
	testIntegrationDirHasFiles: boolean;
	tuiDirExists: boolean;
	tuiDirHasFiles: boolean;
	coreDirExists: boolean;
	coreDirHasFiles: boolean;
	libDirExists: boolean;
	libDirHasFiles: boolean;
	emptyDirectories: string[];
	// TUI checks
	tuiPath?: string;
	tuiRenderExists: boolean;
	tuiExportsApp: boolean;
	tuiExportsRenderApp: boolean;
	tuiExportsTuiController: boolean;
	tuiUsesAriaTuiPackage: boolean;
	tuiUsesInk: boolean;
	tuiHasAppShell: boolean;
	// Package.json scripts checks
	hasStartScript: boolean;
	hasTestScript: boolean;
	hasTypecheckScript: boolean;
	missingScripts: string[];
	nonCanonicalScripts: string[];
	// Package dependency checks
	packageManager: string | null;
	packageManagerMatchesCanonical: boolean;
	bunEngine: string | null;
	bunEngineMatchesCanonical: boolean;
	nodeEngine: string | null;
	nodeEngineMatchesCanonical: boolean;
	dependencyNames: string[];
	sourceDependencies: string[];
	dependenciesSorted: boolean;
	invalidDependencySpecs: string[];
	sharedDependencyVersionMismatches: string[];
	undeclaredSourceDependencies: string[];
	unusedDeclaredDependencies: string[];
	hasCanonicalDependencies: boolean;
	// TSConfig checks
	tsconfigPath?: string;
	tsconfigExists: boolean;
	tsconfigMatchesCanonical: boolean;
	tsconfigHasExtends: boolean;
	tsconfigDifferences: string[];
	// Paths structure audit
	pathsHasNestedStructure: boolean;
	pathsValidCategories: boolean;
	pathsHasFlatKeys: boolean;
	pathsFlatKeys: string[];
	pathsInvalidCategories: string[];
	pathsNonCanonicalCacheReferences: string[];
	pathsLoggingHasFile: boolean;
	pathsLoggingFollowsConvention: boolean;
	pathsOrphanedSections: string[];
	// Config test pattern checks
	hasExpandTilde: boolean;
	hasExpandTildePaths: boolean;
	loadConfigCallsExpandTildePaths: boolean;
	hasConfigUnitTest: boolean;
	hasConfigIntegrationTest: boolean;
	hasTildeExpansionTest: boolean;
	fragileAssertions: string[];
	nonCanonicalFixtureConfigPaths: string[];
	// Validation results
	validationStatus: ValidationStatus;
	validationIssues: ValidationIssue[];
	// Combined status
	status: RiffHealthStatus;
	issues: string[];
}

// =============================================================================
// HEALTH SUMMARY TYPES
// =============================================================================

export interface HealthSummary {
	riffsTotal: number;
	riffsWithConfigMissing: string[];
	configsWithoutRiffs: string[];
	healthy: string[];
	hasIssues: string[];
	unhealthy: string[];
	details: RiffHealth[];
}

// =============================================================================
// LOGGING DEFAULTS CHECK TYPES
// =============================================================================

export interface LoggingDefaultsResult {
	standard: boolean;
	maxFileSizeMb?: number;
	maxFiles?: number;
}
