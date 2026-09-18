/**
 * ESM loader for interceptor
 *
 * WHY THIS FILE EXISTS:
 * Node's --require flag needs a module that can bootstrap the interceptor.
 * This loads our TypeScript interceptor via bun in dev, or the compiled JS in production.
 *
 * IMPORTANT: Cannot use top-level await with --require flag
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import pino from 'pino';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create minimal logger for loader
const logger = pino({
	level: process.env.PROMPT_TRACER_DEBUG === 'true' ? 'debug' : 'info',
});

const jsPath = path.join(__dirname, 'interceptor.js');
const tsPath = path.join(__dirname, 'interceptor.ts');

// Build interceptor config from environment variables
const interceptorConfig = {
	logBaseName: process.env.PROMPT_TRACER_TRACE_NAME,
	logDirectory: process.env.PROMPT_TRACER_TRACE_DIRECTORY,
};

// Use Promise-based loading without top-level await
if (fs.existsSync(jsPath)) {
	// Use compiled JavaScript (production/built version)
	import('./interceptor.js')
		.then(({ initializeInterceptor }) => {
			initializeInterceptor(interceptorConfig);
		})
		.catch(error => {
			logger.error({ error: error.message }, 'Error loading interceptor');
			process.exit(1);
		});
} else if (fs.existsSync(tsPath)) {
	// Use TypeScript via bun (development mode)
	// Use dynamic string to bypass TypeScript's .ts extension restriction
	const tsImport = './interceptor.' + 'ts';
	import(tsImport)
		.then(({ initializeInterceptor }) => {
			initializeInterceptor(interceptorConfig);
		})
		.catch(error => {
			logger.error({ error: error.message }, 'Error loading interceptor');
			process.exit(1);
		});
} else {
	logger.error({ jsPath, tsPath }, 'Could not find interceptor file');
	process.exit(1);
}
