export function createDocumentView(): string {
	return `
    <div id="markdown-view" class="view-container hidden">
        <div class="document-wrapper bg-white h-full flex flex-col">
            <div id="markdown-header" class="shrink-0 bg-white border-b border-slate-200 px-6 py-4">
                <h2 id="markdown-title" class="text-2xl font-bold text-slate-800">No Document Selected</h2>
                <p id="markdown-meta" class="text-sm text-slate-600 mt-1"></p>
            </div>
            <div class="flex-1 overflow-y-auto">
                <div id="markdown-content" class="px-6 py-4 prose prose-slate max-w-none">
                    <p class="text-slate-500">Select a node in the graph to view its markdown content.</p>
                </div>
            </div>
        </div>
    </div>`;
}

export function getDocumentStyles(): string {
	return `
    /* Document view styles */
    .view-container {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        width: 100%;
        height: 100%;
    }

    #markdown-view {
        background: #f8fafc;
    }

    .document-wrapper {
        max-width: 1200px;
        margin: 0 auto;
        height: 100%;
    }

    /* Prose styles for markdown content */
    .prose h1 { font-size: 2em; margin-top: 0.67em; margin-bottom: 0.67em; font-weight: bold; }
    .prose h2 { font-size: 1.5em; margin-top: 0.83em; margin-bottom: 0.83em; font-weight: bold; }
    .prose h3 { font-size: 1.17em; margin-top: 1em; margin-bottom: 1em; font-weight: bold; }
    .prose h4 { font-size: 1em; margin-top: 1.33em; margin-bottom: 1.33em; font-weight: bold; }
    .prose p { margin-top: 1em; margin-bottom: 1em; line-height: 1.6; }
    .prose ul { list-style-type: disc; padding-left: 2em; margin: 1em 0; }
    .prose ol { list-style-type: decimal; padding-left: 2em; margin: 1em 0; }
    .prose li { margin: 0.5em 0; }
    .prose blockquote {
        border-left: 4px solid #e2e8f0;
        padding-left: 1em;
        margin: 1em 0;
        color: #64748b;
        font-style: italic;
    }
    .prose code {
        background: #f1f5f9;
        padding: 0.2em 0.4em;
        border-radius: 0.25em;
        font-family: monospace;
        font-size: 0.9em;
    }
    .prose pre {
        background: #1e293b;
        color: #f1f5f9;
        padding: 1em;
        border-radius: 0.5em;
        overflow-x: auto;
        margin: 1em 0;
    }
    .prose pre code {
        background: transparent;
        padding: 0;
        color: inherit;
    }
    .prose table {
        border-collapse: collapse;
        width: 100%;
        margin: 1em 0;
    }
    .prose th, .prose td {
        border: 1px solid #e2e8f0;
        padding: 0.5em;
        text-align: left;
    }
    .prose th {
        background: #f8fafc;
        font-weight: bold;
    }

    /* GitHub-style Alert/Admonition styles */
    .markdown-alert {
        padding: 0.75rem 1rem;
        margin: 1rem 0;
        border-left: 0.25rem solid;
        border-radius: 0.375rem;
    }

    .markdown-alert-note {
        border-left-color: #2563eb;
        background-color: #dbeafe;
        color: #1e3a8a;
    }

    .markdown-alert-tip {
        border-left-color: #10b981;
        background-color: #d1fae5;
        color: #065f46;
    }

    .markdown-alert-important {
        border-left-color: #8b5cf6;
        background-color: #e9d5ff;
        color: #5b21b6;
    }

    .markdown-alert-warning {
        border-left-color: #f59e0b;
        background-color: #fef3c7;
        color: #92400e;
    }

    .markdown-alert-caution {
        border-left-color: #ef4444;
        background-color: #fee2e2;
        color: #991b1b;
    }

    .markdown-alert-title {
        display: flex;
        align-items: center;
        font-weight: 600;
        margin-bottom: 0.5rem;
    }

    .markdown-alert-title svg {
        margin-right: 0.5rem;
        width: 1rem;
        height: 1rem;
        fill: currentColor;
    }

    .markdown-alert p:last-child {
        margin-bottom: 0;
    }

    /* Section styles */
    .section-request {
        background: #f0f9ff;
        padding: 1em;
        border-radius: 0.5em;
        margin: 1em 0;
    }
    .section-response {
        background: #f0fdf4;
        padding: 1em;
        border-radius: 0.5em;
        margin: 1em 0;
    }

    /* Profile card styles for Leader nodes */
    .profile-card {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 0.5em;
        padding: 1.5em;
        margin-bottom: 1.5em;
    }
    .profile-card h2 {
        margin: 0 0 0.75em 0;
        color: #1e293b;
        font-size: 1.5em;
    }
    .profile-list {
        list-style: none;
        padding: 0;
        margin: 0;
    }
    .profile-list li {
        margin: 0.25em 0;
        line-height: 1.5;
    }
    .profile-list li strong {
        color: #64748b;
    }
    .profile-list a {
        color: #2563eb;
        text-decoration: underline;
    }

    /* Mermaid diagram container */
    .mermaid {
        background: #fff;
        padding: 1em;
        border-radius: 0.5em;
        margin: 1em 0;
        overflow-x: auto;
    }

    /* Asset image styles */
    .asset-view {
        padding: 1em 0;
    }
    .asset-image-container {
        background: #f1f5f9;
        border: 1px solid #e2e8f0;
        border-radius: 0.5em;
        padding: 1em;
        margin-bottom: 1em;
        text-align: center;
    }
    .asset-image {
        max-width: 100%;
        height: auto;
        border-radius: 0.25em;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    .asset-path {
        font-size: 0.875em;
        color: #64748b;
        word-break: break-all;
    }`;
}
