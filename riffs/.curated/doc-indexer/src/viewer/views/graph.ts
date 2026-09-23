export function createGraphView(): string {
	return `<div id="cy" class="view-container"></div>`;
}

export function getGraphStyles(): string[] {
	return [
		`{ selector: 'node', style: {
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
        }}`,
		`{ selector: 'node[label = "Category"]', style: { 'background-color': '#f5d0fe' }}`,
		`{ selector: 'node[label = "Department"]', style: { 'background-color': '#fde68a' }}`,
		`{ selector: 'node[label = "Leader"]', style: { 'background-color': '#bbf7d0' }}`,
		`{ selector: 'node[label = "Citation"]', style: { 'background-color': '#fecaca' }}`,
		`{ selector: 'node[label = "Asset"]', style: { 'background-color': '#e9d5ff' }}`,
		`{ selector: 'node[label = "Type"]', style: { 'background-color': '#c4b5fd', 'border-color': '#7c3aed' }}`,
		`{ selector: 'node[label = "Priority"]', style: { 'background-color': '#fca5a5', 'border-color': '#dc2626' }}`,
		`{ selector: 'node[label = "Client"]', style: { 'background-color': '#6ee7b7', 'border-color': '#059669' }}`,
		`{ selector: 'node[label = "Vendor"]', style: { 'background-color': '#67e8f9', 'border-color': '#0891b2' }}`,
		`{ selector: 'node[label = "RFP"]', style: { 'background-color': '#fcd34d', 'border-color': '#d97706', 'font-weight': 'bold' }}`,
		// Document coloring by category
		`{ selector: 'node[label = "Document"][category = "standard"]', style: { 'background-color': '#86efac', 'border-color': '#16a34a' }}`,
		`{ selector: 'node[label = "Document"][category = "hybrid"]', style: { 'background-color': '#fde047', 'border-color': '#ca8a04' }}`,
		`{ selector: 'node[label = "Document"][category = "specific"]', style: { 'background-color': '#fca5a5', 'border-color': '#dc2626' }}`,
		// Customise indicator
		`{ selector: 'node[label = "Document"][customise = true]', style: { 'border-style': 'dashed' }}`,
		`{ selector: 'edge', style: {
            'width': 1,
            'line-color': '#94a3b8',
            'target-arrow-shape': 'triangle',
            'target-arrow-color': '#94a3b8',
            'curve-style': 'bezier',
            'z-index-compare': 'manual',
            'z-index': 5
        }}`,
		`{ selector: '.dim', style: { 'opacity': 0.15, 'z-index': 0 }}`,
		`{ selector: '.hidden', style: { 'display': 'none' }}`,
		`{ selector: 'node.highlight', style: {
            'border-color': '#2563eb',
            'border-width': 3,
            'opacity': 1,
            'z-index': 1000,
            'overlay-color': '#3b82f6',
            'overlay-opacity': 0.18
        }}`,
		`{ selector: 'edge.highlight', style: {
            'line-color': '#2563eb',
            'target-arrow-color': '#2563eb',
            'width': 2,
            'opacity': 1,
            'z-index': 900
        }}`,
	];
}

interface LayoutOptions {
	name: string;
	fit: boolean;
	animate: boolean;
	animationDuration: number;
	padding: number;
	randomize: boolean;
	nodeRepulsion: () => number;
	idealEdgeLength: () => number;
	edgeElasticity: () => number;
	nodeOverlap: number;
	nestingFactor: number;
	gravity: number;
	numIter: number;
	initialTemp: number;
	coolingFactor: number;
	minTemp: number;
}

export function getLayoutOptions(): LayoutOptions {
	return {
		name: 'cose',
		fit: false,
		animate: true,
		animationDuration: 300,
		padding: 50,
		randomize: false,
		nodeRepulsion: () => 1600000,
		idealEdgeLength: () => 200,
		edgeElasticity: () => 80,
		nodeOverlap: 2,
		nestingFactor: 1.2,
		gravity: 0.5,
		numIter: 2500,
		initialTemp: 1000,
		coolingFactor: 0.99,
		minTemp: 1.0,
	};
}
