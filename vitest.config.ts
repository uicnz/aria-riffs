import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

/**
 * Vite plugin to handle .md imports as raw text.
 * Bun supports `import x from './file.md' with { type: 'text' }` natively,
 * but Vite's import analysis chokes on .md files. This plugin transforms
 * them into default string exports so Vitest can resolve the import chain.
 */
function mdTextPlugin() {
	return {
		name: 'md-text-loader',
		transform(_code: string, id: string) {
			if (id.endsWith('.md')) {
				const content = readFileSync(id, 'utf-8');
				return {
					code: `export default ${JSON.stringify(content)};`,
					map: null,
				};
			}
			return null;
		},
	};
}

export default defineConfig({
	plugins: [mdTextPlugin()],
	test: {
		environment: 'node',
		include: ['riffs/**/test/**/*.test.ts'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'lcov', 'html'],
			reportsDirectory: './coverage',
			include: ['riffs/**/*.ts'],
			exclude: ['**/*.d.ts'],
			// thresholds: {
			//     branches: 60,
			//     functions: 60,
			//     lines: 60,
			//     statements: 60,
			// },
		},
		reporters: ['default'],
		setupFiles: ['./vitest-setup.ts'],
		testTimeout: 30000,
	},
});
