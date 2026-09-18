/**
 * Commit Formatter -- RiffPrompt definition
 */
export const riffPrompt = {
	name: 'commit-formatter',
	summary: 'Conventional commit message formatting via LLM analysis with three processing modes',
	purpose:
		'Scans git commit history and uses LLM providers (Anthropic, Gemini, or OpenAI) to reformat commit messages into Conventional Commits v1.0.0 format. Provides three processing modes: automatic (full auto-apply for archived repos), assisted (human-in-the-loop with immediate apply for active repos), and advisory (suggestions only, no changes). Creates backup branches before any modifications and generates JSON/Markdown reports. Supports author rewriting for commit attribution changes.',
	whenToUse: [
		'Reformatting messy commit history in archived or legacy repositories to conventional commit format',
		'Reviewing and selectively approving commit message rewrites in active repositories',
		'Generating advisory reports of suggested commit message improvements without modifying history',
		'Cleaning up commit history before publishing a repository or sharing with new team members',
		'Standardizing commit messages across a project for changelog generation',
	],
	pipeline: [
		'Scan git log for the specified number of commits (default: 20)',
		'Optionally skip commits already in conventional format (--skip-conventional)',
		'Send each commit message to the configured LLM provider for analysis',
		'LLM classifies commit type (feat, fix, chore, docs, refactor, etc.) and generates formatted message',
		'In automatic mode: create backup branch, apply all reformatted messages via interactive rebase',
		'In assisted mode: present each suggestion for approval/skip/edit, apply immediately on approval',
		'In advisory mode: generate Markdown report with all suggestions, never modify history',
		'Generate JSON and/or Markdown reports documenting all changes',
	],
	parameters: [
		{
			name: 'command',
			type: 'enum(automatic|assisted|advisory|check|preview|format)',
			required: true,
			description:
				'Processing mode: automatic (full auto), assisted (approve each), advisory (report only), check (test API), preview (single commit), format (legacy)',
		},
		{ name: '--count', type: 'number', required: false, description: 'Number of commits to scan (default: 20)' },
		{
			name: '--dry-run',
			type: 'flag',
			required: false,
			description: 'Preview changes without modifying git history',
		},
		{
			name: '--no-skip-conventional',
			type: 'flag',
			required: false,
			description: 'Include already-formatted conventional commits',
		},
		{
			name: '--no-backup',
			type: 'flag',
			required: false,
			description: 'Skip backup branch creation (not recommended)',
		},
		{ name: '--no-report', type: 'flag', required: false, description: 'Skip generating report files' },
		{
			name: '--author-name',
			type: 'string',
			required: false,
			description: 'Rewrite all commit authors to this name',
		},
		{
			name: '--author-email',
			type: 'string',
			required: false,
			description: 'Rewrite all commit authors to this email',
		},
		{ name: '-v, --verbose', type: 'flag', required: false, description: 'Enable verbose debug logging' },
	],
	output: 'Reformatted git commit history (automatic/assisted modes) or Markdown report with suggestions (advisory mode). Backup branches created as backup-before-reformat-YYYYMMDD. JSON and Markdown reports generated with change details. Requires force push after history rewrite.',
	constraints: [
		'Requires API key for the configured LLM provider (ANTHROPIC_API_KEY, GOOGLE_API_KEY, or OPENAI_API_KEY)',
		'Non-dry-run operations require a clean git working directory',
		'History rewrite requires force push (git push --force-with-lease) afterward',
		'Team members must re-clone or reset after force push',
		'Each commit analyzed sends one API request to the LLM provider',
	],
	conventions: [
		'Always use --dry-run first to preview what would change',
		'Always verify backup branch exists before force pushing',
		'Use advisory mode when you only want to review suggestions',
		'Use assisted mode for active repositories where careful review is needed',
		'Use automatic mode only for archived or legacy repositories',
		'Configure LLM provider in config.yaml (co-located in the riff directory), API keys in .env file',
		'Invocation pattern: $RIFF [mode] [options]',
	],
	examples: [
		{
			description: 'Preview automatic reformatting without changes',
			command: '$RIFF automatic --dry-run',
			outcome: 'Shows what each commit message would be reformatted to without modifying history',
		},
		{
			description: 'Interactively approve commit rewrites',
			command: '$RIFF assisted --count 50',
			outcome: 'Presents each of the last 50 commits for approval, applies approved changes immediately',
		},
		{
			description: 'Generate advisory report only',
			command: '$RIFF advisory --count 30',
			outcome:
				'Creates a Markdown report with reformatting suggestions for the last 30 commits without modifying anything',
		},
	],
};
