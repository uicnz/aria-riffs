// Graph-specific type definitions

export interface GraphNode {
	id: string;
	label: string;
	props: Record<string, unknown>;
}

export interface GraphEdge {
	from: string;
	to: string;
	relation: string;
}

export interface GraphExport {
	nodes: GraphNode[];
	edges: GraphEdge[];
}

export interface GraphExportOptions {
	includeContent?: boolean;
	includeAssets?: boolean;
	/** Path to HR staffer database for enriching Leader nodes */
	hrStafferDbPath?: string;
	/** Path to HR staffer output directory (for mermaid files) */
	hrStafferOutputDir?: string;
}

/** HR staffer employee profile data */
export interface HrProfile {
	displayName: string;
	title: string;
	department: string;
	email: string;
	mobile: string;
	manager: string;
	streetAddress: string;
	city: string;
	country: string;
	mermaidFile?: string;
	orgChartAnchor?: string;
}
