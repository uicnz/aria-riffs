declare module 'turndown-plugin-gfm' {
	import type TurndownService from 'turndown';

	export type Plugin = (service: TurndownService) => void;

	export const gfm: Plugin;
}
