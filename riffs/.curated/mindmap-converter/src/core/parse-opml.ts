/**
 * OPML parser module
 */

import { XMLParser } from 'fast-xml-parser';
import { XML_PARSER_OPTIONS } from '../lib/config.js';
import type { MindmapNode, ParseResult } from '../lib/types.js';

interface OpmlOutline {
	text: string;
	outline?: OpmlOutline | OpmlOutline[];
}

interface OpmlStructure {
	opml: {
		head?: {
			title?: string;
			dateCreated?: string;
			generator?: string;
		};
		body: {
			outline: OpmlOutline;
		};
	};
}

/**
 * Parse OPML XML content into structured mindmap nodes
 */
export function parseOpml(xmlContent: string): ParseResult {
	const parser = new XMLParser(XML_PARSER_OPTIONS);
	const parsed = parser.parse(xmlContent) as OpmlStructure;

	if (!parsed.opml?.body?.outline) {
		throw new Error('Invalid OPML structure: missing required elements');
	}

	const root = transformOpmlOutline(parsed.opml.body.outline);

	const metadata: Partial<{
		title: string;
		dateCreated: string;
		generator: string;
	}> = {};

	if (parsed.opml.head?.title) metadata.title = parsed.opml.head.title;
	if (parsed.opml.head?.dateCreated) metadata.dateCreated = parsed.opml.head.dateCreated;
	if (parsed.opml.head?.generator) metadata.generator = parsed.opml.head.generator;

	return {
		root,
		format: 'opml',
		metadata,
	};
}

/**
 * Transform OPML outline structure into MindmapNode hierarchy
 */
function transformOpmlOutline(outline: OpmlOutline): MindmapNode {
	const node: MindmapNode = {
		text: outline.text || '',
		children: [],
	};

	if (outline.outline) {
		const children = Array.isArray(outline.outline) ? outline.outline : [outline.outline];

		node.children = children.map(transformOpmlOutline);
	}

	return node;
}

/**
 * Validate OPML content before parsing
 */
export function validateOpml(xmlContent: string): boolean {
	try {
		const parser = new XMLParser(XML_PARSER_OPTIONS);
		const parsed = parser.parse(xmlContent) as OpmlStructure;

		return !!parsed.opml?.body?.outline;
	} catch {
		return false;
	}
}
