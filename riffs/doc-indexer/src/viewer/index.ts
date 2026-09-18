import * as fs from 'node:fs/promises';
import path from 'node:path';
import type { GraphExport } from '../graph/types.js';
import type { RfpDocMetadata } from '../lib/types.js';
import { createRiffbar } from './components/riffbar.js';
import { createSidebar } from './components/sidebar.js';
import { createHtmlTemplate } from './template.js';
import { createDocumentView, getDocumentStyles } from './views/document.js';
import { createGraphView } from './views/graph.js';

export interface HtmlGeneratorOptions {
	initialMode?: 'dim' | 'hide';
	initialRfp?: string;
	title?: string;
	documentsPath?: string;
}

function deriveRfpFromPath(fullPath?: string): string {
	if (!fullPath) return 'unknown';
	const parts = fullPath.split(/[\\/]+/);

	// Generic path-based extraction: look for common organizational patterns
	// Handles paths like: .aria/exports/<org>/<project>/<client>/...
	const commonDirs = ['exports', 'sources', 'documents', 'rfp', 'rfps', 'clients', 'projects'];

	// Find the first directory that comes after a common organizational directory
	for (let i = 0; i < parts.length - 1; i++) {
		if (commonDirs.includes(parts[i].toLowerCase())) {
			// Return the next part as the identifier
			const candidate = parts[i + 1];
			if (candidate && candidate !== 'assets' && candidate !== 'node_modules') {
				return candidate;
			}
		}
	}

	// Final fallback: use the deepest directory before filename
	return parts.length >= 2 ? parts[parts.length - 2] : 'unknown';
}

