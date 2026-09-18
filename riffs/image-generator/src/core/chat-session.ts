import { mkdir, readFile, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import type { Interface } from 'node:readline';
import { createInterface } from 'node:readline';
import { type Chat, GoogleGenAI } from '@google/genai';
import type { Logger } from 'pino';
import type { ImageGeneratorRiffConfig } from '../lib/schema.js';
import type { ContentPart, ImageGenerationConfig, ModelName } from '../lib/types.js';

export interface ChatOptions {
	model?: string;
	outputDir?: string;
}

export class ChatSessionCommand {
	private logger: Logger;
	private genAI: GoogleGenAI;
	private chat: Chat | null = null;
	private currentImage: Buffer | null = null;
	private imageCount = 0;
	private model: ModelName;
	private outputDir: string;

	constructor(config: ImageGeneratorRiffConfig, logger: Logger) {
		this.logger = logger;

		const apiKey = process.env['GOOGLE_API_KEY']?.trim();
		if (!apiKey) {
			throw new Error('GOOGLE_API_KEY environment variable not set');
		}
		this.genAI = new GoogleGenAI({ apiKey });
		this.model = config.gemini.defaultModel as ModelName;
		this.outputDir = config.paths.output.chatDir;
	}

	async execute(options: ChatOptions): Promise<void> {
		this.model = (options.model as ModelName) || this.model;
		this.outputDir = options.outputDir || this.outputDir;

		this.logger.info({ model: this.model, outputDir: this.outputDir }, 'Starting interactive chat session');

		// Ensure output directory exists
		await mkdir(this.outputDir, { recursive: true });

		// Initialize chat
		this.initChat();

		this.logger.info({ model: this.model }, 'Image generator chat started');
		this.logger.info('Commands: /save [name], /load <path>, /clear, /quit');

		const rl = createInterface({
			input: process.stdin,
			output: process.stdout,
			terminal: true,
		});

		const prompt = (): void => {
			rl.question('\nYou: ', async input => {
				const userInput = input.trim();

				if (!userInput) {
					prompt();
					return;
				}

				// Handle commands
				if (userInput.startsWith('/')) {
					await this.handleCommand(userInput, rl, prompt);
					return;
				}

				// Send message to model
				try {
					const { text, image } = await this.sendMessage(userInput);

					if (text) {
						this.logger.info({ response: text }, 'Chat response received');
					}

					if (image) {
						const filepath = await this.saveImage();
						this.logger.info({ filepath }, 'Image generated');
					}

					prompt();
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : String(error);
					this.logger.error({ error: errorMessage, input: userInput }, 'Chat message failed');
					prompt();
				}
			});
		};

		prompt();
	}

	private initChat(): void {
		this.chat = this.genAI.chats.create({
			model: this.model,
			config: {
				responseModalities: ['TEXT', 'IMAGE'],
			} as ImageGenerationConfig,
		});
		this.currentImage = null;
		this.logger.debug({ model: this.model }, 'Chat initialized');
	}

	private async handleCommand(userInput: string, rl: Interface, prompt: () => void): Promise<void> {
		const parts = userInput.split(/\s+/);
		const cmd = parts[0].toLowerCase();
		const arg = parts.slice(1).join(' ');

		this.logger.debug({ command: cmd, arg }, 'Processing chat command');

		if (cmd === '/quit') {
			this.logger.info('Chat session ended by user');
			rl.close();
			process.exit(0);
		} else if (cmd === '/clear') {
			this.initChat();
			this.logger.info('Conversation cleared');
			prompt();
		} else if (cmd === '/save') {
			const filepath = await this.saveImage(arg || undefined);
			if (filepath) {
				this.logger.info({ filepath }, 'Image saved');
			} else {
				this.logger.warn('No image to save');
			}
			prompt();
		} else if (cmd === '/load') {
			if (!arg) {
				this.logger.warn('Usage: /load <path>');
				prompt();
				return;
			}
			try {
				await this.loadImage(arg);
				this.logger.info({ imagePath: arg }, 'Image loaded into chat');
				this.logger.info('You can now describe edits to make');
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				this.logger.error({ error: errorMessage, imagePath: arg }, 'Failed to load image');
			}
			prompt();
		} else {
			this.logger.warn({ command: cmd }, 'Unknown command');
			prompt();
		}
	}

	private async sendMessage(
		message: string,
		imageBuffer?: Buffer
	): Promise<{ text: string | null; image: Buffer | null }> {
		if (!this.chat) {
			throw new Error('Chat not initialized');
		}

		const parts: ContentPart[] = [{ text: message }];

		if (imageBuffer) {
			parts.push({
				inlineData: {
					mimeType: 'image/png',
					data: imageBuffer.toString('base64'),
				},
			});
		}

		this.logger.debug({ message, hasImage: !!imageBuffer }, 'Sending message to chat');

		const result = await this.chat.sendMessage({ message: parts });

		let textResponse: string | null = null;
		let imageResponse: Buffer | null = null;

		for (const part of result.candidates?.[0]?.content?.parts || []) {
			if (part.text) {
				textResponse = part.text;
			} else if (part.inlineData?.data) {
				imageResponse = Buffer.from(part.inlineData.data, 'base64');
				this.currentImage = imageResponse;
				this.logger.debug({ imageSize: imageResponse.length }, 'Image received from chat');
			}
		}

		return { text: textResponse, image: imageResponse };
	}

	private async saveImage(filename?: string): Promise<string | null> {
		if (!this.currentImage) {
			return null;
		}

		if (!filename) {
			this.imageCount++;
			const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
			filename = `image_${timestamp}_${this.imageCount}.png`;
		}

		const filepath = path.join(this.outputDir, filename);
		await writeFile(filepath, this.currentImage);
		this.logger.debug({ filepath, size: this.currentImage.length }, 'Image saved');
		return filepath;
	}

	private async loadImage(imagePath: string): Promise<void> {
		this.currentImage = await readFile(imagePath);
		this.logger.debug({ imagePath, size: this.currentImage.length }, 'Image loaded');
	}
}
