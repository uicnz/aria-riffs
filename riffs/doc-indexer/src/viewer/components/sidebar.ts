export interface SidebarOptions {
	rfps: string[];
	relations: string[];
	initialMode: 'dim' | 'hide';
	initialRfp: string;
}

export function createSidebar(options: SidebarOptions): string {
	return `
    <aside class="panel shrink-0 border-r border-slate-200 bg-white p-4 space-y-4 overflow-y-auto">
        <div>
            <h1 class="text-xl font-semibold">Aria doc-indexer</h1>
            <p class="text-xs text-slate-500">Interactive knowledge graph viewer</p>
        </div>

        <div class="space-y-2">
            <label class="block text-sm font-medium">RFPs</label>
            <select id="rfpSelect" class="w-full rounded border px-2 py-1 text-sm">
                <!-- Options populated by JavaScript -->
            </select>
        </div>

        <div class="space-y-2">
            <label class="block text-sm font-medium">Node filters</label>
            <div id="nodeFilters" class="rounded border p-2 space-y-1">
                <!-- Populated by JavaScript -->
            </div>
        </div>

        <div class="space-y-2">
            <label class="block text-sm font-medium">Relation filters</label>
            <div id="relationFilters" class="rounded border p-2 space-y-1">
                <!-- Populated by JavaScript -->
            </div>
        </div>

        <div class="space-y-2">
            <label class="block text-sm font-medium">Search</label>
            <input id="searchInput" type="text" placeholder="id, title, department, category"
                    class="w-full rounded border px-2 py-1 text-sm" />
        </div>

        <div class="space-y-2">
            <label class="block text-sm font-medium">Mode</label>
            <select id="modeSelect" class="w-full rounded border px-2 py-1 text-sm">
                <option value="dim" ${options.initialMode === 'dim' ? 'selected' : ''}>Dim unmatched</option>
                <option value="hide" ${options.initialMode === 'hide' ? 'selected' : ''}>Hide unmatched</option>
            </select>
        </div>

        <div class="flex items-center gap-2">
            <input id="neighborhoodToggle" type="checkbox" class="h-4 w-4" />
            <label for="neighborhoodToggle" class="text-sm">Neighborhood on click</label>
        </div>

        <div class="flex gap-2">
            <button id="fitBtn" class="rounded bg-slate-800 text-white px-3 py-1 text-sm">Fit</button>
            <button id="layoutBtn" class="rounded bg-slate-200 px-3 py-1 text-sm">Re-layout</button>
            <button id="resetBtn" class="rounded bg-slate-200 px-3 py-1 text-sm">Reset</button>
        </div>

        <div id="details" class="text-xs text-slate-700">
            <!-- Node details populated here -->
        </div>
    </aside>`;
}
