/**
 * QM Editor - LSP Semantic Tokens Mapper
 * 
 * Maps decoded semantic tokens into canonical editor tokens and CodeMirror 6
 * character-offset decoration ranges with themed CSS classes.
 */

import {
  DecodedSemanticToken,
  CanonicalSemanticToken,
  EditorSemanticTokenDecoration,
} from './LspSemanticTokenTypes';
import { LspSemanticTokenValidator } from './LspSemanticTokenValidator';

export class LspSemanticTokenMapper {
  /**
   * Convert decoded 0-based semantic tokens to canonical 1-based QM Editor tokens.
   */
  public static toCanonicalTokens(tokens: DecodedSemanticToken[]): CanonicalSemanticToken[] {
    return tokens.map((token) => ({
      line: token.line + 1,
      startColumn: token.startChar + 1,
      endLine: token.line + 1,
      endColumn: token.startChar + token.length + 1,
      length: token.length,
      tokenType: token.tokenType,
      modifiers: [...token.tokenModifiers],
    }));
  }

  /**
   * Build an array of line start offsets for efficient 0-based character indexing.
   */
  public static computeLineOffsets(docText: string): number[] {
    const lineOffsets: number[] = [0];
    const len = docText.length;

    for (let i = 0; i < len; i++) {
      if (docText[i] === '\n') {
        lineOffsets.push(i + 1);
      }
    }

    return lineOffsets;
  }

  /**
   * Map decoded tokens to CodeMirror 6 compatible decoration ranges with character offsets.
   */
  public static toEditorDecorations(
    tokens: DecodedSemanticToken[],
    docText: string,
    lineOffsets?: number[]
  ): EditorSemanticTokenDecoration[] {
    if (!tokens || tokens.length === 0 || !docText) {
      return [];
    }

    const offsets = lineOffsets || this.computeLineOffsets(docText);
    const docLength = docText.length;
    const decorations: EditorSemanticTokenDecoration[] = [];

    for (const token of tokens) {
      if (token.line < 0 || token.line >= offsets.length) {
        continue;
      }

      const lineStart = offsets[token.line];
      const from = lineStart + token.startChar;
      const to = Math.min(from + token.length, docLength);

      if (from >= to || from < 0 || to > docLength) {
        continue;
      }

      const typeClass = `cm-semantic-type-${LspSemanticTokenValidator.sanitizeCssClass(token.tokenType)}`;
      const modClasses = token.tokenModifiers
        .map((m) => `cm-semantic-mod-${LspSemanticTokenValidator.sanitizeCssClass(m)}`)
        .join(' ');

      const className = `cm-semantic-token ${typeClass}${modClasses ? ' ' + modClasses : ''}`.trim();

      decorations.push({
        from,
        to,
        className,
        tokenType: token.tokenType,
        modifiers: [...token.tokenModifiers],
      });
    }

    return decorations;
  }
}
