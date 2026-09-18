import fs from 'node:fs';

export function cleanTempFiles(paths: string[]): void {
	for (const p of paths) {
		try {
			if (p && fs.existsSync(p)) fs.unlinkSync(p);
		} catch {
			// ignore
		}
	}
}
