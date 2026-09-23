/**
 * Wrapper for csv-writer to work around type compatibility issues
 * csv-writer's types don't properly handle exactOptionalPropertyTypes: true
 * This module uses dynamic import to bypass type checking
 */

// biome-ignore lint/suspicious/noExplicitAny: Required to bypass csv-writer type issues
let createCsvWriterFunc: any;

// Lazy load to avoid type checking at module load time
// biome-ignore lint/suspicious/noExplicitAny: Required to bypass csv-writer type issues
export async function createObjectCsvWriter(params: any) {
	if (!createCsvWriterFunc) {
		const csvWriter = await import('csv-writer');
		createCsvWriterFunc = csvWriter.createObjectCsvWriter;
	}
	return createCsvWriterFunc(params);
}
