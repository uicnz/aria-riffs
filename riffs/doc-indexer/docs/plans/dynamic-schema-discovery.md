# Dynamic Schema Discovery for doc-indexer Knowledge Graph

## Overview

Enable doc-indexer to support both predetermined schema (current behavior) and dynamic schema discovery, allowing the riff to adapt to new document structures without code changes.

## Motivation

Currently, doc-indexer uses a compile-time fixed schema that only recognizes predetermined fields. Documents with additional metadata fields are ignored, limiting the riff's flexibility. This proposal adds the ability to discover and utilize schema from the documents themselves while maintaining backward compatibility.

## Proposed Solution

### 1. Add a Discovery Mode

Create a two-pass indexing system:

- **Pass 1 (Discovery)**: Scan documents to find ALL metadata patterns
- **Pass 2 (Indexing)**: Build graph using discovered + predetermined schema

### 2. Dynamic Metadata Parser

Modify `parseMetadataBlock()` to capture ALL key-value pairs:

```typescript
// Instead of looking for specific fields, capture everything
function extractAllMetadataFields(block: string): Record<string, any> {
    const fields: Record<string, any> = {};
    const lines = block.split('\n');

    for (const line of lines) {
        const match = line.match(/^\s*-?\s*([^:]+):\s*(.+)$/);
        if (match) {
            const [_, key, value] = match;
            fields[key.trim()] = value.trim().replace(/`/g, '');
        }
    }

    return fields;
}
```

### 3. Schema Registry

Create a schema configuration system:

```typescript
interface SchemaConfig {
    mode: 'strict' | 'discovery' | 'hybrid';

    predefinedFields: string[]; // Always included fields

    discoveryRules?: {
        minOccurrence: number; // Field must appear in X% of docs
        relationshipPatterns: RegExp[]; // Patterns that suggest relationships
        nodeTypeInference: boolean; // Auto-detect node types
    };

    customMappings?: {
        [fieldName: string]: {
            nodeType: string;
            relationshipType: string;
        };
    };
}
```

### 4. Smart Relationship Detection

During discovery, detect potential relationships based on patterns:

```typescript
interface RelationshipDetector {
    // Fields ending in _id, _ref, _link suggest references
    detectReferences(fieldName: string, values: string[]): boolean;

    // Fields with limited repeated values suggest categories
    detectCategories(fieldName: string, values: string[]): boolean;

    // Fields matching name patterns suggest person entities
    detectPersonEntities(fieldName: string, values: string[]): boolean;

    // Fields with date patterns suggest temporal relationships
    detectTemporalRelationships(fieldName: string, values: string[]): boolean;

    // Fields with URLs suggest external resources
    detectExternalResources(fieldName: string, values: string[]): boolean;
}
```

### 5. Implementation Path

```typescript
class SchemaDiscovery {
    async discoverSchema(directory: string): Promise<DiscoveredSchema> {
        const fieldOccurrences = new Map<string, number>();
        const fieldValues = new Map<string, Set<string>>();
        const totalDocs = 0;

        // Scan all documents
        const files = await glob(path.join(directory, '**/*.md'));

        for (const file of files) {
            const content = await fs.readFile(file, 'utf-8');
            const metadata = extractAllMetadataFields(content);
            totalDocs++;

            for (const [field, value] of Object.entries(metadata)) {
                fieldOccurrences.set(
                    field,
                    (fieldOccurrences.get(field) || 0) + 1,
                );
                if (!fieldValues.has(field)) fieldValues.set(field, new Set());
                fieldValues.get(field)!.add(value);
            }
        }

        // Analyze patterns and suggest schema
        const suggestedSchema = this.analyzePatterns(
            fieldOccurrences,
            fieldValues,
            totalDocs,
        );

        return suggestedSchema;
    }

    private analyzePatterns(
        occurrences: Map<string, number>,
        values: Map<string, Set<string>>,
        totalDocs: number,
    ): DiscoveredSchema {
        const schema: DiscoveredSchema = {
            fields: [],
            relationships: [],
            nodeTypes: [],
        };

        for (const [field, count] of occurrences) {
            const frequency = count / totalDocs;
            const uniqueValues = values.get(field)!;

            // Determine field type and potential relationships
            if (frequency > 0.1) {
                // Appears in >10% of docs
                const fieldSchema = {
                    name: field,
                    frequency,
                    suggestedType: this.inferFieldType(field, uniqueValues),
                    suggestedRelationship: this.inferRelationship(
                        field,
                        uniqueValues,
                    ),
                };

                schema.fields.push(fieldSchema);
            }
        }

        return schema;
    }
}
```

### 6. User Workflow

```sh
# Discovery mode - analyze documents and suggest schema
bun riffs/doc-indexer/src/cli.ts discover ./documents --out schema.json

# Review and modify schema.json as needed

# Index with custom schema
bun riffs/doc-indexer/src/cli.ts index ./documents --schema schema.json

# Or use hybrid mode (predetermined + discovered)
bun riffs/doc-indexer/src/cli.ts index ./documents --mode hybrid
```

## Benefits

1. **Backward Compatible**: Strict mode preserves existing behavior
2. **Flexible**: Adapts to new document types without recompilation
3. **Intelligent**: Infers relationship types from patterns
4. **User Control**: Schema can be reviewed and modified before use
5. **Extensible**: New detection patterns can be added easily

## Migration Strategy

1. Default to "strict" mode (current behavior)
2. Add "discovery" command for schema analysis
3. Add "hybrid" mode for combined approach
4. Document schema format for manual customization
5. Provide schema validation and migration riffs

## Example Use Cases

### Use Case 1: Project Management Documents

Documents contain fields like "budget", "deadline", "stakeholder" that aren't in the current schema. Discovery mode would:

- Detect "budget" as a numeric field
- Detect "deadline" as a temporal relationship
- Detect "stakeholder" as a person entity

### Use Case 2: Technical Specifications

Documents contain "dependency", "api_version", "protocol" fields. Discovery would:

- Detect "dependency" as a reference relationship
- Detect "api_version" as a version category
- Detect "protocol" as a technical category

## Future Enhancements

1. **Schema Evolution**: Track schema changes over time
2. **Schema Inheritance**: Support schema templates and inheritance
3. **ML-Based Detection**: Use machine learning for better pattern recognition
4. **Schema Sharing**: Export/import schemas between projects
5. **Real-time Discovery**: Update schema as new documents are added

## Conclusion

This enhancement transforms doc-indexer from a rigid, predetermined schema system to an adaptive knowledge graph builder that can learn from documents while maintaining the predictability and performance of the core system. It provides a path forward for handling diverse document structures without requiring code changes.
