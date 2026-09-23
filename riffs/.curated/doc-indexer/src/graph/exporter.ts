import * as fsSync from 'node:fs';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import Database from 'libsql';
import type { Logger } from 'pino';
import type { RfpDocMetadata } from '../lib/types.js';
import type { GraphEdge, GraphExport, GraphExportOptions, GraphNode, HrProfile } from './types.js';

/** Default paths for HR staffer integration */
const DEFAULT_HR_DB_PATH = '.aria/db/hr-staffer/hr-staffer.sqlite';
const DEFAULT_HR_OUTPUT_DIR = '.aria/db/hr-staffer';

/**
 * Load HR profiles from hr-staffer database
 * Returns a map of display_name -> HrProfile
 */
function loadHrProfiles(dbPath: string, outputDir: string, logger: Logger): Map<string, HrProfile> {
	const profiles = new Map<string, HrProfile>();

	if (!fsSync.existsSync(dbPath)) {
		logger.warn({ dbPath }, 'HR staffer database not found, skipping enrichment');
		return profiles;
	}

	try {
		const hrDb = new Database(dbPath, { readonly: true });

		const rows = hrDb
			.prepare(`
            SELECT display_name, title, department, email, mobile, manager,
                   street_address, city, country
            FROM employees
        `)
			.all() as Array<{
			display_name: string;
			title: string;
			department: string;
			email: string;
			mobile: string;
			manager: string;
			street_address: string;
			city: string;
			country: string;
		}>;

		// Find available mermaid files
		const mermaidFiles = new Map<string, string>();
		if (fsSync.existsSync(outputDir)) {
			const files = fsSync.readdirSync(outputDir);
			for (const file of files) {
				if (file.endsWith('.mermaid')) {
					// Extract person name from filename patterns:
					// team-falko-weber.mermaid -> Falko Weber
					// subteam-ivan-walker.mermaid -> Ivan Walker
					// overview-rik-rogers.mermaid -> Rik Rogers
					const baseName = file.replace('.mermaid', '');
					const namePart = baseName.replace(/^(team|subteam|overview)-/, '');
					// Convert kebab-case to Title Case
					const displayName = namePart
						.split('-')
						.map(word => word.charAt(0).toUpperCase() + word.slice(1))
						.join(' ');
					mermaidFiles.set(displayName, path.join(outputDir, file));
				}
			}
		}

		for (const row of rows) {
			const profile: HrProfile = {
				displayName: row.display_name,
				title: row.title,
				department: row.department,
				email: row.email,
				mobile: row.mobile,
				manager: row.manager,
				streetAddress: row.street_address,
				city: row.city,
				country: row.country,
				orgChartAnchor: row.display_name.toLowerCase().replace(/\s+/g, '-'),
			};

			// Check for mermaid file
			const mermaidPath = mermaidFiles.get(row.display_name);
			if (mermaidPath) {
				profile.mermaidFile = mermaidPath;
			}

			profiles.set(row.display_name, profile);

			// Also map variations (e.g., "Jon Holt" -> "Jonathan Holt")
			if (row.display_name === 'Jonathan Holt') {
				profiles.set('Jon Holt', profile);
			}
		}

		hrDb.close();
		logger.info({ profileCount: profiles.size }, 'Loaded HR profiles for leader enrichment');
	} catch (err) {
		logger.warn({ error: (err as Error).message }, 'Failed to load HR profiles');
	}

	return profiles;
}

export class GraphExporter {
	private db: Database.Database;
	private logger: Logger;

	constructor(db: Database.Database, logger: Logger) {
		this.db = db;
		this.logger = logger;
	}

