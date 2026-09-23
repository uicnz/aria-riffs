/**
 * Unit tests for MetadataExtractor
 */

import pino from 'pino';
import { beforeEach, describe, expect, it } from 'vitest';
import { MetadataExtractor } from '../../src/core/metadata-extractor.js';
import type { MetadataExtractionConfig } from '../../src/lib/types.js';

describe('MetadataExtractor', () => {
	let extractor: MetadataExtractor;
	let logger: pino.Logger;

	beforeEach(() => {
		logger = pino({ level: 'silent' });
	});

	describe('extract', () => {
		it('should extract metadata using regex patterns', () => {
			const config: MetadataExtractionConfig = {
				enabled: true,
				patterns: [
					{
						regex: '\\b([A-Z]{2}-\\d{3})\\b',
						name: 'requirement_id',
						captureGroup: 1,
					},
				],
			};

			extractor = new MetadataExtractor(config, logger);

			const content = 'This document has requirement BR-042 and MR-001.';
			const metadata = extractor.extract(content);

			expect(metadata.requirement_id).toBe('BR-042');
		});

		it('should extract section numbers', () => {
			const config: MetadataExtractionConfig = {
				enabled: true,
				patterns: [
					{
						regex: '^\\s*(\\d+(?:\\.\\d+)*)',
						name: 'section_number',
						captureGroup: 1,
					},
				],
			};

			extractor = new MetadataExtractor(config, logger);

			const content = '4.2.1 Network Requirements';
			const metadata = extractor.extract(content);

			expect(metadata.section_number).toBe('4.2.1');
		});

		it('should return empty object when disabled', () => {
			const config: MetadataExtractionConfig = {
				enabled: false,
				patterns: [],
			};

			extractor = new MetadataExtractor(config, logger);

			const content = 'Content with BR-042';
			const metadata = extractor.extract(content);

			expect(Object.keys(metadata)).toHaveLength(0);
		});

		it('should handle multiple patterns', () => {
			const config: MetadataExtractionConfig = {
				enabled: true,
				patterns: [
					{
						regex: '\\b([A-Z]{2}-\\d{3})\\b',
						name: 'req_id',
						captureGroup: 1,
					},
					{
						regex: 'Priority:\\s*(\\w+)',
						name: 'priority',
						captureGroup: 1,
					},
				],
			};

			extractor = new MetadataExtractor(config, logger);

			const content = 'Requirement BR-042 Priority: High';
			const metadata = extractor.extract(content);

			expect(metadata.req_id).toBe('BR-042');
			expect(metadata.priority).toBe('High');
		});

		it('should handle no matches gracefully', () => {
			const config: MetadataExtractionConfig = {
				enabled: true,
				patterns: [
					{
						regex: '\\b([A-Z]{2}-\\d{3})\\b',
						name: 'req_id',
						captureGroup: 1,
					},
				],
			};

			extractor = new MetadataExtractor(config, logger);

			const content = 'No matching patterns here';
			const metadata = extractor.extract(content);

			expect(Object.keys(metadata)).toHaveLength(0);
		});
	});

	describe('extractFrontmatter', () => {
		it('should extract YAML frontmatter', () => {
			const config: MetadataExtractionConfig = {
				enabled: true,
				patterns: [],
			};

			extractor = new MetadataExtractor(config, logger);

			const content = `---
title: My Document
category: Technical
priority: High
---

# Content

Document body.`;

			const metadata = extractor.extractFrontmatter(content);

			expect(metadata.title).toBe('My Document');
			expect(metadata.category).toBe('Technical');
			expect(metadata.priority).toBe('High');
		});

		it('should handle missing frontmatter', () => {
			const config: MetadataExtractionConfig = {
				enabled: true,
				patterns: [],
			};

			extractor = new MetadataExtractor(config, logger);

			const content = `# No Frontmatter

Just content.`;

			const metadata = extractor.extractFrontmatter(content);

			expect(Object.keys(metadata)).toHaveLength(0);
		});

		it('should handle colons in values', () => {
			const config: MetadataExtractionConfig = {
				enabled: true,
				patterns: [],
			};

			extractor = new MetadataExtractor(config, logger);

			const content = `---
url: https://example.com:8080/path
---

Content`;

			const metadata = extractor.extractFrontmatter(content);

			expect(metadata.url).toBe('https://example.com:8080/path');
		});
	});
});
