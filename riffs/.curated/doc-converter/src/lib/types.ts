export type DocType = 'docx' | 'pptx' | 'xlsx' | 'auto';

export type RuleCategory = 'headings' | 'lists' | 'tables' | 'images' | 'links' | 'html' | 'whitespace';

export interface RuleOptions {
	// Placeholder for per-rule options; rules can extend via generics if needed
	// biome-ignore lint/suspicious/noExplicitAny: Dynamic config object requires flexible typing
	[key: string]: any;
}

export interface AriaRule {
	names: string[]; // e.g., ["AR001", "ensure-h1-header"]
	description: string;
	tags: string[];
	category: RuleCategory;
	// The function receives markdown content and returns transformed content
	function: (content: string, options?: RuleOptions, ctx?: RuleContext) => string;
	defaultOptions?: RuleOptions;
}

export interface RuleContext {
	htmlFilePath?: string; // For rules that need to inspect the intermediate HTML
	docxFilenameStem?: string; // For AR001
}

export interface ProcessOptions {
	type: DocType;
	cleanFirst: boolean;
	lint?: boolean;
	lintFix?: boolean;
	lintConfigPath?: string | null;
	configPath?: string | null;
	inPlace?: boolean;
	dirsRecurse?: boolean;
	dirsPreserve?: boolean;
	dirsSanitize?: boolean;
	gitkeep?: boolean;
}

export interface Result {
	ok: boolean;
	code?: number;
	message?: string;
}
