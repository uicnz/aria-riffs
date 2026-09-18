import { z } from 'zod';

const AriaRiffMetadataSchema = z
	.object({
		name: z.literal('sharepoint-manager'),
		description: z.string().min(1),
		category: z.enum(['documents', 'images', 'knowledge', 'development', 'utilities']),
	})
	.strict();

/**
 * Zod schema for SharePoint configuration file
 */

export const SharePointPathsInputSchema = z.object({
	onedrive: z.string().default(''),
	onedriveDb: z.string().default(''),
});

export const SharePointPathsOutputSchema = z.object({
	index: z.string().default('.aria/db/sharepoint-manager/sharepoint-manager.csv'),
});

export const SharePointPathsDatabaseSchema = z.object({
	file: z.string().default('.aria/db/sharepoint-manager/sharepoint-manager.sqlite'),
});

export const SharePointPathsSchema = z.object({
	input: SharePointPathsInputSchema.default({
		onedrive: '',
		onedriveDb: '',
	}),
	output: SharePointPathsOutputSchema.default({
		index: '.aria/db/sharepoint-manager/sharepoint-manager.csv',
	}),
	database: SharePointPathsDatabaseSchema.default({
		file: '.aria/db/sharepoint-manager/sharepoint-manager.sqlite',
	}),
});

export const SharePointLinksSchema = z.object({
	sharePointBase: z.string().default(''),
	extractionDelay: z.number().default(1500),
});

export const SharePointOutputSchema = z.object({
	format: z.enum(['csv', 'sqlite', 'both']).default('both'),
	saveInterval: z.number().default(10),
});

export const SharePointProcessingSchema = z.object({
	batchSize: z.number().default(50),
	retryFailed: z.boolean().default(false),
});

export const SharePointDatabaseSchema = z.object({
	sharePointWebBasePath: z.string().default(''),
	method: z.enum(['auto', 'database', 'applescript']).default('auto'),
});

export const LoggingConfigSchema = z.object({
	level: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
	verbose: z.boolean().default(false),
	file: z.string().default('.aria/logs/sharepoint-manager.log'),
	maxFileSizeMb: z.number().default(10),
	maxFiles: z.number().default(7),
});

export const SharepointManagerRiffSchema = z.object({
	paths: SharePointPathsSchema.default({
		input: {
			onedrive: '',
			onedriveDb: '',
		},
		output: {
			index: '.aria/db/sharepoint-manager/sharepoint-manager.csv',
		},
		database: {
			file: '.aria/db/sharepoint-manager/sharepoint-manager.sqlite',
		},
	}),
	links: SharePointLinksSchema.default({
		sharePointBase: '',
		extractionDelay: 1500,
	}),
	output: SharePointOutputSchema.default({
		format: 'both',
		saveInterval: 10,
	}),
	processing: SharePointProcessingSchema.default({
		batchSize: 50,
		retryFailed: false,
	}),
	database: SharePointDatabaseSchema.default({
		sharePointWebBasePath: '',
		method: 'auto',
	}),
});

export const SharepointManagerConfigSchema = z
	.object({
		'aria-riff': AriaRiffMetadataSchema.optional(),
		'sharepoint-manager': SharepointManagerRiffSchema.default({
			paths: {
				input: {
					onedrive: '',
					onedriveDb: '',
				},
				output: {
					index: '.aria/db/sharepoint-manager/sharepoint-manager.csv',
				},
				database: {
					file: '.aria/db/sharepoint-manager/sharepoint-manager.sqlite',
				},
			},
			links: {
				sharePointBase: '',
				extractionDelay: 1500,
			},
			output: {
				format: 'both',
				saveInterval: 10,
			},
			processing: {
				batchSize: 50,
				retryFailed: false,
			},
			database: {
				sharePointWebBasePath: '',
				method: 'auto',
			},
		}),
		logging: LoggingConfigSchema.default(LoggingConfigSchema.parse({})),
	})
	.strict();

export type SharepointManagerRiffConfig = z.infer<typeof SharepointManagerRiffSchema>;
export type SharepointManagerConfig = z.infer<typeof SharepointManagerConfigSchema>;
export type LoggingConfig = z.infer<typeof LoggingConfigSchema>;
