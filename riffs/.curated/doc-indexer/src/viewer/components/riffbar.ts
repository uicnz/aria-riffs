export type RiffbarOptions = Record<string, never>;

export function createRiffbar(_options: RiffbarOptions = {} as RiffbarOptions): string {
	return `
    <div id="riffbar" class="riffbar bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between">
        <div class="view-toggle flex gap-2">
            <button id="viewGraphBtn" class="view-btn active px-4 py-1 rounded bg-slate-800 text-white text-sm">
                Graph View
            </button>
            <button id="viewMarkdownBtn" class="view-btn px-4 py-1 rounded bg-slate-200 text-slate-700 text-sm">
                Markdown View
            </button>
        </div>

        <div id="currentNodeInfo" class="text-sm text-slate-600">
            <!-- Shows current selected node info -->
        </div>
    </div>`;
}
