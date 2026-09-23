/**
 * FreeMind (.mm) parser module
 */

import { XMLParser } from 'fast-xml-parser';
import { XML_PARSER_OPTIONS } from '../lib/config.js';
import type { MindmapNode, ParseResult } from '../lib/types.js';

interface MindMapNode {
	ID: string;
	TEXT: string;
	node?: MindMapNode | MindMapNode[];
}

interface MindMapStructure {
	map: {
		version?: string;
		node: MindMapNode;
	};
}

/**
 * Parse FreeMind XML content into structured mindmap nodes
 */
export function parseMindMap(xmlContent: string): ParseResult {
	const parser = new XMLParser(XML_PARSER_OPTIONS);
	const parsed = parser.parse(xmlContent) as MindMapStructure;

	if (!parsed.map?.node) {
		throw new Error('Invalid FreeMind structure: missing required elements');
	}

	const root = transformMindMapNode(parsed.map.node);

	return {
		root,
		format: 'mm',
		metadata: {
			generator: 'FreeMind',
		},
	};
}

/**
 * Transform FreeMind node structure into MindmapNode hierarchy
 */
function transformMindMapNode(mmNode: MindMapNode): MindmapNode {
	const node: MindmapNode = {
		text: mmNode.TEXT || '',
		children: [],
	};

	if (mmNode.node) {
		const children = Array.isArray(mmNode.node) ? mmNode.node : [mmNode.node];

		node.children = children.map(transformMindMapNode);
	}

	return node;
}

/**
 * Validate FreeMind content before parsing
 */
export function validateMindMap(xmlContent: string): boolean {
	try {
		const parser = new XMLParser(XML_PARSER_OPTIONS);
		const parsed = parser.parse(xmlContent) as MindMapStructure;

		return !!parsed.map?.node?.TEXT;
	} catch {
		return false;
	}
}
