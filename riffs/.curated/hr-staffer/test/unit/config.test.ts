import { describe, expect, it, vi } from 'vitest';
import { parseAndValidateConfig } from '../../src/lib/config.js';

describe('config', () => {
	describe('parseAndValidateConfig', () => {
		it('given valid config yaml, when parseAndValidateConfig called, then returns parsed configuration', () => {
			const validYaml = `
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

			const config = parseAndValidateConfig(validYaml);

			expect(config.paths.input.staff).toBe('/path/to/employees.csv');
			expect(config.paths.output.chart).toBe('/path/to/output');
			expect(config.output.formats.text).toBe(true);
			expect(config.display.includeTitle).toBe(true);
			expect(config.database?.enabled).toBe(true);
		});

		it('given yaml with only unrecognized keys, when parseAndValidateConfig called, then throws validation error', () => {
			const invalidYaml = `
other-riff:
  someKey: someValue
`;

			expect(() => parseAndValidateConfig(invalidYaml)).toThrow('Config file validation failed');
		});

		it('given missing required paths field, when parseAndValidateConfig called, then throws validation error', () => {
			const invalidYaml = `
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

			expect(() => parseAndValidateConfig(invalidYaml)).toThrow('Config file validation failed');
		});

		it('given invalid yaml syntax, when parseAndValidateConfig called, then throws error', () => {
			const invalidYaml = `
hr-staffer:
  paths:
    input:
      staff: value
invalid: [unclosed bracket
`;

			expect(() => parseAndValidateConfig(invalidYaml)).toThrow();
		});

		it('given search config with display options, when parseAndValidateConfig called, then returns display options', () => {
			const yamlWithSearchDisplay = `
hr-staffer:
  paths:
    input:
      staff: /path/to/employees.csv
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
  search:
    hybrid: true
    weights:
      title: 0.30
      field: 0.10
      name: 0.15
      semantic: 0.20
      lexical: 0.25
      nameBoost: 0.2
      passBonus: 0.025
    defaultResults: 10
    maxSnippetLength: 3000
    highlight: true
logging:
  level: info
`;

			const config = parseAndValidateConfig(yamlWithSearchDisplay);

			expect(config.search?.hybrid).toBe(true);
			expect(config.search?.weights?.lexical).toBe(0.25);
			expect(config.search?.defaultResults).toBe(10);
			expect(config.search?.maxSnippetLength).toBe(3000);
			expect(config.search?.highlight).toBe(true);
		});
	});

	describe('tilde expansion', () => {
		it('given config with tilde paths, when loadConfig called, then tildes are expanded to home directory', async () => {
			vi.resetModules();
			const { loadConfig } = await import('../../src/lib/config.js');
			const config = loadConfig();

			const assertNoTildes = (obj: unknown, objPath = ''): void => {
				if (typeof obj === 'string' && obj.startsWith('~/')) {
					throw new Error(`Unexpanded tilde at ${objPath}: ${obj}`);
				}
				if (obj && typeof obj === 'object') {
					for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
						assertNoTildes(value, `${objPath}.${key}`);
					}
				}
			};
			assertNoTildes(config);
		});
	});
});
