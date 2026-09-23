import { GoogleGenAI } from '@google/genai';
import type { Logger } from 'pino';
import type { ImageGeneratorRiffConfig } from '../lib/schema.js';
import type { AspectRatio, ImageSize, ModelName } from '../lib/types.js';
import { loadImageAsBase64, saveImageBuffer, verifyFileExists } from '../utils/handle-files.js';
import { buildImageConfig } from '../utils/utils.js';

export interface ComposeOptions {
	model?: string;
	aspect?: string;
	size?: string;
}

export class ComposeImagesCommand {
	private config: ImageGeneratorRiffConfig;
	private logger: Logger;
	private genAI: GoogleGenAI;

	constructor(config: ImageGeneratorRiffConfig, logger: Logger) {
		this.config = config;
		this.logger = logger;

		const apiKey = process.env['GOOGLE_API_KEY']?.trim();
		if (!apiKey) {
			throw new Error('GOOGLE_API_KEY environment variable not set');
		}
		this.genAI = new GoogleGenAI({ apiKey });
	}

	async execute(
		instruction: string,
		outputPath: string,
		imagePaths: string[],
		options: ComposeOptions
	): Promise<void> {
		this.logger.info(
			{ instruction, outputPath, imagePaths, imageCount: imagePaths.length, options },
			'Starting image composition'
		);

		try {
			// Validate image count
			this.validateImageCount(imagePaths);

			// Verify all input files exist
			await this.verifyInputFiles(imagePaths);

			const model = (options.model as ModelName) || (this.config.gemini.defaultModel as ModelName);
			const aspectRatio = (options.aspect as AspectRatio) || (this.config.defaults.aspectRatio as AspectRatio);
			const imageSize = (options.size as ImageSize) || (this.config.defaults.imageSize as ImageSize);

			const result = await this.composeImages(instruction, imagePaths, model, aspectRatio, imageSize);
			await saveImageBuffer(result, outputPath, this.logger);

			this.logger.info(
				{ outputPath, imageCount: imagePaths.length, model },
				'Image composition completed successfully'
			);
			this.logger.info({ outputPath }, 'Composed image saved');
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			this.logger.error({ error: errorMessage, instruction, outputPath, imagePaths }, 'Image composition failed');
			throw error;
		}
	}

	private validateImageCount(imagePaths: string[]): void {
		if (imagePaths.length < 1) {
			throw new Error('At least one image is required');
		}
		if (imagePaths.length > 14) {
			throw new Error('Maximum 14 reference images supported');
		}
	}

	private async verifyInputFiles(imagePaths: string[]): Promise<void> {
		for (const imagePath of imagePaths) {
			await verifyFileExists(imagePath, this.logger);
		}
		this.logger.debug({ imagePaths, count: imagePaths.length }, 'All input files verified');
	}

	private async composeImages(
		instruction: string,
		imagePaths: string[],
		model: ModelName,
		aspectRatio: AspectRatio,
		imageSize: ImageSize
	): Promise<Buffer> {
		// Load all images using shared utility
		const imageParts = await Promise.all(
			imagePaths.map(async imagePath => {
				const { data, mimeType, size } = await loadImageAsBase64(imagePath, this.logger);

				this.logger.debug({ imagePath, mimeType, size }, 'Image loaded for composition');

				return {
					inlineData: {
						mimeType,
						data,
					},
				};
			})
		);

		const config = buildImageConfig(aspectRatio, imageSize);

		// Build contents: instruction first, then images
		const contents = [{ text: instruction }, ...imageParts];

		const result = await this.genAI.models.generateContent({
			model,
			contents,
			config,
		});

		for (const part of result.candidates?.[0]?.content?.parts || []) {
			if (part.text) {
				this.logger.debug({ response: part.text }, 'Model text response');
			}
			if (part.inlineData?.data) {
				return Buffer.from(part.inlineData.data, 'base64');
			}
		}

		throw new Error('No image was generated.');
	}
}
