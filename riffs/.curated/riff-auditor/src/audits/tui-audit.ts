/**
 * TUI audits - checks for TUI file existence and required exports
 */

import { resolve } from 'node:path';
import { readFileIfExists, riffRoot } from './utils.js';

// =============================================================================
// TYPES
// =============================================================================

export interface TuiAuditResult {
	tuiPath?: string;
	tuiRenderExists: boolean;
	tuiExportsApp: boolean;
	tuiExportsRenderApp: boolean;
	tuiExportsTuiController: boolean;
	tuiUsesAriaTuiPackage: boolean;
	tuiUsesInk: boolean;
	tuiHasAppShell: boolean;
}

// =============================================================================
// MAIN AUDIT FUNCTION
// =============================================================================

export function auditTui(riff: string, repoRoot: string): TuiAuditResult {
	const tuiPath = resolve(riffRoot(repoRoot, riff), 'src', 'tui', 'render.tsx');
	const content = readFileIfExists(tuiPath);

	if (!content) {
		return {
			tuiPath: undefined,
			tuiRenderExists: false,
			tuiExportsApp: false,
			tuiExportsRenderApp: false,
			tuiExportsTuiController: false,
			tuiUsesAriaTuiPackage: false,
			tuiUsesInk: false,
			tuiHasAppShell: false,
		};
	}

	// Check for required exports
	const tuiExportsApp = /export\s+function\s+App\s*\(/.test(content) || /export\s+const\s+App\s*=/.test(content);

	const tuiExportsRenderApp =
		/export\s+(?:async\s+)?function\s+renderApp\s*\(/.test(content) ||
		/export\s+default\s+renderApp/.test(content) ||
		/export\s+\{\s*[^}]*renderApp[^}]*\}/.test(content);

	const tuiExportsTuiController =
		/export\s+interface\s+TuiController/.test(content) || /export\s+type\s+TuiController/.test(content);

	// Check for required imports/usage
	const tuiUsesAriaTuiPackage = /@aria\/tui/.test(content);
	const tuiUsesInk = /from\s+['"]ink['"]/.test(content);
	const tuiHasAppShell = /AppShell/.test(content);

	return {
		tuiPath,
		tuiRenderExists: true,
		tuiExportsApp,
		tuiExportsRenderApp,
		tuiExportsTuiController,
		tuiUsesAriaTuiPackage,
		tuiUsesInk,
		tuiHasAppShell,
	};
}
