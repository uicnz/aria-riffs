/**
 * XMP metadata writing functionality using Sharp
 */

import type { Logger } from 'pino';
import sharp from 'sharp';
import { loadConfig } from '../lib/config.js';
import { MetadataWriteError } from '../lib/types.js';
import { sleep } from '../utils/utils.js';

// Load config once at module level
const appConfig = loadConfig();
const riff = appConfig['image-metadata'];

export class MetadataWriter {
	private imagePath: string;
	private description: string;
	private title: string;
	private keywords: string[];
	private logger: Logger;

	constructor(imagePath: string, description: string, logger: Logger) {
		this.imagePath = imagePath;
		this.description = description;
		this.title = this.generateTitle(description);
		this.keywords = this.generateKeywords(description);
		this.logger = logger;
	}

	async writeDescription(): Promise<void> {
		const retryAttempts = riff.metadata.retryAttempts;
		const retryDelay = riff.metadata.retryDelay;

		for (let attempt = 1; attempt <= retryAttempts; attempt++) {
			try {
				const tempPath = `${this.imagePath}.tmp`;

				// Generate XMP metadata for this image
				const mergedXmpMetadata = await this.mergeXmpMetadata();

				try {
					// Add XMP metadata to the image
					await sharp(this.imagePath).withXmp(mergedXmpMetadata).toFile(tempPath);

					// Replace original file with updated version (preserving metadata)
					await sharp(tempPath).withMetadata().toFile(this.imagePath);

					// Clean up temporary file
					const fs = await import('node:fs/promises');
					await fs.unlink(tempPath);

					return;
				} catch (innerError) {
					// Clean up temporary file even on error
					try {
						const fs = await import('node:fs/promises');
						await fs.unlink(tempPath);
					} catch {
						// Ignore cleanup errors
					}
					throw innerError;
				}
			} catch (error) {
				if (attempt === retryAttempts) {
					throw new MetadataWriteError(`Failed to write metadata after ${retryAttempts} attempts: ${error}`);
				}
				await sleep(retryDelay);
			}
		}
	}

	private generateTitle(description: string): string {
		const firstSentenceArray = description.split(/[.!?]/);
		const firstSentence = firstSentenceArray[0] ?? '';
		if (firstSentence.length <= 80) {
			return firstSentence.trim();
		}

		const words = firstSentence.split(' ');
		let title = '';
		for (const word of words) {
			if ((title + word).length > 77) break;
			title += (title ? ' ' : '') + word;
		}
		return `${title.trim()}...`;
	}

	private generateKeywords(description: string): string[] {
		const keywords: string[] = [];
		const text = description.toLowerCase();

		const photoKeywords = [
			'portrait',
			'landscape',
			'nature',
			'urban',
			'architecture',
			'street',
			'macro',
			'closeup',
			'wide',
			'panoramic',
			'black and white',
			'color',
			'indoor',
			'outdoor',
			'natural light',
			'artificial light',
			'person',
			'people',
			'animal',
			'building',
			'vehicle',
			'plant',
			'flower',
			'water',
			'sky',
			'mountain',
			'tree',
			'beach',
			'forest',
			'city',
		];

		for (const keyword of photoKeywords) {
			if (text.includes(keyword)) {
				keywords.push(keyword);
			}
		}

		const colors = [
			'red',
			'blue',
			'green',
			'yellow',
			'orange',
			'purple',
			'pink',
			'brown',
			'black',
			'white',
			'gray',
			'grey',
		];
		for (const color of colors) {
			if (text.includes(color)) {
				keywords.push(color);
			}
		}

		return keywords.slice(0, 10);
	}

