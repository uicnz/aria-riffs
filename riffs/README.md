# Riffs

This directory contains all riffs for the Aria platform. Riffs here are domain-agnostic utilities for document manipulation, image processing, code analysis, etc. Domain-specific riffs (HR, legal, etc.) go in the domains directory.

For riff config and structural standards, see [docs/development/general/standards-riffs.md](../docs/development/general/standards-riffs.md).

## Current Riffs

| Riff               | Purpose                                              |
| ------------------ | ---------------------------------------------------- |
| code-auditor       | Dependency management and security scanning          |
| commit-formatter   | Git commit message formatting                        |
| dir-differ         | Directory/file comparison for A/B testing            |
| doc-converter      | DOCX to Markdown with Aria Rules normalization       |
| doc-decomposer     | RFP document analysis and decomposition              |
| doc-indexer        | Document indexing, semantic search, knowledge graphs |
| hr-policy          | HR policy document processing                        |
| hr-staffer         | Organizational chart generation from CSV             |
| image-alttext      | Alt text generation for images in markdown           |
| image-generator    | AI-powered image generation                          |
| image-metadata     | XMP metadata embedding in images                     |
| image-ocr          | Text extraction from images and PDFs                 |
| image-renamer      | AI-powered image file renaming                       |
| image-sanitiser    | Image format detection and extension fixing          |
| image-transcoder   | Image optimization and format conversion             |
| mindmap-converter  | OPML/FreeMind to Markdown conversion                 |
| prompt-tracer      | System prompt extraction and analysis                |
| sharepoint-manager | SharePoint link extraction and processing            |
| vector-indexer     | Vector embedding and similarity search               |
