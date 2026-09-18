/**
 * Unit tests for AriaHeadingEnrichedStrategy
 * Tests callout metadata extraction and template enrichment
 */

import pino from 'pino';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ChunkingConfig } from '../../src/lib/types.js';
import { AriaHeadingEnrichedStrategy } from '../../src/strategies/aria/heading-enriched-strategy.js';

describe('AriaHeadingEnrichedStrategy', () => {
	let strategy: AriaHeadingEnrichedStrategy;
	let logger: pino.Logger;
	let config: ChunkingConfig;

	beforeEach(() => {
		logger = pino({ level: 'silent' });
		config = {
			strategy: 'aria.heading-enriched',
			'generic.hierarchical': {
				primaryLevel: 2,
				maxLevels: [2, 3, 4],
				maxTokens: 512,
				minTokens: 50,
				wholeDocumentThreshold: 512,
				fallback: 'paragraph',
				preserve: ['```', '~~~'],
				includeContext: true,
			},
			'aria.heading-enriched': {
				calloutPattern: '^>\\s*\\[!TIP\\]',
				fields: {
					identifier: {
						regex: '>\\s*\\*\\*Identifier:\\*\\*\\s*(.+)',
						name: 'identifier',
						captureGroup: 1,
						required: true,
					},
					description: {
						regex: '>\\s*\\*\\*Description:\\*\\*\\s*(.+)',
						name: 'description',
						captureGroup: 1,
						required: false,
					},
					priority: {
						regex: '>\\s*\\*\\*Priority:\\*\\*\\s*(.+)',
						name: 'priority',
						captureGroup: 1,
						required: false,
					},
					category: {
						regex: '>\\s*\\*\\*Category:\\*\\*\\s*(.+)',
						name: 'category',
						captureGroup: 1,
						required: false,
					},
					department: {
						regex: '>\\s*\\*\\*Department:\\*\\*\\s*(.+)',
						name: 'department',
						captureGroup: 1,
						required: false,
					},
					leader: {
						regex: '>\\s*\\*\\*Leader:\\*\\*\\s*(.+)',
						name: 'leader',
						captureGroup: 1,
						required: false,
					},
					customise: {
						regex: '>\\s*\\*\\*Customise:\\*\\*\\s*(.+)',
						name: 'customise',
						captureGroup: 1,
						required: false,
					},
				},
				enrichmentTemplate: '[{title} | {identifier} | {department}]\n\n',
				maxTokens: 512,
				minTokens: 50,
				wholeDocumentThreshold: 512,
				includeContext: true,
			},
			metadataExtraction: {
				enabled: false,
				patterns: [],
			},
		};
		strategy = new AriaHeadingEnrichedStrategy(config, logger);
	});

	describe('strategy properties', () => {
		it('should have correct name', () => {
			expect(strategy.name).toBe('aria.heading-enriched');
		});

		it('should have correct domain', () => {
			expect(strategy.domain).toBe('aria');
		});

		it('should have correct method', () => {
			expect(strategy.method).toBe('heading-enriched');
		});
	});

	describe('callout metadata extraction', () => {
		it('should extract metadata from TIP callout block', () => {
			const markdown = `# RFP Response

> [!TIP] Request Details
> **Identifier:** REQ-001
> **Description:** Technical requirements section
> **Priority:** High
> **Category:** Infrastructure
> **Department:** IT Operations
> **Leader:** John Smith
> **Customise:** Yes

## Section 1

Response content here.`;

			const chunks = strategy.chunk(markdown, 'doc-1');

			// Chunks should have extracted metadata
			expect(chunks.length).toBeGreaterThanOrEqual(1);
			const chunk = chunks[0];

			expect(chunk.metadata.identifier).toBe('REQ-001');
			expect(chunk.metadata.description).toBe('Technical requirements section');
			expect(chunk.metadata.priority).toBe('High');
			expect(chunk.metadata.category).toBe('Infrastructure');
			expect(chunk.metadata.department).toBe('IT Operations');
			expect(chunk.metadata.leader).toBe('John Smith');
			expect(chunk.metadata.customise).toBe('Yes');
		});

		it('should handle missing optional fields', () => {
			const markdown = `# RFP Response

> [!TIP] Request Details
> **Identifier:** REQ-002

## Content

Some content.`;

			const chunks = strategy.chunk(markdown, 'doc-1');

			expect(chunks.length).toBeGreaterThanOrEqual(1);
			const chunk = chunks[0];

			expect(chunk.metadata.identifier).toBe('REQ-002');
			expect(chunk.metadata.description).toBeUndefined();
			expect(chunk.metadata.priority).toBeUndefined();
		});

		it('should handle documents without callout blocks', () => {
			const markdown = `# Simple Document

## Section

Content without any callout blocks.`;

			const chunks = strategy.chunk(markdown, 'doc-1');

			expect(chunks.length).toBeGreaterThanOrEqual(1);
			// Should still work, just without callout metadata
			expect(chunks[0].metadata.identifier).toBeUndefined();
		});
	});

	describe('template enrichment', () => {
		it('should enrich chunks with template-based prefix', () => {
			const markdown = `# Project Proposal

> [!TIP] Request Details
> **Identifier:** PROJ-100
> **Department:** Engineering

## Requirements

Technical requirements section.`;

			const chunks = strategy.chunk(markdown, 'doc-1');

			expect(chunks.length).toBeGreaterThanOrEqual(1);
			// Content should contain enrichment prefix with extracted metadata
			const content = chunks[0].content;
			expect(content).toContain('Project Proposal');
			expect(content).toContain('PROJ-100');
			expect(content).toContain('Engineering');
		});

		it('should clean up empty template variables', () => {
			const markdown = `# Test Document

> [!TIP] Request Details
> **Identifier:** TEST-001

## Section

Content here.`;

			const chunks = strategy.chunk(markdown, 'doc-1');

			expect(chunks.length).toBeGreaterThanOrEqual(1);
			// Should not have empty pipe sequences like "| |" or "[]"
			const content = chunks[0].content;
			expect(content).not.toMatch(/\|\s*\|/);
			expect(content).not.toContain('[]');
		});
	});

	describe('small document optimization', () => {
		it('should index small documents as single chunk', () => {
			// Use high threshold config
			const smallDocConfig: ChunkingConfig = {
				...config,
				'aria.heading-enriched': {
					...config['aria.heading-enriched']!,
					wholeDocumentThreshold: 500, // High threshold
				},
			};
			const smallDocStrategy = new AriaHeadingEnrichedStrategy(smallDocConfig, logger);

			const markdown = `# Small RFP

> [!TIP] Details
> **Identifier:** SMALL-001
> **Department:** Sales

Brief content.`;

			const chunks = smallDocStrategy.chunk(markdown, 'doc-1');

			expect(chunks).toHaveLength(1);
			expect(chunks[0].metadata.wholeDocument).toBe(true);
			expect(chunks[0].metadata.identifier).toBe('SMALL-001');
		});
	});

	describe('hierarchical chunking', () => {
		it('should create multiple chunks for large documents', () => {
			// Use low threshold config
			const largeDocConfig: ChunkingConfig = {
				...config,
				'aria.heading-enriched': {
					...config['aria.heading-enriched']!,
					wholeDocumentThreshold: 10, // Low threshold to force chunking
				},
			};
			const largeDocStrategy = new AriaHeadingEnrichedStrategy(largeDocConfig, logger);

			const longContent = 'A'.repeat(500);
			const markdown = `# Large RFP Document

> [!TIP] Details
> **Identifier:** LARGE-001

## Section A

${longContent}

## Section B

${longContent}`;

			const chunks = largeDocStrategy.chunk(markdown, 'doc-1');

			expect(chunks.length).toBeGreaterThan(1);
			// All chunks should have the extracted metadata
			for (const chunk of chunks) {
				expect(chunk.metadata.identifier).toBe('LARGE-001');
			}
		});

		it('should build context from parent sections', () => {
			const largeDocConfig: ChunkingConfig = {
				...config,
				'aria.heading-enriched': {
					...config['aria.heading-enriched']!,
					wholeDocumentThreshold: 10,
				},
			};
			const strategy = new AriaHeadingEnrichedStrategy(largeDocConfig, logger);

			const markdown = `# Document

> [!TIP] Details
> **Identifier:** CTX-001

## Parent Section

Parent content

### Child Section

Child content here`;

			const chunks = strategy.chunk(markdown, 'doc-1');

			// Find child chunk
			const childChunk = chunks.find(c => c.heading === 'Child Section');
			if (childChunk) {
				expect(childChunk.context).toContain('Parent Section');
			}
		});
	});

	describe('config validation', () => {
		it('should throw error when missing aria.heading-enriched config', () => {
			const badConfig: ChunkingConfig = {
				strategy: 'aria.heading-enriched',
				'generic.hierarchical': config['generic.hierarchical'],
				metadataExtraction: { enabled: false, patterns: [] },
			};

			expect(() => new AriaHeadingEnrichedStrategy(badConfig, logger)).toThrow(
				'Missing config section: aria.heading-enriched'
			);
		});

		it('should throw error for invalid maxTokens', () => {
			const badConfig: ChunkingConfig = {
				...config,
				'aria.heading-enriched': {
					...config['aria.heading-enriched']!,
					maxTokens: 0,
				},
			};

			const badStrategy = new AriaHeadingEnrichedStrategy(badConfig, logger);
			expect(() => badStrategy.validateConfig()).toThrow('maxTokens must be > 0');
		});

		it('should throw error for negative minTokens', () => {
			const badConfig: ChunkingConfig = {
				...config,
				'aria.heading-enriched': {
					...config['aria.heading-enriched']!,
					minTokens: -1,
				},
			};

			const badStrategy = new AriaHeadingEnrichedStrategy(badConfig, logger);
			expect(() => badStrategy.validateConfig()).toThrow('minTokens must be >= 0');
		});
	});

	describe('deterministic IDs', () => {
		it('should generate same ID for same documentId and content', () => {
			const markdown = `# Test Document

> [!TIP] Details
> **Identifier:** DET-001

## Content

Test content.`;

			const chunks1 = strategy.chunk(markdown, 'doc-deterministic');
			const chunks2 = strategy.chunk(markdown, 'doc-deterministic');

			expect(chunks1[0].id).toBe(chunks2[0].id);
		});

		it('should generate different IDs for different documents', () => {
			const markdown1 = `# Document A

> [!TIP] Details
> **Identifier:** A-001

## Content A

Content.`;

			const markdown2 = `# Document B

> [!TIP] Details
> **Identifier:** B-001

## Content B

Content.`;

			const chunks1 = strategy.chunk(markdown1, 'doc-a');
			const chunks2 = strategy.chunk(markdown2, 'doc-b');

			expect(chunks1[0].id).not.toBe(chunks2[0].id);
		});
	});
});
