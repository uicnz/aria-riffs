import * as fs from 'node:fs/promises';
import path from 'node:path';
import { glob } from 'glob';
import type { Logger } from 'pino';
import { DatabaseManager } from '../db/database.js';
import type { AriaDocConfig, RfpDocMetadata, SourceCitation } from '../lib/types.js';
import { parseReqResp } from '../parsers/markdown.js';
import { detectDocType, extractAssets, parseMetadataBlock, parseTitle } from '../parsers/metadata.js';
import { buildFullRfpContext } from '../parsers/rfp.js';
import { EmbeddingService } from '../providers/embedding-client.js';
import { stripMarkdown } from '../utils/utils.js';
import {
	buildContextualEmbedText,
	buildEnrichedFtsText,
	extractDomainKeywords,
	initIndexEnrichment,
} from './index-enrichment.js';

export class DocIndexer {
	private dbManager: DatabaseManager;
	private embeddingService: EmbeddingService;
	private config: AriaDocConfig;
	private logger: Logger;

	constructor(dbFile: string, logger: Logger, apiKey?: string, config?: Partial<AriaDocConfig>) {
		const defaultConfig: AriaDocConfig = {
			model: 'text-embedding-3-large',
			dimensions: 3072,
			maxEmbedChars: 20000,
			sections: 'both',
			weightResponse: 1.8,
			useFts: true,
			hybrid: true,
			alpha: 0.2,
			showMetadata: true,
			highlight: true,
		};

		this.config = { ...defaultConfig, ...config };
		this.logger = logger;
		this.dbManager = new DatabaseManager(dbFile, this.config.useFts);
		this.embeddingService = new EmbeddingService(
			apiKey,
			this.config.model,
			this.config.dimensions,
			this.config.maxEmbedChars
		);
	}

	connect(): void {
		this.dbManager.connect();
	}

	private buildMetadata(
		filePath: string,
		content: string,
		_baseDir: string,
		fullCtx: Awaited<ReturnType<typeof buildFullRfpContext>>
	): RfpDocMetadata {
		const relativePath = path.relative(process.cwd(), filePath);
		const parts = relativePath.split(path.sep);
		// Use last 3 path components as relevant path
		const relevant = parts.slice(-3);

		const tip = parseMetadataBlock(content);
		const title = parseTitle(content);
		const { request, response } = parseReqResp(content);
		const assets = extractAssets(content);

		const identifier = tip.identifier?.trim();
		const type = detectDocType(identifier, this.config.rfp?.requirements?.patterns);

		let source_citation: SourceCitation | undefined;
		if (identifier && fullCtx?.anchors?.has(identifier)) {
			const anchorData = fullCtx.anchors.get(identifier);
			if (!anchorData) throw new Error(`Anchor not found for identifier: ${identifier}`);
			const { start, end, file, anchor } = anchorData;
			source_citation = { file, anchor, line_range: [start + 1, end + 1] as [number, number] };
		}

		const metadata: RfpDocMetadata = {
			id: path.basename(filePath, '.md'),
			identifier,
			type,
			title,
			description: tip.description,
			category: tip.category,
			department: tip.department,
			leader: tip.leader,
			customise: (tip.customise ?? '').toLowerCase().includes('yes'),
			priority: tip.priority,
			relative_path: relevant.join('/'),
			full_path: filePath,
			request_text: request ? stripMarkdown(request) : undefined,
			response_text: response ? stripMarkdown(response) : undefined,
			assets,
			source_citation,
			rfp_name: fullCtx?.rfpName,
			client: fullCtx?.client,
			vendor: fullCtx?.vendor,
			proposal_date: fullCtx?.proposal_date,
			indexed_at: new Date().toISOString(),
			embedding_model: this.config.model,
			dimensions: this.config.dimensions,
		};
		return metadata;
	}

