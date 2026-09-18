import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from '../../src/lib/config.js';

describe('config integration', () => {
	let testDir: string;

	beforeEach(() => {
		testDir = path.join(process.cwd(), '.test-config-temp');
		mkdirSync(testDir, { recursive: true });
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	describe('loadConfig', () => {
		it('given valid config file exists, when loadConfig called with path, then returns parsed configuration', () => {
			const configPath = path.join(testDir, 'config.yaml');
			const configContent = `
hr-staffer:
  paths:
    input:
      staff: /path/to/employees.csv
      chart: /path/to/chart.md
      sections: /path/to/sections
    output:
      chart: /path/to/output
      sections: /path/to/sections
    database:
      file: /db/hr-staffer.db
  output:
    formats:
      text: true
      markdown: true
      mermaid: true
  display:
    includeTitle: true
    includeDepartment: true
    includeEmail: false
    maxDepth: null
  mermaid:
    breakDownTeams: []
  database:
    enabled: true
logging:
  level: info
`;
			writeFileSync(configPath, configContent);

			const config = loadConfig(configPath);
			const riff = config['hr-staffer'];

			expect(riff.paths.input.staff).toBe('/path/to/employees.csv');
			expect(riff.paths.output.chart).toBe('/path/to/output');
		});

		it('given config file does not exist, when loadConfig called, then throws validation error', () => {
			const nonexistentPath = path.join(testDir, 'nonexistent.yaml');

			// hr-staffer requires paths.input.staff which has no default
			expect(() => loadConfig(nonexistentPath)).toThrow();
		});

		it('given config file has invalid yaml syntax, when loadConfig called, then throws error', () => {
			const configPath = path.join(testDir, 'config.yaml');
			const invalidYaml = `
hr-staffer:
  paths:
    input:
      staff: value
invalid: [unclosed bracket
`;
			writeFileSync(configPath, invalidYaml);

			expect(() => loadConfig(configPath)).toThrow('Failed to load config');
		});

		it('given config file fails validation, when loadConfig called, then throws error', () => {
			const configPath = path.join(testDir, 'config.yaml');
			const invalidConfig = `
hr-staffer:
  paths:
    input: {}
  output:
    formats:
      text: true
      markdown: true
      mermaid: true
  display:
    includeTitle: true
    includeDepartment: true
    includeEmail: false
    maxDepth: null
  mermaid:
    breakDownTeams: []
`;
			writeFileSync(configPath, invalidConfig);

			expect(() => loadConfig(configPath)).toThrow(ConfigError);
		});

		it('given config file is empty, when loadConfig called, then throws error', () => {
			const configPath = path.join(testDir, 'config.yaml');
			writeFileSync(configPath, '');

			expect(() => loadConfig(configPath)).toThrow(ConfigError);
		});
	});
});
