/**
 * TypeScript lexical helpers shared by source-oriented audits.
 *
 * The compiler scanner skips comments and keeps string/template contents out of
 * the token stream, which makes these checks deterministic without mistaking
 * source-code examples for executable imports.
 */

import { createScanner, SyntaxKind } from 'typescript/unstable/ast';

export interface SourceToken {
	kind: SyntaxKind;
	start: number;
	text: string;
	value: string;
}

export function scanTypeScript(content: string): SourceToken[] {
	const scanner = createScanner(true, undefined, content);
	const tokens: SourceToken[] = [];
	const templateExpressionBraceDepth: number[] = [];

	for (let kind = scanner.scan(); kind !== SyntaxKind.EndOfFile; kind = scanner.scan()) {
		const start = scanner.getTokenStart();
		if (kind === SyntaxKind.PrivateIdentifier && scanner.getTokenEnd() === start) {
			kind = scanner.reScanHashToken();
		}
		if (scanner.getTokenEnd() <= start) {
			throw new Error(`TypeScript scanner did not advance at offset ${start}`);
		}
		tokens.push({
			kind,
			start,
			text: scanner.getTokenText(),
			value: scanner.getTokenValue(),
		});

		if (kind === SyntaxKind.TemplateHead) {
			templateExpressionBraceDepth.push(0);
			continue;
		}

		const templateDepthIndex = templateExpressionBraceDepth.length - 1;
		if (templateDepthIndex < 0) continue;
		if (kind === SyntaxKind.OpenBraceToken) {
			templateExpressionBraceDepth[templateDepthIndex] += 1;
			continue;
		}
		if (kind !== SyntaxKind.CloseBraceToken) continue;

		if (templateExpressionBraceDepth[templateDepthIndex] > 0) {
			templateExpressionBraceDepth[templateDepthIndex] -= 1;
			continue;
		}

		const templateToken = scanner.reScanTemplateToken(false);
		if (templateToken === SyntaxKind.TemplateTail) {
			templateExpressionBraceDepth.pop();
		}
	}

	return tokens;
}

export function isIdentifier(token: SourceToken | undefined, value: string): boolean {
	return token?.kind === SyntaxKind.Identifier && token.text === value;
}

export function stringLiteralValue(token: SourceToken | undefined): string | undefined {
	return token?.kind === SyntaxKind.StringLiteral ? token.value : undefined;
}

function addStringLiteral(specifiers: Set<string>, token: SourceToken | undefined): void {
	const value = stringLiteralValue(token);
	if (value !== undefined) specifiers.add(value);
}

function collectFromClause(tokens: SourceToken[], start: number, specifiers: Set<string>): void {
	for (let index = start; index < tokens.length; index += 1) {
		const token = tokens[index];
		if (token?.kind === SyntaxKind.SemicolonToken) return;
		if (token?.kind === SyntaxKind.FromKeyword) {
			addStringLiteral(specifiers, tokens[index + 1]);
			return;
		}
	}
}

export function collectModuleSpecifiers(content: string): string[] {
	const tokens = scanTypeScript(content);
	const specifiers = new Set<string>();

	for (const [index, token] of tokens.entries()) {
		if (token.kind === SyntaxKind.ImportKeyword) {
			const next = tokens[index + 1];
			if (next?.kind === SyntaxKind.DotToken) continue;
			if (next?.kind === SyntaxKind.OpenParenToken) {
				addStringLiteral(specifiers, tokens[index + 2]);
				continue;
			}
			if (next?.kind === SyntaxKind.StringLiteral) {
				addStringLiteral(specifiers, next);
				continue;
			}
			collectFromClause(tokens, index + 1, specifiers);
			continue;
		}

		if (token.kind === SyntaxKind.ExportKeyword) {
			collectFromClause(tokens, index + 1, specifiers);
			continue;
		}

		if (token.kind === SyntaxKind.RequireKeyword || isIdentifier(token, 'require')) {
			const next = tokens[index + 1];
			if (next?.kind === SyntaxKind.OpenParenToken) {
				addStringLiteral(specifiers, tokens[index + 2]);
				continue;
			}
			if (
				next?.kind === SyntaxKind.DotToken &&
				isIdentifier(tokens[index + 2], 'resolve') &&
				tokens[index + 3]?.kind === SyntaxKind.OpenParenToken
			) {
				addStringLiteral(specifiers, tokens[index + 4]);
			}
		}
	}

	return [...specifiers].sort();
}