	async index(directory: string, reset: boolean, fullRfpPath?: string): Promise<void> {
		if (reset) {
			this.dbManager.reset();
		}

		// Initialize index enrichment with search config
		const searchConfig = this.config.search ?? {
			abbreviations: {},
			synonyms: [],
			stopWords: [],
		};
		initIndexEnrichment(searchConfig);

		const files = await glob(path.join(directory, '**/*.md'), {
			ignore: ['**/assets/**', '**/node_modules/**'],
		});
		const fullCtx = await buildFullRfpContext(directory, fullRfpPath, this.config.rfp);

		const contents: string[] = [];
		const embedTexts: string[] = [];
		const ftsTexts: string[] = [];
		const metadatas: RfpDocMetadata[] = [];
		const ids: string[] = [];

		for (const [i, file] of files.entries()) {
			const content = await fs.readFile(file, 'utf-8');
			if (!content.trim()) continue;
			const md = this.buildMetadata(file, content, directory, fullCtx);
			contents.push(content);
			metadatas.push(md);
			ids.push(`${md.id}_${i}`);

			// Build contextual embedding text with hierarchy prefix
			// This helps the embedding model understand document context
			let embedText = buildContextualEmbedText(md);
			if (!embedText) {
				embedText = stripMarkdown(content).slice(0, this.config.maxEmbedChars);
			}

			// Extract domain keywords and add to embedding
			const domainKeywords = extractDomainKeywords(embedText);
			if (domainKeywords.length > 0) {
				embedText = `Keywords: ${domainKeywords.join(', ')}\n\n${embedText}`;
			}

			embedTexts.push(embedText);

			// Build enriched FTS text with abbreviation expansions
			// This ensures abbreviation searches find relevant documents
			const ftsText = buildEnrichedFtsText(md, embedText);
			ftsTexts.push(ftsText);

			this.logger.debug(
				{ id: md.id, embedLength: embedText.length, ftsLength: ftsText.length },
				'Built enriched index text'
			);
		}

		this.logger.info({ count: embedTexts.length }, 'Generating embeddings...');
		const embeddings = await this.embeddingService.embedAll(embedTexts);
		const db = this.dbManager.getDb();

		const insertDoc = db.prepare(
			'INSERT OR REPLACE INTO documents (id, content, embedding, metadata_json) VALUES (?,?,?,?)'
		);
		const insertFts = this.config.useFts
			? db.prepare('INSERT OR REPLACE INTO documents_fts (id, text) VALUES (?,?)')
			: null;

		const insertAll = db.transaction(() => {
			for (let i = 0; i < ids.length; i++) {
				insertDoc.run(
					ids[i],
					contents[i],
					this.embeddingService.vectorToBuffer(embeddings[i]),
					JSON.stringify(metadatas[i])
				);
				if (this.config.useFts && insertFts) {
					// Use enriched FTS text (separate from embedding text)
					insertFts.run(ids[i], ftsTexts[i]);
				}
			}
		});

		insertAll();

		this.logger.info({ count: ids.length }, 'Indexed documents with enriched text');

		// Index full RFP files if present
		await this.indexFullRfp(directory);
	}

	private async indexFullRfp(directory: string): Promise<void> {
		if (!this.config.useFts) return;

		const fullRoots = [
			path.resolve(directory, '../full-rfp'),
			path.resolve(directory, '../../full-rfp'),
			path.resolve(directory, 'full-rfp'),
		];
		const fullFiles: string[] = [];
		for (const root of fullRoots) {
			try {
				const list = await glob(path.join(root, '**/*.md'), {
					ignore: ['**/assets/**', '**/node_modules/**'],
				});
				for (const f of list) fullFiles.push(f);
			} catch {
				/* ignore */
			}
		}

		if (fullFiles.length === 0) return;

		const db = this.dbManager.getDb();
		const ins = db.prepare('INSERT OR REPLACE INTO full_docs (id, file, content) VALUES (?,?,?)');
		const fts = db.prepare('INSERT OR REPLACE INTO full_docs_fts (id, file, text) VALUES (?,?,?)');

		try {
			// Read all files first (async), then insert in a transaction (sync)
			const fullDocsData: Array<{ id: string; file: string; content: string; text: string }> = [];
			for (const f of fullFiles) {
				const content = await fs.readFile(f, 'utf-8');
				const id = path.relative(process.cwd(), f);
				const text = stripMarkdown(content);
				fullDocsData.push({ id, file: f, content, text });
			}

			const insertFullRfpSync = db.transaction(() => {
				for (const doc of fullDocsData) {
					ins.run(doc.id, doc.file, doc.content);
					fts.run(doc.id, doc.file, doc.text);
				}
			});

			insertFullRfpSync();
			this.logger.info({ count: fullFiles.length }, 'Indexed full RFP files (FTS-only)');
		} catch {
			this.logger.warn('Could not index full RFP files (FTS-only)');
		}
	}

	close(): void {
		this.dbManager.close();
	}

	getDb(): import('libsql').Database {
		return this.dbManager.getDb();
	}

	getEmbeddingService() {
		return this.embeddingService;
	}

	getConfig() {
		return this.config;
	}

	getDbManager() {
		return this.dbManager;
	}
}
