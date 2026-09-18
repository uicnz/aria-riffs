/**
 * Type declarations for wink-bm25-text-search
 */

declare module 'wink-bm25-text-search' {
	interface BM25Instance {
		defineConfig(config: { k1: number; b: number }): void;
		definePrepTasks(tasks: unknown[]): void;
		addDoc(doc: string, id: number): void;
		consolidate(): void;
		tokens: {
			string: (text: string) => string[];
			lowerCase: unknown;
			removeElisions: unknown;
			phonetic: unknown;
		};
	}

	function BM25(): BM25Instance;
	export = BM25;
}
