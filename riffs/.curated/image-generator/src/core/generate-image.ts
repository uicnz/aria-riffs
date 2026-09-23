import { GoogleGenAI } from '@google/genai';
import type { Logger } from 'pino';
import type { ImageGeneratorRiffConfig } from '../lib/schema.js';
import type { AspectRatio, ImageSize, ModelName } from '../lib/types.js';
import { saveImageBuffer } from '../utils/handle-files.js';
import { buildImageConfig } from '../utils/utils.js';

export interface GenerateOptions {
	model?: string;
	aspect?: string;
	size?: string;
}

export class GenerateImageCommand {
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

	async execute(prompt: string, outputPath: string, options: GenerateOptions): Promise<void> {
		this.logger.info({ prompt, outputPath, options }, 'Starting image generation');

		try {
			const model = (options.model as ModelName) || (this.config.gemini.defaultModel as ModelName);
			const aspectRatio = (options.aspect as AspectRatio) || (this.config.defaults.aspectRatio as AspectRatio);
			const imageSize = (options.size as ImageSize) || (this.config.defaults.imageSize as ImageSize);

			const result = await this.generateImage(prompt, model, aspectRatio, imageSize);
			await saveImageBuffer(result, outputPath, this.logger);

			this.logger.info({ outputPath, model, aspectRatio, imageSize }, 'Image generation completed successfully');
			this.logger.info({ outputPath }, 'Image saved');
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			this.logger.error({ error: errorMessage, prompt, outputPath }, 'Image generation failed');
			throw error;
		}
	}

	private async generateImage(
		prompt: string,
		model: ModelName,
		aspectRatio: AspectRatio,
		imageSize: ImageSize
	): Promise<Buffer> {
		const config = buildImageConfig(aspectRatio, imageSize);

		const result = await this.genAI.models.generateContent({
			model,
			contents: prompt,
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

		throw new Error('No image was generated. Check your prompt and try again.');
	}
}
