/**
 * Extended type definitions for Google Generative AI
 *
 * The official @google/genai types don't include image generation
 * capabilities yet. This file extends those types to support the image
 * generation API features.
 */

/**
 * Extended generation config that includes image generation options
 */
export interface ImageGenerationConfig {
	responseModalities?: ('TEXT' | 'IMAGE')[];
	imageConfig?: {
		aspectRatio?: '1:1' | '2:3' | '3:2' | '3:4' | '4:3' | '4:5' | '5:4' | '9:16' | '16:9' | '21:9';
		imageSize?: '1K' | '2K' | '4K';
	};
	riffs?: Array<{ googleSearch: Record<string, never> }>;
}

export type AspectRatio = '1:1' | '2:3' | '3:2' | '3:4' | '4:3' | '4:5' | '5:4' | '9:16' | '16:9' | '21:9';
export type ImageSize = '1K' | '2K' | '4K';
export type ModelName = 'gemini-2.5-flash-image' | 'gemini-3-pro-image-preview';

/**
 * Content part types for sending text and images to the API
 */
export type TextPart = { text: string };
export type ImagePart = { inlineData: { mimeType: string; data: string } };
export type ContentPart = TextPart | ImagePart;
