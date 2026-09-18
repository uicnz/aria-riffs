/**
 * Logger implementation audit - detects standalone-hostile pino transport workers.
 *
 * Extracted riffs must not depend on runtime-only transport targets such as
 * pino-pretty or pino-roll. Those targets are resolved by module name at
 * runtime, which escapes Bun's static bundle graph and can also trigger
 * _flushSync hangs under the embedded Bun runtime.
 */

import { resolve } from 'node:path';
import { readFileIfExists } from './utils.js';

export interface LoggerAuditResult {
	loggerPath?: string;
	loggerExists: boolean;
	hasLoggerOptionsInterface: boolean;
	hasCreateLoggerSignature: boolean;
	hasSilentOption: boolean;
	usesPinoPrettyImport: boolean;
	usesStdoutDestination: boolean;
	usesPinoTransportCall: boolean;
	usesInlineTransportConfig: boolean;
	usesTransportTargets: boolean;
	usesPinoPrettyTarget: boolean;
	usesPinoRollTarget: boolean;
	usesDestinationStreams: boolean;
	usesMultistream: boolean;
	usesSilentConsoleGate: boolean;
	defaultLogPathMatchesRiff: boolean;
	matchesCanonicalPattern: boolean;
	isStandaloneSafe: boolean;
}

function stripComments(content: string): string {
	return content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function hasPinoTransportCall(content: string): boolean {
	return /pino\.transport\s*\(/.test(content);
}

function hasPinoPrettyImport(content: string): boolean {
	return /from\s+['"]pino-pretty['"]/.test(content);
}

function hasStdoutDestination(content: string): boolean {
	return /stream\s*:\s*pino\.destination\s*\(\s*\{[^}]*\bdest\s*:\s*1\b/.test(content);
}

function hasInlineTransportConfig(content: string): boolean {
	return /transport\s*:\s*\{/.test(content);
}

function hasTransportTargets(content: string): boolean {
	return /\btargets\s*:\s*\[/.test(content);
}

function hasPrettyTarget(content: string): boolean {
	return /target\s*:\s*['"]pino-pretty['"]/.test(content);
}

function hasRollTarget(content: string): boolean {
	return /target\s*:\s*['"]pino-roll['"]/.test(content);
}

function hasDestinationStreams(content: string): boolean {
	return /pino\.destination\s*\(/.test(content);
}

function hasMultistream(content: string): boolean {
	return /pino\.multistream\s*\(/.test(content);
}

function hasLoggerOptionsInterface(content: string): boolean {
	return /export\s+interface\s+LoggerOptions\s*\{/.test(content);
}

function hasCreateLoggerSignature(content: string): boolean {
	return /export\s+function\s+createLogger\s*\(\s*options\s*:\s*LoggerOptions\s*\)\s*:\s*Logger/.test(content);
}

function hasSilentOption(content: string): boolean {
	return /\bsilent\?\s*:\s*boolean\b/.test(content);
}

function hasSilentConsoleGate(content: string): boolean {
	return /if\s*\(\s*!options\.silent\s*\)/.test(content);
}

function hasDefaultLogPath(content: string, riff: string): boolean {
	return (
		content.includes(`options.file || '.aria/logs/${riff}.log'`) ||
		content.includes(`options.file || ".aria/logs/${riff}.log"`)
	);
}

export function auditLogger(riff: string, repoRoot: string): LoggerAuditResult {
	const loggerPath = resolve(repoRoot, 'riffs', riff, 'src', 'lib', 'logger.ts');
	const content = readFileIfExists(loggerPath);

	if (!content) {
		return {
			loggerPath: undefined,
			loggerExists: false,
			hasLoggerOptionsInterface: false,
			hasCreateLoggerSignature: false,
			hasSilentOption: false,
			usesPinoPrettyImport: false,
			usesStdoutDestination: false,
			usesPinoTransportCall: false,
			usesInlineTransportConfig: false,
			usesTransportTargets: false,
			usesPinoPrettyTarget: false,
			usesPinoRollTarget: false,
			usesDestinationStreams: false,
			usesMultistream: false,
			usesSilentConsoleGate: false,
			defaultLogPathMatchesRiff: false,
			matchesCanonicalPattern: false,
			isStandaloneSafe: false,
		};
	}

	const executableContent = stripComments(content);

	const hasOptionsInterface = hasLoggerOptionsInterface(executableContent);
	const hasCreateLogger = hasCreateLoggerSignature(executableContent);
	const hasSilent = hasSilentOption(executableContent);
	const usesPinoPrettyImport = hasPinoPrettyImport(executableContent);
	const usesStdoutDestination = hasStdoutDestination(executableContent);
	const usesPinoTransportCall = hasPinoTransportCall(executableContent);
	const usesInlineTransportConfig = hasInlineTransportConfig(executableContent);
	const usesTransportTargets = hasTransportTargets(executableContent);
	const usesPinoPrettyTarget = hasPrettyTarget(executableContent);
	const usesPinoRollTarget = hasRollTarget(executableContent);
	const usesDestinationStreams = hasDestinationStreams(executableContent);
	const usesMultistream = hasMultistream(executableContent);
	const usesSilentConsoleGate = hasSilentConsoleGate(executableContent);
	const defaultLogPathMatchesRiff = hasDefaultLogPath(executableContent, riff);
	const usesStandaloneHostileTransport =
		usesPinoTransportCall ||
		usesInlineTransportConfig ||
		usesTransportTargets ||
		usesPinoPrettyTarget ||
		usesPinoRollTarget;

	const matchesCanonicalPattern =
		hasOptionsInterface &&
		hasCreateLogger &&
		hasSilent &&
		!usesPinoPrettyImport &&
		usesStdoutDestination &&
		usesDestinationStreams &&
		usesMultistream &&
		usesSilentConsoleGate &&
		defaultLogPathMatchesRiff &&
		!usesStandaloneHostileTransport;

	return {
		loggerPath,
		loggerExists: true,
		hasLoggerOptionsInterface: hasOptionsInterface,
		hasCreateLoggerSignature: hasCreateLogger,
		hasSilentOption: hasSilent,
		usesPinoPrettyImport,
		usesStdoutDestination,
		usesPinoTransportCall,
		usesInlineTransportConfig,
		usesTransportTargets,
		usesPinoPrettyTarget,
		usesPinoRollTarget,
		usesDestinationStreams,
		usesMultistream,
		usesSilentConsoleGate,
		defaultLogPathMatchesRiff,
		matchesCanonicalPattern,
		isStandaloneSafe: matchesCanonicalPattern,
	};
}