	async exportDocumentsJsonl(outFile: string): Promise<void> {
		// Export documents with content as JSONL
		const rows = this.db.prepare('SELECT metadata_json, content FROM documents').all() as Array<{
			metadata_json: string;
			content: string;
		}>;

		const lines: string[] = [];
		const fullRfpFiles = new Set<string>(); // Track unique full RFP files

		for (const r of rows) {
			const md = JSON.parse(r.metadata_json) as RfpDocMetadata;
			const doc = {
				id: md.id,
				path: md.relative_path,
				title: md.title,
				identifier: md.identifier,
				category: md.category,
				department: md.department,
				content: r.content,
			};
			lines.push(JSON.stringify(doc));

			// Track full RFP files referenced
			if (md.source_citation?.file) {
				fullRfpFiles.add(md.source_citation.file);
			}
		}

		// Add full RFP files to the export
		for (const rfpFile of fullRfpFiles) {
			try {
				const fullContent = await fs.readFile(rfpFile, 'utf-8');
				const rfpDoc = {
					id: `full-rfp:${path.basename(rfpFile)}`,
					path: rfpFile,
					title: `Full RFP: ${path.basename(rfpFile)}`,
					identifier: null,
					category: 'full-rfp',
					department: null,
					content: fullContent,
					isFullRfp: true,
				};
				lines.push(JSON.stringify(rfpDoc));
				this.logger.info({ rfpFile }, 'Added full RFP to documents export');
			} catch {
				this.logger.warn({ rfpFile }, 'Could not read full RFP file');
			}
		}

		await fs.writeFile(outFile, lines.join('\n'), 'utf-8');
		this.logger.info({ outFile, documentCount: lines.length }, 'Documents exported');
	}

