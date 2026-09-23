import { spawnSync } from 'node:child_process';

export function cleanDocx(inputDocx: string, outputDocx: string): boolean {
	const args = [inputDocx, '-f', 'docx', '-t', 'docx', '-o', outputDocx, '--standalone'];
	const r = spawnSync('pandoc', args, { encoding: 'utf8' });
	return r.status === 0;
}
