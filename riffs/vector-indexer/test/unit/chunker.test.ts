/**
 * Unit tests for Chunker (thin wrapper)
 * Tests chunker delegation to strategy
 */

import pino from 'pino';
import { beforeEach, describe, expect, it } from 'vitest';
import { Chunker } from '../../src/core/chunker.js';
import type { ChunkingConfig } from '../../src/lib/types.js';

describe('Chunker', () => {
	let chunker: Chunker;
	let logger: pino.Logger;
	let config: ChunkingConfig;

	beforeEach(() => {
		logger = pino({ level: 'silent' });
		config = {
			strategy: 'generic.hierarchical',
			'generic.hierarchical': {
				primaryLevel: 2,
				maxLevels: [2, 3, 4],
				maxTokens: 512,
				minTokens: 50,
				wholeDocumentThreshold: 10, // Low threshold to force multi-chunk behavior in tests
				fallback: 'paragraph',
				preserve: ['```', '~~~'],
				includeContext: true,
			},
			metadataExtraction: {
				enabled: false,
				patterns: [],
			},
		};
		chunker = new Chunker(config, logger);
	});

	describe('chunk', () => {
		it('should create chunks from markdown content', () => {
			const markdown = `# Document Title

## Section 1

This is content for section 1.`;

			const chunks = chunker.chunk(markdown, 'doc-1');

			expect(chunks).toHaveLength(1);
			expect(chunks[0].heading).toBe('Section 1');
			expect(chunks[0].level).toBe(2);
			// Content should be enriched with title
			expect(chunks[0].content).toContain('Document Title');
		});

		it('should split large documents into multiple chunks', () => {
			const paragraph1 = 'A'.repeat(300);
			const paragraph2 = 'B'.repeat(300);
			const paragraph3 = 'C'.repeat(1200);
			const paragraph4 = 'D'.repeat(1200);

			const markdown = `# Document

## Large Section

${paragraph1}

${paragraph2}

${paragraph3}

${paragraph4}`;

			const chunks = chunker.chunk(markdown, 'doc-1');

			expect(chunks.length).toBeGreaterThan(1);
		});

		it('should include parent context in chunks', () => {
			const markdown = `# Document

## Parent

Parent content

### Child

Child content`;

			const chunks = chunker.chunk(markdown, 'doc-1');

			// Find child chunk
			const childChunk = chunks.find(c => c.heading === 'Child');
			expect(childChunk).toBeDefined();
			expect(childChunk?.context).toContain('Parent');
		});

		it('should handle small documents as single chunk', () => {
			// Use higher threshold to ensure small doc optimization triggers
			const smallDocConfig: ChunkingConfig = {
				...config,
				'generic.hierarchical': {
					...config['generic.hierarchical'],
					wholeDocumentThreshold: 100, // High enough for this test doc
				},
			};
			const smallDocChunker = new Chunker(smallDocConfig, logger);

			const markdown = `# Small Document

This is a small document with minimal content.`;

			const chunks = smallDocChunker.chunk(markdown, 'doc-1');

			expect(chunks).toHaveLength(1);
			expect(chunks[0].metadata.wholeDocument).toBe(true);
		});

		it('should generate unique chunk IDs', () => {
			const markdown = `# Document

## Section A

Content A

## Section B

Content B`;

			const chunks = chunker.chunk(markdown, 'doc-1');

			expect(chunks.length).toBeGreaterThanOrEqual(2);
			expect(chunks[0].id).not.toBe(chunks[1].id);
		});

		it('should enrich chunks with document title', () => {
			const markdown = `# My Document

## Section

Content here`;

			const chunks = chunker.chunk(markdown, 'doc-1');

			// All chunks should have enriched content with title
			for (const chunk of chunks) {
				expect(chunk.content).toContain('My Document');
			}
		});
	});
});