	exportGraph(outFile: string, options: GraphExportOptions = {}): void {
		// Load HR profiles for Leader enrichment
		const hrDbPath = options.hrStafferDbPath ?? DEFAULT_HR_DB_PATH;
		const hrOutputDir = options.hrStafferOutputDir ?? DEFAULT_HR_OUTPUT_DIR;
		const hrProfiles = loadHrProfiles(hrDbPath, hrOutputDir, this.logger);

		// Query documents with optional content
		const query = options.includeContent
			? 'SELECT metadata_json, content FROM documents'
			: 'SELECT metadata_json FROM documents';

		const rows = this.db.prepare(query).all() as Array<{ metadata_json: string; content?: string }>;

		const nodes: GraphNode[] = [];
		const edges: GraphEdge[] = [];

		const seen = new Set<string>();
		const addNode = (n: GraphNode) => {
			if (!seen.has(n.id)) {
				nodes.push(n);
				seen.add(n.id);
			}
		};

		for (const r of rows) {
			const md = JSON.parse(r.metadata_json) as RfpDocMetadata;
			const docNodeId = md.id;

			// Build props object
			const props: Record<string, unknown> = {
				identifier: md.identifier,
				type: md.type,
				title: md.title,
				description: md.description,
				category: md.category,
				department: md.department,
				priority: md.priority,
				customise: md.customise,
				relative_path: md.relative_path,
				full_path: md.full_path,
				rfp_name: md.rfp_name,
				client: md.client,
				vendor: md.vendor,
				proposal_date: md.proposal_date,
			};

			// Add content if requested
			if (options.includeContent && r.content) {
				props.content = r.content;
			}

			addNode({
				id: docNodeId,
				label: 'Document',
				props,
			});

			// Category relationships
			if (md.category) {
				const catId = `category:${md.category}`;
				addNode({
					id: catId,
					label: 'Category',
					props: { name: md.category },
				});
				edges.push({
					from: docNodeId,
					to: catId,
					relation: 'Category',
				});
			}

			// Type relationships (BR, MR, SR, PR, etc.)
			if (md.type) {
				const typeId = `type:${md.type}`;
				addNode({
					id: typeId,
					label: 'Type',
					props: { name: md.type },
				});
				edges.push({
					from: docNodeId,
					to: typeId,
					relation: 'Type',
				});
			}

			// Priority relationships
			if (md.priority) {
				const priorityId = `priority:${md.priority.replace(/\s+/g, '-').toLowerCase()}`;
				addNode({
					id: priorityId,
					label: 'Priority',
					props: { name: md.priority },
				});
				edges.push({
					from: docNodeId,
					to: priorityId,
					relation: 'Priority',
				});
			}

			// Client relationships
			if (md.client) {
				const clientId = `client:${md.client.replace(/\s+/g, '-').toLowerCase()}`;
				addNode({
					id: clientId,
					label: 'Client',
					props: { name: md.client },
				});
				edges.push({
					from: docNodeId,
					to: clientId,
					relation: 'Client',
				});
			}

			// Vendor relationships
			if (md.vendor) {
				const vendorId = `vendor:${md.vendor.replace(/\s+/g, '-').toLowerCase()}`;
				addNode({
					id: vendorId,
					label: 'Vendor',
					props: { name: md.vendor },
				});
				edges.push({
					from: docNodeId,
					to: vendorId,
					relation: 'Vendor',
				});
			}

			// RFP relationships
			if (md.rfp_name) {
				const rfpId = `rfp:${md.rfp_name.replace(/\s+/g, '-').toLowerCase()}`;
				addNode({
					id: rfpId,
					label: 'RFP',
					props: { name: md.rfp_name },
				});
				edges.push({
					from: docNodeId,
					to: rfpId,
					relation: 'RFP',
				});
			}

			// Department relationships
			if (md.department) {
				const depId = `department:${md.department}`;
				addNode({
					id: depId,
					label: 'Department',
					props: { name: md.department },
				});
				edges.push({
					from: docNodeId,
					to: depId,
					relation: 'Department',
				});
			}

			// Person relationships (enriched with HR data)
			if (md.leader) {
				const personId = `person:${md.leader}`;
				const hrProfile = hrProfiles.get(md.leader);

				// Build Leader node props with HR enrichment
				const leaderProps: Record<string, unknown> = { name: md.leader };

				if (hrProfile) {
					leaderProps.title = hrProfile.title;
					leaderProps.hr_department = hrProfile.department;
					leaderProps.email = hrProfile.email;
					leaderProps.mobile = hrProfile.mobile;
					leaderProps.manager = hrProfile.manager;
					leaderProps.location = `${hrProfile.city}, ${hrProfile.country}`;
					leaderProps.street_address = hrProfile.streetAddress;
					leaderProps.org_chart_anchor = hrProfile.orgChartAnchor;
					if (hrProfile.mermaidFile) {
						leaderProps.mermaid_file = hrProfile.mermaidFile;
					}
				}

				addNode({
					id: personId,
					label: 'Leader',
					props: leaderProps,
				});
				edges.push({
					from: docNodeId,
					to: personId,
					relation: 'Leader',
				});
			}

			// RFP section citations
			if (md.source_citation?.file) {
				const srcId = `rfp:${path.basename(md.source_citation.file)}:${md.identifier ?? md.id}`;
				addNode({
					id: srcId,
					label: 'Citation',
					props: {
						identifier: md.identifier,
						file: md.source_citation.file,
						line_range: md.source_citation.line_range,
					},
				});
				edges.push({
					from: docNodeId,
					to: srcId,
					relation: 'Citation',
				});
			}

			// Asset relationships
			if (options.includeAssets !== false && Array.isArray(md.assets)) {
				for (const a of md.assets) {
					const assetId = `asset:${md.id}:${a}`;
					addNode({
						id: assetId,
						label: 'Asset',
						props: { path: a },
					});
					edges.push({
						from: docNodeId,
						to: assetId,
						relation: 'Asset',
					});
				}
			}
		}

		const graph: GraphExport = { nodes, edges };
		fs.writeFile(outFile, JSON.stringify(graph, null, 2), 'utf-8');
		this.logger.info({ outFile }, 'Graph exported');

		if (options.includeContent) {
			this.logger.warn('Graph includes document content and may be larger');
		}
	}
}

export async function validateGraph(graphJsonPath: string): Promise<{ valid: boolean; problems: string[] }> {
	try {
		const raw = await fs.readFile(graphJsonPath, 'utf-8');
		const data = JSON.parse(raw) as GraphExport;
		const nodeIds = new Set(data.nodes.map(n => n.id));
		const problems: string[] = [];

		for (const e of data.edges) {
			if (!nodeIds.has(e.from)) {
				problems.push(`Edge from missing node: ${e.from} -> ${e.to} (${e.relation})`);
			}
			if (!nodeIds.has(e.to)) {
				problems.push(`Edge to missing node: ${e.from} -> ${e.to} (${e.relation})`);
			}
		}

		return { valid: problems.length === 0, problems };
	} catch (e) {
		return {
			valid: false,
			problems: [`Failed to validate graph JSON: ${(e as Error).message}`],
		};
	}
}
