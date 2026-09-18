# doc-indexer FAQ

## Knowledge Graph

### Q: How does doc-indexer build its Knowledge Graph - from deterministic schema or semantic relationships?

**A:** doc-indexer builds its Knowledge Graph using a **purely schema-based approach**. The Knowledge Graph is constructed from deterministic metadata fields that are explicitly extracted from structured document headers. While doc-indexer does use OpenAI embeddings for semantic search capabilities, these embeddings do NOT contribute to the graph structure itself - they are used exclusively for finding similar documents during search queries.

The graph construction is completely predictable: if a document contains a "category: Standard" metadata field, doc-indexer will create an edge to a "Category: Standard" node. There is no AI interpretation or semantic relationship discovery happening during graph construction.

### Q: Is the Knowledge Graph schema discovered dynamically or predetermined?

**A:** The schema is **hard-coded and predetermined**, not discovered. doc-indexer has a fixed set of metadata fields it looks for, and it only creates graph relationships for those specific fields.

Before doc-indexer even examines any files, it already knows it will only look for:

- Category
- Department
- Leader
- Priority
- Identifier
- Description
- Customise
- Assets (images)
- Source citations

If your documents contain other metadata fields like "Budget" or "Vendor" that aren't in the predetermined schema, doc-indexer will completely ignore them. It won't create nodes or edges for them because they're not part of the fixed schema.

This is a **schema-first approach** where the riff knows exactly what to hunt for before traversing any documents. It's not learning or discovering patterns - it's executing a fixed extraction and graph construction algorithm.

### Q: Where is the schema defined in the codebase?

**A:** The schema is predetermined in three locations within the source code - there is **no external schema configuration file**:

#### 1. Type Definition (`src/types.ts`)

The `RfpDocMetadata` interface (lines 11-35) defines all possible fields that doc-indexer recognizes.

#### 2. Parser Implementation (`src/parsers/metadata.ts`)

The parser function (lines 11-19) only extracts these specific fields from documents:

- Identifier
- Description
- Priority
- Category
- Department
- Leader
- Customise

#### 3. Graph Builder (`src/graph/exporter.ts`)

The graph exporter (lines 115-194) only creates nodes and edges for:

- Category relationships
- Department relationships
- Leader relationships
- Source Citation relationships
- Asset relationships

To change the schema, you would need to:

1. Modify the `RfpDocMetadata` TypeScript interface
2. Update the parser to extract new fields
3. Add new edge creation logic in the graph exporter
4. Recompile the TypeScript code

This is a **compile-time schema**, not a runtime-configurable one. doc-indexer cannot adapt to different document schemas without code changes and recompilation.
