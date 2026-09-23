import { GoogleGenAI } from '@google/genai';
import type { Logger } from 'pino';
import type { ImageGeneratorRiffConfig } from '../lib/schema.js';
import type { AspectRatio, ImageSize, ModelName } from '../lib/types.js';
import { loadImageAsBase64, saveImageBuffer, verifyFileExists } from '../utils/handle-files.js';
import { buildImageConfig } from '../utils/utils.js';

export interface EditOptions {
	model?: string;
	aspect?: string;
	size?: string;
}

export class EditImageCommand {
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

	async execute(inputPath: string, instruction: string, outputPath: string, options: EditOptions): Promise<void> {
		this.logger.info({ inputPath, instruction, outputPath, options }, 'Starting image editing');

		try {
			const model = (options.model as ModelName) || (this.config.gemini.defaultModel as ModelName);
			const aspectRatio = (options.aspect as AspectRatio) || (this.config.defaults.aspectRatio as AspectRatio);
			const imageSize = (options.size as ImageSize) || (this.config.defaults.imageSize as ImageSize);

			const result = await this.editImage(inputPath, instruction, model, aspectRatio, imageSize);
			await saveImageBuffer(result, outputPath, this.logger);

			this.logger.info({ inputPath, outputPath, model }, 'Image editing completed successfully');
			this.logger.info({ outputPath }, 'Edited image saved');
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			this.logger.error({ error: errorMessage, inputPath, instruction, outputPath }, 'Image editing failed');
			throw error;
		}
	}

	private async editImage(
		inputPath: string,
		instruction: string,
		model: ModelName,
		aspectRatio: AspectRatio,
		imageSize: ImageSize
	): Promise<Buffer> {
		// Verify and load input image using shared utilities
		await verifyFileExists(inputPath, this.logger);
		const { data: imageBase64, mimeType, size } = await loadImageAsBase64(inputPath, this.logger);

		this.logger.debug({ inputPath, mimeType, size }, 'Input image loaded');

		const config = buildImageConfig(aspectRatio, imageSize);

		const result = await this.genAI.models.generateContent({
			model,
			contents: [
				{ text: instruction },
				{
					inlineData: {
						mimeType,
						data: imageBase64,
					},
				},
			],
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

		throw new Error('No image was generated. Check your instruction and try again.');
	}
}