export async function generateHtml(
	graphJsonPath: string,
	outFile: string,
	options: HtmlGeneratorOptions = {}
): Promise<void> {
	const raw = await fs.readFile(graphJsonPath, 'utf-8');
	const graph = JSON.parse(raw) as GraphExport;

	// Try to load documents JSONL if it exists
	const documentsData: RfpDocMetadata[] = [];
	// Use provided documents path or look in same directory as graph
	const jsonlPath = options.documentsPath || path.join(path.dirname(graphJsonPath), 'documents.jsonl');
	try {
		const jsonlContent = await fs.readFile(jsonlPath, 'utf-8');
		const lines = jsonlContent.trim().split('\n');
		for (const line of lines) {
			if (line) {
				try {
					documentsData.push(JSON.parse(line));
				} catch (e) {
					console.warn('Failed to parse JSONL line:', e);
				}
			}
		}
		console.log(`Loaded ${documentsData.length} documents from JSONL`);
	} catch {
		console.log('No documents.jsonl found, markdown viewing will be limited');
	}

	// Load mermaid content for Leader nodes that have mermaid_file paths
	const leaderMermaidData: Record<string, string> = {};
	for (const node of graph.nodes) {
		if (node.label === 'Leader' && node.props?.mermaid_file) {
			const mermaidPath = node.props.mermaid_file as string;
			const leaderName = node.props.name as string;
			try {
				const mermaidContent = await fs.readFile(mermaidPath, 'utf-8');
				leaderMermaidData[leaderName] = mermaidContent;
			} catch {
				console.warn(`Could not load mermaid file for ${leaderName}: ${mermaidPath}`);
			}
		}
	}
	if (Object.keys(leaderMermaidData).length > 0) {
		console.log(`Loaded ${Object.keys(leaderMermaidData).length} leader mermaid charts`);
	}

	// Load images for Asset nodes
	const assetImageData: Record<string, string> = {};
	const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'];
	const maxImageSize = 2 * 1024 * 1024; // 2MB limit per image

	// Build map of document ID to full_path for resolving asset paths
	const docPaths = new Map<string, string>();
	for (const node of graph.nodes) {
		if (node.label === 'Document' && node.props?.full_path) {
			docPaths.set(node.id, node.props.full_path as string);
		}
	}

	// Find asset edges to get document -> asset relationships
	const assetToDoc = new Map<string, string>();
	for (const edge of graph.edges) {
		if (edge.relation === 'Asset') {
			assetToDoc.set(edge.to, edge.from);
		}
	}

	// Process Asset nodes that are images
	for (const node of graph.nodes) {
		if (node.label === 'Asset' && node.props?.path) {
			const assetPath = node.props.path as string;
			const ext = path.extname(assetPath).toLowerCase();

			if (!imageExtensions.includes(ext)) continue;

			// Get parent document's path
			const docId = assetToDoc.get(node.id);
			if (!docId) continue;

			const docFullPath = docPaths.get(docId);
			if (!docFullPath) continue;

			// Resolve asset path relative to document directory
			const docDir = path.dirname(docFullPath);

			// Try the path as-is first, then try normalized path (for duplicated assets/XX/assets/XX patterns)
			const pathsToTry = [
				path.join(docDir, assetPath),
				// Handle duplicated path pattern: assets/BR8/assets/BR8/file.png -> assets/BR8/file.png
				path.join(docDir, assetPath.replace(/^(assets\/[^/]+)\/\1\//, '$1/')),
			];

			let imageBuffer: Buffer | null = null;

			for (const tryPath of pathsToTry) {
				try {
					const stats = await fs.stat(tryPath);
					if (stats.size > maxImageSize) {
						console.warn(
							`Skipping large image (${(stats.size / 1024 / 1024).toFixed(1)}MB): ${path.basename(tryPath)}`
						);
						break;
					}
					imageBuffer = await fs.readFile(tryPath);
					break;
				} catch {
					// Try next path
				}
			}

			if (imageBuffer) {
				const mimeTypes: Record<string, string> = {
					'.png': 'image/png',
					'.jpg': 'image/jpeg',
					'.jpeg': 'image/jpeg',
					'.gif': 'image/gif',
					'.svg': 'image/svg+xml',
					'.webp': 'image/webp',
				};
				const mime = mimeTypes[ext] || 'image/png';
				const base64 = imageBuffer.toString('base64');
				assetImageData[assetPath] = `data:${mime};base64,${base64}`;
			}
		}
	}

	if (Object.keys(assetImageData).length > 0) {
		console.log(`Loaded ${Object.keys(assetImageData).length} asset images as base64`);
	}

	// Load images from original RFP documents (images/ subfolder pattern)
	// These documents use paths like "images/image20.png" relative to the doc
	const fullRfpImageDirs = new Set<string>();

	// Find Citation nodes that reference full RFP files
	for (const node of graph.nodes) {
		if (node.label === 'Citation' && node.props?.file) {
			const rfpFilePath = node.props.file as string;
			const rfpDir = path.dirname(rfpFilePath);
			const imagesDir = path.join(rfpDir, 'images');
			fullRfpImageDirs.add(imagesDir);
		}
	}

	// Also check full-rfp documents in JSONL data
	// Full RFP docs have a different shape with 'path' property
	for (const doc of documentsData) {
		const docAny = doc as unknown as Record<string, unknown>;
		if (typeof docAny.id === 'string' && docAny.id.startsWith('full-rfp:') && typeof docAny.path === 'string') {
			const docPath = docAny.path;
			const rfpDir = path.dirname(docPath);
			const imagesDir = path.join(rfpDir, 'images');
			fullRfpImageDirs.add(imagesDir);
		}
	}

	// Load images from each full RFP images directory
	let fullRfpImageCount = 0;
	for (const imagesDir of fullRfpImageDirs) {
		try {
			const files = await fs.readdir(imagesDir);
			for (const file of files) {
				const ext = path.extname(file).toLowerCase();
				if (!imageExtensions.includes(ext)) continue;

				const imagePath = path.join(imagesDir, file);
				try {
					const stats = await fs.stat(imagePath);
					if (stats.size > maxImageSize) {
						console.warn(`Skipping large image (${(stats.size / 1024 / 1024).toFixed(1)}MB): ${file}`);
						continue;
					}

					const imageBuffer = await fs.readFile(imagePath);
					const mimeTypes: Record<string, string> = {
						'.png': 'image/png',
						'.jpg': 'image/jpeg',
						'.jpeg': 'image/jpeg',
						'.gif': 'image/gif',
						'.svg': 'image/svg+xml',
						'.webp': 'image/webp',
					};
					const mime = mimeTypes[ext] || 'image/png';
					const base64 = imageBuffer.toString('base64');

					// Key by relative path used in documents: images/filename.ext
					const relativeKey = `images/${file}`;
					if (!assetImageData[relativeKey]) {
						assetImageData[relativeKey] = `data:${mime};base64,${base64}`;
						fullRfpImageCount++;
					}
				} catch {
					// Skip unreadable files
				}
			}
		} catch {
			// images/ directory doesn't exist, skip
		}
	}

	if (fullRfpImageCount > 0) {
		console.log(`Loaded ${fullRfpImageCount} full RFP images as base64`);
	}

	// Process graph data
	type CyElem = { data: Record<string, string | number | boolean | null | undefined> };
	const elements: CyElem[] = [];
	const rfps = new Set<string>();
	const relations = new Set<string>();

	// Check if any documents have content
	const hasDocumentContent = graph.nodes.some(n => n.label === 'Document' && n.props && 'content' in n.props);

	for (const n of graph.nodes) {
		const props = (n.props as Record<string, string | number | boolean> | undefined) || {};
		// Only Document nodes have RFP associations
		const rfp = n.label === 'Document' ? deriveRfpFromPath(String(props.full_path ?? '')) : null;
		if (rfp && rfp !== 'unknown') {
			rfps.add(rfp);
		}
		elements.push({ data: { id: n.id, label: n.label, rfp, ...props } });
	}

	for (const e of graph.edges) {
		elements.push({
			data: {
				id: `${e.from}->${e.to}:${e.relation}`.replace(/[^A-Za-z0-9:_\-.]/g, '_'),
				source: e.from,
				target: e.to,
				relation: e.relation,
			},
		});
		relations.add(e.relation);
	}

	const initialMode = options.initialMode ?? 'dim';
	const initialRfp = options.initialRfp ?? 'all';
	const title = options.title ?? 'RFP Knowledge Graph';

	// Load local libraries from source location
	const srcRoot = path.resolve(path.dirname(import.meta.url.replace('file://', '')), '../../src');
	const libsPath = path.join(srcRoot, 'viewer', 'libs');
	const cytoscapeJs = await fs.readFile(path.join(libsPath, 'cytoscape.min.js'), 'utf-8');
	const markedJs = await fs.readFile(path.join(libsPath, 'marked.min.js'), 'utf-8');
	const markedAlertJs = await fs.readFile(path.join(libsPath, 'marked-alert.min.js'), 'utf-8');

	// Build the complete HTML with properly embedded JavaScript
	const html = createHtmlTemplate({
		title,
		riffs: [
			'<script src="https://cdn.tailwindcss.com"></script>',
			`<script>${cytoscapeJs}</script>`,
			`<script>${markedJs}</script>`,
			`<script>${markedAlertJs}</script>`,
			'<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>',
		],
		styles: [
			`<style>
                body { height: 100vh; }
                #cy { height: 100%; width: 100%; }
                .panel { min-width: 280px; width: 320px; max-width: 360px; }
                #details { word-break: break-word; overflow-wrap: anywhere; white-space: normal; }
                #details a { word-break: break-word; overflow-wrap: anywhere; }
                .view-btn.active {
                    background-color: #1e293b;
                    color: white;
                }
                .view-btn:not(.active) {
                    background-color: #e2e8f0;
                    color: #475569;
                }
                ${getDocumentStyles()}
            </style>`,
		],
		body: `
    <div class="h-screen w-screen overflow-hidden bg-slate-50">
        <div class="flex h-full">
            ${createSidebar({
				rfps: Array.from(rfps).sort(),
				relations: Array.from(relations).sort(),
				initialMode,
				initialRfp,
			})}
            <main class="grow flex flex-col">
                ${createRiffbar()}
                <div class="grow relative">
                    ${createGraphView()}
                    ${createDocumentView()}
                </div>
            </main>
        </div>
    </div>

    <script>
        const GRAPH_DATA = ${JSON.stringify({
			elements,
			rfps: Array.from(rfps).sort(),
			relations: Array.from(relations).sort(),
			hasDocumentContent,
		})};
        const DOCUMENTS_DATA = ${JSON.stringify(documentsData)};
        const LEADER_MERMAID_DATA = ${JSON.stringify(leaderMermaidData)};
        const ASSET_IMAGE_DATA = ${JSON.stringify(assetImageData)};
        const initial = {
            mode: ${JSON.stringify(initialMode)},
            rfp: ${JSON.stringify(initialRfp)}
        };

        let cy = null;
        let currentNode = null;
        let documentContent = new Map(); // Map of document ID to content
        let leaderMermaidContent = new Map(); // Map of leader name to mermaid content

        // Initialize leader mermaid content from embedded data
        for (const [name, content] of Object.entries(LEADER_MERMAID_DATA)) {
            leaderMermaidContent.set(name, content);
        }

        // Initialize asset image content from embedded data
        let assetImageContent = new Map(); // Map of asset path to data URL
        for (const [assetPath, dataUrl] of Object.entries(ASSET_IMAGE_DATA)) {
            assetImageContent.set(assetPath, dataUrl);
        }

        function buildNodeFilters(nodeLabels) {
            const container = document.getElementById('nodeFilters');
            container.innerHTML = '';
            nodeLabels.forEach(label => {
                const id = 'node_' + label.replace(/[^A-Za-z0-9_-]/g, '_');
                const div = document.createElement('div');
                div.className = 'flex items-center gap-2';
                const cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.id = id;
                cb.value = label;
                cb.className = 'h-4 w-4';
                cb.checked = true;
                const lab = document.createElement('label');
                lab.className = 'text-sm';
                lab.htmlFor = id;
                lab.textContent = label;
                div.appendChild(cb);
                div.appendChild(lab);
                container.appendChild(div);
            });
        }

        function getActiveNodeTypes() {
            return Array.from(document.querySelectorAll('#nodeFilters input[type=checkbox]'))
                .filter(cb => cb.checked)
                .map(cb => cb.value);
        }

        function buildRelationFilters(relations) {
            const container = document.getElementById('relationFilters');
            container.innerHTML = '';
            relations.forEach(r => {
                const id = 'rel_' + r.replace(/[^A-Za-z0-9_-]/g, '_');
                const div = document.createElement('div');
                div.className = 'flex items-center gap-2';
                const cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.id = id;
                cb.value = r;
                cb.className = 'h-4 w-4';
                cb.checked = true;
                const lab = document.createElement('label');
                lab.className = 'text-sm';
                lab.htmlFor = id;
                lab.textContent = r;
                div.appendChild(cb);
                div.appendChild(lab);
                container.appendChild(div);
            });
        }

        function getActiveRelations() {
            return Array.from(document.querySelectorAll('#relationFilters input[type=checkbox]'))
                .filter(cb => cb.checked)
                .map(cb => cb.value);
        }

        function predicate(node, activeRfp, q) {
            const data = node.data();
            // RFP filter only applies to Document nodes
            if (activeRfp && activeRfp !== 'all' && data.label === 'Document') {
                if (data.rfp !== activeRfp) return false;
            }
            if (q) {
                const hay = [data.id, data.title, data.department, data.category, data.identifier]
                    .filter(Boolean).join(' ').toLowerCase();
                if (!hay.includes(q.toLowerCase())) return false;
            }
            return true;
        }

        function applyFilters(cy) {
            const mode = document.getElementById('modeSelect').value;
            const activeRfp = document.getElementById('rfpSelect').value;
            const q = document.getElementById('searchInput').value.trim();
            const activeRelations = new Set(getActiveRelations());
            const activeNodeTypes = new Set(getActiveNodeTypes());

            cy.batch(() => {
                cy.elements().removeClass('dim hidden');

                // Hide edges based on relation filters
                cy.edges().forEach(e => {
                    if (!activeRelations.has(e.data('relation'))) e.addClass('hidden');
                });

                // Hide nodes based on node type filters and other criteria
                cy.nodes().forEach(n => {
                    const label = n.data('label');
                    if (!activeNodeTypes.has(label)) {
                        n.addClass('hidden');
                    } else {
                        // Apply other filters only if node type is active
                        const ok = predicate(n, activeRfp, q);
                        if (!ok) {
                            if (mode === 'hide') n.addClass('hidden');
                            else n.addClass('dim');
                        }
                    }
                });

                // Clean up orphaned nodes when in hide mode
                if (mode === 'hide') {
                    const visibleEdges = cy.edges(':visible');
                    const connected = new Set();
                    visibleEdges.forEach(e => {
                        connected.add(e.data('source'));
                        connected.add(e.data('target'));
                    });
                    cy.nodes(':visible').forEach(n => {
                        if (!connected.has(n.id())) n.addClass('hidden');
                    });
                }
            });
        }

        function renderDetails(ele) {
            const box = document.getElementById('details');
            if (!ele) {
                box.innerHTML = '';
                currentNode = null;
                updateRiffbar();
                return;
            }
            currentNode = ele;
            updateRiffbar();
            const d = ele.data();

            // Group fields by importance for better display
            const primaryFields = ['identifier', 'title', 'description', 'name', 'type', 'category', 'priority'];
            const metaFields = ['department', 'leader', 'rfp_name', 'client', 'vendor', 'proposal_date'];
            const pathFields = ['full_path', 'relative_path', 'file', 'path'];
            const skipFields = ['content', 'id', 'label', 'rfp', 'text', 'text_len', 'source', 'target'];

            let html = '';

            // Show node type badge
            if (d.label) {
                const badgeColors = {
                    'Document': 'bg-blue-100 text-blue-800',
                    'Category': 'bg-pink-100 text-pink-800',
                    'Department': 'bg-yellow-100 text-yellow-800',
                    'Type': 'bg-purple-100 text-purple-800',
                    'Priority': 'bg-red-100 text-red-800',
                    'Client': 'bg-green-100 text-green-800',
                    'Vendor': 'bg-cyan-100 text-cyan-800',
                    'RFP': 'bg-amber-100 text-amber-800',
                    'Leader': 'bg-emerald-100 text-emerald-800',
                    'Citation': 'bg-rose-100 text-rose-800',
                    'Asset': 'bg-violet-100 text-violet-800'
                };
                const badgeClass = badgeColors[d.label] || 'bg-slate-100 text-slate-800';
                html += '<div class="mb-2"><span class="px-2 py-0.5 rounded text-xs font-medium ' + badgeClass + '">' + d.label + '</span>';
                if (d.customise === true) {
                    html += ' <span class="px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">Customise</span>';
                }
                html += '</div>';
            }

            // Primary fields (most important)
            const shownFields = new Set();
            for (const k of primaryFields) {
                if (d[k] !== undefined && d[k] !== null && d[k] !== '') {
                    shownFields.add(k);
                    const val = String(d[k]);
                    if (k === 'priority') {
                        const priorityColors = {
                            'Must Fully Comply': 'text-red-600 font-semibold',
                            'Should Comply': 'text-yellow-600 font-semibold',
                            'Nice to Comply': 'text-green-600 font-semibold'
                        };
                        const pClass = priorityColors[val] || '';
                        html += '<div><span class="text-slate-400">' + k + ':</span> <span class="' + pClass + '">' + val + '</span></div>';
                    } else if (k === 'category') {
                        const catColors = {
                            'standard': 'text-green-600',
                            'hybrid': 'text-yellow-600',
                            'specific': 'text-red-600'
                        };
                        const cClass = catColors[val] || '';
                        html += '<div><span class="text-slate-400">' + k + ':</span> <span class="' + cClass + ' font-medium">' + val + '</span></div>';
                    } else {
                        html += '<div><span class="text-slate-400">' + k + ':</span> ' + val + '</div>';
                    }
                }
            }

            // Meta fields
            for (const k of metaFields) {
                if (d[k] !== undefined && d[k] !== null && d[k] !== '') {
                    shownFields.add(k);
                    const val = String(d[k]);
                    html += '<div><span class="text-slate-400">' + k + ':</span> ' + val + '</div>';
                }
            }

            // Path fields (clickable)
            for (const k of pathFields) {
                if (d[k] !== undefined && d[k] !== null && d[k] !== '') {
                    shownFields.add(k);
                    const val = String(d[k]);
                    if (k === 'full_path' || k === 'file') {
                        const startLine = (d.line_range && d.line_range[0]) ? d.line_range[0] :
                                         (d.source_citation && d.source_citation.line_range) ? d.source_citation.line_range[0] : '';
                        const href = 'file://' + d[k] + (startLine ? ':' + startLine : '');
                        const displayText = val.split('/').pop() + (startLine ? ':' + startLine : '');
                        html += '<div><span class="text-slate-400">' + k + ':</span> ' +
                               '<a class="text-blue-600 underline" href="' + href + '" title="' + val + '">' + displayText + '</a></div>';
                    } else {
                        html += '<div><span class="text-slate-400">' + k + ':</span> ' + val + '</div>';
                    }
                }
            }

            // Line range for Citation nodes
            if (d.line_range && d.label === 'Citation') {
                shownFields.add('line_range');
                const range = d.line_range;
                const rangeText = Array.isArray(range) ? 'Lines ' + range[0] + '-' + range[1] : String(range);
                html += '<div><span class="text-slate-400">line_range:</span> <span class="font-semibold">' + rangeText + '</span></div>';
            }

            // Remaining fields
            const allFields = Object.keys(d).filter(k => !skipFields.includes(k) && !shownFields.has(k)).sort();
            for (const k of allFields) {
                if (d[k] !== undefined && d[k] !== null && d[k] !== '') {
                    const val = String(d[k]);
                    html += '<div><span class="text-slate-400">' + k + ':</span> ' + val + '</div>';
                }
            }

            box.innerHTML = html;
        }

        function switchView(viewName) {
            const graphView = document.getElementById('cy');
            const markdownView = document.getElementById('markdown-view');
            const graphBtn = document.getElementById('viewGraphBtn');
            const markdownBtn = document.getElementById('viewMarkdownBtn');

            if (viewName === 'markdown') {
                graphView.classList.add('hidden');
                markdownView.classList.remove('hidden');
                graphBtn.classList.remove('active');
                markdownBtn.classList.add('active');
                renderMarkdown();
            } else {
                graphView.classList.remove('hidden');
                markdownView.classList.add('hidden');
                graphBtn.classList.add('active');
                markdownBtn.classList.remove('active');
            }
        }

        function loadDocumentContent() {
            // Load documents from embedded data
            for (const doc of DOCUMENTS_DATA) {
                if (doc.id && doc.content) {
                    documentContent.set(doc.id, doc);
                }
            }
            console.log('Loaded', documentContent.size, 'documents with content');
        }

        function renderMarkdown() {
            if (!currentNode) {
                document.getElementById('markdown-title').textContent = 'No Document Selected';
                document.getElementById('markdown-meta').textContent = '';
                document.getElementById('markdown-content').innerHTML =
                    '<p class="text-slate-500">Select a node in the graph to view its markdown content.</p>';
                return;
            }

            const data = currentNode.data();
            let content = null;
            let lineToScrollTo = null;

            // Handle Leader nodes specially - show HR profile and org chart
            if (data.label === 'Leader') {
                const name = data.name || 'Unknown';
                document.getElementById('markdown-title').textContent = name;

                const metaParts = [];
                if (data.title) metaParts.push(data.title);
                if (data.hr_department) metaParts.push(data.hr_department);
                document.getElementById('markdown-meta').textContent = metaParts.join(' • ') || 'Leader';

                // Build profile card HTML with compact list styling
                let profileHtml = '<div class="profile-card">';
                profileHtml += '<h2>' + name + '</h2>';
                profileHtml += '<ul class="profile-list">';
                if (data.title) {
                    profileHtml += '<li><strong>Title:</strong> ' + data.title + '</li>';
                }
                if (data.hr_department) {
                    profileHtml += '<li><strong>Department:</strong> ' + data.hr_department + '</li>';
                }
                if (data.email) {
                    profileHtml += '<li><strong>Email:</strong> <a href="mailto:' + data.email + '">' + data.email + '</a></li>';
                }
                if (data.mobile && data.mobile !== 'Unlisted') {
                    profileHtml += '<li><strong>Phone:</strong> ' + data.mobile + '</li>';
                }
                if (data.manager) {
                    profileHtml += '<li><strong>Reports to:</strong> ' + data.manager + '</li>';
                }
                if (data.location) {
                    profileHtml += '<li><strong>Location:</strong> ' + data.location + '</li>';
                }
                if (data.street_address) {
                    profileHtml += '<li><strong>Address:</strong> ' + data.street_address + '</li>';
                }
                profileHtml += '</ul>';
                profileHtml += '</div>';

                // Check for mermaid content
                const mermaidContent = leaderMermaidContent.get(name);
                if (mermaidContent) {
                    profileHtml += '<h3>Organization Chart</h3>';
                    profileHtml += '<div class="mermaid">' + mermaidContent + '</div>';
                } else if (data.mermaid_file) {
                    profileHtml += '<p class="text-slate-500"><em>Organization chart available at: ' + data.mermaid_file + '</em></p>';
                }

                document.getElementById('markdown-content').innerHTML = profileHtml;

                // Trigger mermaid rendering if available
                if (mermaidContent && typeof mermaid !== 'undefined') {
                    try {
                        mermaid.run({ nodes: document.querySelectorAll('.mermaid') });
                    } catch (e) {
                        console.warn('Mermaid rendering failed:', e);
                    }
                }
                return;
            }

            // Handle Asset nodes specially - show embedded image
            if (data.label === 'Asset' && data.path) {
                const assetPath = data.path;
                const filename = assetPath.split('/').pop() || 'Asset';
                document.getElementById('markdown-title').textContent = filename;
                document.getElementById('markdown-meta').textContent = 'Image Asset';

                const imageDataUrl = assetImageContent.get(assetPath);
                let assetHtml = '<div class="asset-view">';

                if (imageDataUrl) {
                    assetHtml += '<div class="asset-image-container">';
                    assetHtml += '<img src="' + imageDataUrl + '" alt="' + filename + '" class="asset-image" />';
                    assetHtml += '</div>';
                    assetHtml += '<p class="asset-path"><strong>Path:</strong> ' + assetPath + '</p>';
                } else {
                    assetHtml += '<p class="text-slate-500">Image not embedded in viewer.</p>';
                    assetHtml += '<p class="asset-path"><strong>Path:</strong> ' + assetPath + '</p>';
                }

                assetHtml += '</div>';
                document.getElementById('markdown-content').innerHTML = assetHtml;
                return;
            }

            // Handle Citation nodes specially
            if (data.label === 'Citation' && data.file) {
                // Look for the full RFP file in our document content
                const fullRfpId = 'full-rfp:' + data.file.split('/').pop();
                const fullRfpDoc = documentContent.get(fullRfpId);

                if (fullRfpDoc && fullRfpDoc.content) {
                    content = fullRfpDoc.content;
                    lineToScrollTo = data.line_range ? data.line_range[0] : null;

                    // Update title and meta for Citation
                    const lineRange = data.line_range ? ' (Lines ' + data.line_range[0] + '-' + data.line_range[1] + ')' : '';
                    document.getElementById('markdown-title').textContent = 'Citation: ' + (data.identifier || data.id) + lineRange;
                    document.getElementById('markdown-meta').textContent = 'From: ' + data.file.split('/').pop();
                } else {
                    document.getElementById('markdown-title').textContent = 'Citation: ' + (data.identifier || data.id);
                    document.getElementById('markdown-meta').textContent = 'Full RFP not available';
                    document.getElementById('markdown-content').innerHTML =
                        '<p class="text-slate-500">Full RFP content not available. ' +
                        'Click the file link in the details panel to open in your editor.</p>';
                    return;
                }
            } else {
                // Regular document node or other node types
                const title = data.title || data.name || data.identifier || data.id || 'Untitled';
                const meta = [
                    data.identifier && 'ID: ' + data.identifier,
                    data.category && 'Category: ' + data.category,
                    data.department && 'Department: ' + data.department
                ].filter(Boolean).join(' • ');

                document.getElementById('markdown-title').textContent = title;
                document.getElementById('markdown-meta').textContent = meta || data.label || '';

                // Try to get content from JSONL data
                const docData = documentContent.get(data.id);
                content = docData ? docData.content : data.content;
            }

            if (content) {
                // Replace image paths with embedded base64 data URLs
                let processedContent = content;
                for (const [assetPath, dataUrl] of assetImageContent.entries()) {
                    // Replace both the exact path and any variations
                    processedContent = processedContent.split(assetPath).join(dataUrl);
                }

                // Parse and render markdown
                const html = marked.parse(processedContent);
                document.getElementById('markdown-content').innerHTML = html;

                // Auto-scroll to line if needed (for Citation nodes)
                if (lineToScrollTo) {
                    setTimeout(() => {
                        scrollToLine(lineToScrollTo);
                    }, 100);
                }
            } else {
                document.getElementById('markdown-content').innerHTML =
                    '<p class="text-slate-500">No markdown content available. ' +
                    'Content may still be loading or not available for this document.</p>';
            }
        }

        function scrollToLine(lineNumber) {
            // Simple scroll based on line number
            // This is a rough approximation - in a real app we'd need better line tracking
            const scrollContainer = document.querySelector('#markdown-view .flex-1.overflow-y-auto');
            if (scrollContainer && lineNumber) {
                // Estimate pixels per line (conservative estimate)
                const pixelsPerLine = 20;
                const scrollPosition = (lineNumber - 1) * pixelsPerLine;
                scrollContainer.scrollTop = scrollPosition;
            }
        }

        function updateRiffbar() {
            const info = document.getElementById('currentNodeInfo');

            if (currentNode) {
                const data = currentNode.data();
                const nodeInfo = data.identifier || data.title || data.id || '';
                info.textContent = nodeInfo ? 'Selected: ' + nodeInfo : '';
            } else {
                info.textContent = '';
            }
        }

        function basename(p) {
            return String(p || '').split(/[\\\\\\/]/).filter(Boolean).pop() || '';
        }

        function computeNodeText(d) {
            const nodeType = d.label;
            if (nodeType === 'Document') return d.identifier || d.title || basename(d.relative_path) || d.id;
            if (nodeType === 'Category') return d.name || 'Category';
            if (nodeType === 'Department') return d.name || 'Department';
            if (nodeType === 'Leader') return String(d.name || '') || 'Leader';
            if (nodeType === 'Citation') return d.identifier || 'Section';
            if (nodeType === 'Asset') return basename(d.path) || 'Asset';
            if (nodeType === 'Type') return d.name || 'Type';
            if (nodeType === 'Priority') return d.name || 'Priority';
            if (nodeType === 'Client') return d.name || 'Client';
            if (nodeType === 'Vendor') return d.name || 'Vendor';
            if (nodeType === 'RFP') return d.name || 'RFP';
            return d.title || d.identifier || d.name || d.id;
        }

        function init() {
            // Configure marked with GitHub alerts extension
            if (typeof window.markedAlert !== 'undefined') {
                marked.use(window.markedAlert());
                console.log('Marked configured with GitHub alerts support');
            }

            // Initialize mermaid for org chart rendering
            if (typeof mermaid !== 'undefined') {
                mermaid.initialize({
                    startOnLoad: false,
                    theme: 'default',
                    securityLevel: 'loose'
                });
                console.log('Mermaid initialized for org chart rendering');
            }

            // Load document content from embedded data
            loadDocumentContent();

            const layoutOptions = {
                name: 'cose',
                fit: false,
                animate: true,
                animationDuration: 300,
                padding: 50,
                randomize: false,
                nodeRepulsion: (node) => {
                    // Base repulsion for all nodes
                    const baseRepulsion = 800000;

                    // Get the degree (number of connections) for this node
                    const degree = node.degree();

                    // Scale repulsion based on degree
                    // Nodes with few connections (1-3) get base repulsion
                    // Nodes with many connections get exponentially more repulsion
                    if (degree <= 3) {
                        return baseRepulsion;
                    } else if (degree <= 10) {
                        // Moderate scaling for medium-connected nodes
                        return baseRepulsion * (1 + (degree - 3) * 0.5);
                    } else {
                        // Strong scaling for highly connected nodes (hubs)
                        // Use quadratic scaling for very connected nodes
                        return baseRepulsion * (1 + Math.pow(degree / 5, 2));
                    }
                },
                idealEdgeLength: (edge) => {
                    // Also scale edge length based on node connectivity
                    const sourceDegree = edge.source().degree();
                    const targetDegree = edge.target().degree();
                    const avgDegree = (sourceDegree + targetDegree) / 2;

                    // Highly connected nodes should have longer edges
                    const baseLength = 200;
                    if (avgDegree > 10) {
                        return baseLength * (1 + avgDegree / 20);
                    }
                    return baseLength;
                },
                edgeElasticity: () => 80,
                nodeOverlap: 2,
                nestingFactor: 1.2,
                gravity: 0.5,
                numIter: 2500,
                initialTemp: 1000,
                coolingFactor: 0.99,
                minTemp: 1.0
            };

            cy = cytoscape({
                container: document.getElementById('cy'),
                elements: GRAPH_DATA.elements,
                style: [
                    { selector: 'node', style: {
                        'label': 'data(text)',
                        'text-valign': 'center',
                        'color': '#0f172a',
                        'background-color': '#93c5fd',
                        'border-color': '#1e3a8a',
                        'border-width': 1,
                        'font-size': 10,
                        'min-zoomed-font-size': 6,
                        'text-wrap': 'none',
                        'width': 'mapData(text_len, 4, 40, 60, 240)',
                        'height': 28,
                        'shape': 'round-rectangle',
                        'z-index-compare': 'manual',
                        'z-index': 10
                    }},
                    { selector: 'node[label = "Category"]', style: { 'background-color': '#f5d0fe' }},
                    { selector: 'node[label = "Department"]', style: { 'background-color': '#fde68a' }},
                    { selector: 'node[label = "Leader"]', style: { 'background-color': '#bbf7d0' }},
                    { selector: 'node[label = "Citation"]', style: { 'background-color': '#fecaca' }},
                    { selector: 'node[label = "Asset"]', style: { 'background-color': '#e9d5ff' }},
                    { selector: 'node[label = "Type"]', style: { 'background-color': '#c4b5fd', 'border-color': '#7c3aed' }},
                    { selector: 'node[label = "Priority"]', style: { 'background-color': '#fca5a5', 'border-color': '#dc2626' }},
                    { selector: 'node[label = "Client"]', style: { 'background-color': '#6ee7b7', 'border-color': '#059669' }},
                    { selector: 'node[label = "Vendor"]', style: { 'background-color': '#67e8f9', 'border-color': '#0891b2' }},
                    { selector: 'node[label = "RFP"]', style: { 'background-color': '#fcd34d', 'border-color': '#d97706', 'font-weight': 'bold' }},
                    // Document coloring by category
                    { selector: 'node[label = "Document"][category = "standard"]', style: { 'background-color': '#86efac', 'border-color': '#16a34a' }},
                    { selector: 'node[label = "Document"][category = "hybrid"]', style: { 'background-color': '#fde047', 'border-color': '#ca8a04' }},
                    { selector: 'node[label = "Document"][category = "specific"]', style: { 'background-color': '#fca5a5', 'border-color': '#dc2626' }},
                    // Document coloring by type (secondary)
                    { selector: 'node[label = "Document"][type = "BR"]', style: { 'border-width': 2 }},
                    { selector: 'node[label = "Document"][type = "MR"]', style: { 'border-width': 2 }},
                    { selector: 'node[label = "Document"][type = "SR"]', style: { 'border-width': 2 }},
                    { selector: 'node[label = "Document"][type = "PR"]', style: { 'border-width': 2 }},
                    // Customise indicator (documents that need customization)
                    { selector: 'node[label = "Document"][customise = true]', style: { 'border-style': 'dashed' }},
                    { selector: 'edge', style: {
                        'width': 1,
                        'line-color': '#94a3b8',
                        'target-arrow-shape': 'triangle',
                        'target-arrow-color': '#94a3b8',
                        'curve-style': 'bezier',
                        'z-index-compare': 'manual',
                        'z-index': 5
                    }},
                    { selector: '.dim', style: { 'opacity': 0.15, 'z-index': 0 }},
                    { selector: '.hidden', style: { 'display': 'none' }},
                    { selector: 'node.highlight', style: {
                        'border-color': '#2563eb',
                        'border-width': 3,
                        'opacity': 1,
                        'z-index': 1000,
                        'overlay-color': '#3b82f6',
                        'overlay-opacity': 0.18
                    }},
                    { selector: 'edge.highlight', style: {
                        'line-color': '#2563eb',
                        'target-arrow-color': '#2563eb',
                        'width': 2,
                        'opacity': 1,
                        'z-index': 900
                    }}
                ],
                layout: layoutOptions
            });

            // Compute readable labels
            cy.nodes().forEach(function(n) {
                const t = computeNodeText(n.data()) || '';
                n.data('text', t);
                n.data('text_len', String(t).length);
            });

            // Initialize RFP select
            const rfpSelect = document.getElementById('rfpSelect');
            const rfpVals = ['all', ...GRAPH_DATA.rfps];
            rfpVals.forEach(v => {
                const opt = document.createElement('option');
                opt.value = v;
                opt.textContent = v;
                rfpSelect.appendChild(opt);
            });
            rfpSelect.value = initial.rfp;

            // Extract unique node labels and build filters
            const nodeElements = GRAPH_DATA.elements.filter(el => !el.data.source); // nodes don't have source
            const nodeLabels = [...new Set(nodeElements.map(n => n.data.label))].sort();
            buildNodeFilters(nodeLabels);
            buildRelationFilters(GRAPH_DATA.relations);
            document.getElementById('modeSelect').value = initial.mode;

            // Event listeners
            ['change', 'input'].forEach(evt => {
                document.getElementById('rfpSelect').addEventListener(evt, () => applyFilters(cy));
                document.getElementById('modeSelect').addEventListener(evt, () => applyFilters(cy));
                document.getElementById('searchInput').addEventListener(evt, () => applyFilters(cy));
            });

            document.getElementById('nodeFilters').addEventListener('change', () => applyFilters(cy));
            document.getElementById('relationFilters').addEventListener('change', () => applyFilters(cy));
            document.getElementById('fitBtn').addEventListener('click', () => cy.fit());
            document.getElementById('layoutBtn').addEventListener('click', () => {
                cy.batch(() => cy.elements().removeClass('highlight dim hidden'));
                const l = cy.layout(layoutOptions);
                l.run();
            });
            document.getElementById('resetBtn').addEventListener('click', () => {
                document.getElementById('searchInput').value = '';
                document.getElementById('modeSelect').value = initial.mode;
                document.getElementById('rfpSelect').value = initial.rfp;
                Array.from(document.querySelectorAll('#nodeFilters input[type=checkbox]'))
                    .forEach(cb => cb.checked = true);
                Array.from(document.querySelectorAll('#relationFilters input[type=checkbox]'))
                    .forEach(cb => cb.checked = true);
                cy.batch(() => cy.elements().removeClass('highlight dim hidden'));
                applyFilters(cy);
                cy.fit();
                renderDetails(null);
            });

            // View toggle buttons
            document.getElementById('viewGraphBtn').addEventListener('click', () => switchView('graph'));
            document.getElementById('viewMarkdownBtn').addEventListener('click', () => switchView('markdown'));

            // Node selection
            cy.on('tap', 'node', function(e) {
                const enabled = document.getElementById('neighborhoodToggle').checked;
                renderDetails(e.target);
                if (enabled) {
                    const nhood = e.target.closedNeighborhood();
                    cy.batch(function() {
                        cy.elements().removeClass('highlight dim');
                        cy.elements().difference(nhood).addClass('dim');
                        nhood.addClass('highlight');
                    });
                }
            });

            cy.on('tap', function(e) {
                const enabled = document.getElementById('neighborhoodToggle').checked;
                if (enabled && e.target === cy) {
                    cy.elements().removeClass('highlight dim');
                }
            });

            applyFilters(cy);

            // Log for debugging
            console.log('Graph loaded:', cy.nodes().length, 'nodes,', cy.edges().length, 'edges');
        }

        window.addEventListener('DOMContentLoaded', init);
    </script>`,
	});

	await fs.mkdir(path.dirname(outFile), { recursive: true });
	await fs.writeFile(outFile, html, 'utf-8');
}