	private generateXmpMetadata(): string {
		const keywordList = this.escapeXml(this.keywords.join(', '));
		const keywordXmlList = this.keywords.map(k => `<rdf:li>${this.escapeXml(k)}</rdf:li>`).join('');

		return `<?xml version="1.0" encoding="UTF-8"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="XMP riffkit 2.9.1-13, framework 1.6">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about="" xmlns:AriaTags="https://github.com/uicnz/aria">
      <AriaTags:AriaDescription>${this.escapeXml(this.description)}</AriaTags:AriaDescription>
      <AriaTags:AriaTitle>${this.escapeXml(this.title)}</AriaTags:AriaTitle>
      <AriaTags:AriaSubject>
        <rdf:Bag>
          ${keywordXmlList}
        </rdf:Bag>
      </AriaTags:AriaSubject>
      <AriaTags:AriaKeywords>${keywordList}</AriaTags:AriaKeywords>
    </rdf:Description>
    <rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/">
      <xmp:CreatorRiff>Aria ImageMeta AI Riff</xmp:CreatorRiff>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>`;
	}

	private async mergeXmpMetadata(): Promise<string> {
		const keywordList = this.escapeXml(this.keywords.join(', '));
		const keywordXmlList = this.keywords.map(k => `<rdf:li>${this.escapeXml(k)}</rdf:li>`).join('');
		try {
			const metadata = await sharp(this.imagePath).metadata();
			const existingXmp = metadata.xmp?.toString();

			if (!existingXmp) {
				// No existing XMP, use our generated XMP
				return this.generateXmpMetadata();
			}

			// Parse existing XMP and update our specific fields
			let updatedXmp = existingXmp;

			// Update or add our specific Aria metadata fields
			const fieldsToUpdate = [
				{
					pattern: /<AriaTags:AriaDescription>.*?<\/AriaTags:AriaDescription>/gs,
					replacement: `<AriaTags:AriaDescription>${this.escapeXml(this.description)}</AriaTags:AriaDescription>`,
				},
				{
					pattern: /<AriaTags:AriaTitle>.*?<\/AriaTags:AriaTitle>/gs,
					replacement: `<AriaTags:AriaTitle>${this.escapeXml(this.title)}</AriaTags:AriaTitle>`,
				},
				{
					pattern: /<AriaTags:AriaSubject>\s*<rdf:Bag>.*?<\/rdf:Bag>\s*<\/AriaTags:AriaSubject>/gs,
					replacement: `<AriaTags:AriaSubject>\n        <rdf:Bag>\n          ${keywordXmlList}\n        </rdf:Bag>\n      </AriaTags:AriaSubject>`,
				},
				{
					pattern: /<AriaTags:AriaKeywords>.*?<\/AriaTags:AriaKeywords>/gs,
					replacement: `<AriaTags:AriaKeywords>${keywordList}</AriaTags:AriaKeywords>`,
				},
			];

			// Apply field updates
			for (const field of fieldsToUpdate) {
				if (field.pattern.test(updatedXmp)) {
					updatedXmp = updatedXmp.replace(field.pattern, field.replacement);
				} else {
					// Field doesn't exist, add it to the first Description block
					const descriptionMatch = updatedXmp.match(/<rdf:Description[^>]*>/);
					if (descriptionMatch) {
						const insertPoint = updatedXmp.indexOf(descriptionMatch[0]) + descriptionMatch[0].length;
						updatedXmp =
							updatedXmp.slice(0, insertPoint) +
							'\n      ' +
							field.replacement +
							updatedXmp.slice(insertPoint);
					}
				}
			}

			return updatedXmp;
		} catch (error) {
			this.logger.warn(
				{ imagePath: this.imagePath, error },
				'Failed to merge existing XMP metadata, using new XMP only'
			);
			return this.generateXmpMetadata();
		}
	}

	private escapeXml(text: string): string {
		return text
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&apos;');
	}

	// this method only appears to be used by the tests
	async hasDescription(): Promise<boolean> {
		try {
			const metadata = await sharp(this.imagePath).metadata();

			// Check if XMP data contains our custom Aria description fields
			if (metadata.xmp) {
				const xmpString = metadata.xmp.toString();
				return (
					xmpString.includes('AriaTags:AriaDescription') ||
					xmpString.includes('AriaTags:AriaTitle') ||
					xmpString.includes('AriaTags:AriaSubject') ||
					xmpString.includes('AriaTags:AriaKeywords')
				);
			}

			return false;
		} catch {
			return false;
		}
	}
}
