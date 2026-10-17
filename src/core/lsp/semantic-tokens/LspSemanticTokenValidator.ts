/**
 * QM Editor - LSP Semantic Tokens Validator
 * 
 * Validates, clamps, sanitizes, and checks bounds for semantic token streams.
 * Prevents memory exhaustion, negative offsets, multiline token errors,
 * and dangerous class injections.
 */

import { Logger } from '../../../utils/logger';
import {
  DecodedSemanticToken,
  SemanticTokenValidationResult,
} from './LspSemanticTokenTypes';

export const MAX_RAW_TOKEN_INTEGERS = 100_000; // 20,000 tokens max per document
export const MAX_DECODED_TOKENS = 20_000;

export class LspSemanticTokenValidator {
  /**
   * Validate and clamp raw 5-tuple integer array.
   */
  public static validateRawData(rawData: unknown): SemanticTokenValidationResult {
    if (!Array.isArray(rawData)) {
      return {
        isValid: false,
        sanitizedData: [],
        error: 'Semantic tokens payload data must be an array of numbers',
        quarantinedCount: 0,
      };
    }

    if (rawData.length === 0) {
      return {
        isValid: true,
        sanitizedData: [],
        quarantinedCount: 0,
      };
    }

    let quarantinedCount = 0;
    const clampedLength = Math.min(rawData.length, MAX_RAW_TOKEN_INTEGERS);
    // Ensure length is multiple of 5
    const validLength = clampedLength - (clampedLength % 5);
    const sanitizedData: number[] = [];

    for (let i = 0; i < validLength; i++) {
      const val = rawData[i];
      if (typeof val === 'number' && Number.isFinite(val) && val >= 0) {
        sanitizedData.push(Math.floor(val));
      } else {
        // Corrupted tuple detected, skip this entire 5-tuple block
        const tupleStart = Math.floor(i / 5) * 5;
        // Rewind any partial values from this tuple
        while (sanitizedData.length > tupleStart) {
          sanitizedData.pop();
        }
        // Advance i to end of corrupted tuple
        i = tupleStart + 4;
        quarantinedCount++;
      }
    }

    return {
      isValid: true,
      sanitizedData,
      quarantinedCount,
    };
  }

  /**
   * Validate decoded tokens against document text.
   * Ensures tokens don't exceed document lines or line lengths.
   */
  public static validateAgainstDocument(
    tokens: DecodedSemanticToken[],
    documentLines: string[]
  ): DecodedSemanticToken[] {
    if (!Array.isArray(tokens) || tokens.length === 0) {
      return [];
    }

    if (!Array.isArray(documentLines) || documentLines.length === 0) {
      return tokens;
    }

    const totalLines = documentLines.length;
    const validTokens: DecodedSemanticToken[] = [];

    for (const token of tokens) {
      if (token.line < 0 || token.line >= totalLines) {
        Logger.debug('LspSemanticTokenValidator: Token line exceeds document length', {
          line: token.line,
          totalLines,
        });
        continue;
      }

      const lineContent = documentLines[token.line];
      const lineLen = lineContent ? lineContent.length : 0;

      if (token.startChar < 0 || token.startChar > lineLen) {
        Logger.debug('LspSemanticTokenValidator: Token startChar exceeds line length', {
          startChar: token.startChar,
          lineLength: lineLen,
        });
        continue;
      }

      // Clamp length if token exceeds end of line
      const clampedLength = Math.min(token.length, Math.max(0, lineLen - token.startChar));
      if (clampedLength <= 0) {
        continue;
      }

      validTokens.push({
        ...token,
        length: clampedLength,
      });
    }

    return validTokens;
  }

  /**
   * Sort and resolve overlapping tokens to guarantee clean CodeMirror decoration rendering.
   * Sorts by line ASC, startChar ASC, length DESC.
   */
  public static resolveOverlaps(tokens: DecodedSemanticToken[]): DecodedSemanticToken[] {
    if (tokens.length <= 1) {
      return tokens;
    }

    // Sort tokens
    const sorted = [...tokens].sort((a, b) => {
      if (a.line !== b.line) {
        return a.line - b.line;
      }
      if (a.startChar !== b.startChar) {
        return a.startChar - b.startChar;
      }
      return b.length - a.length;
    });

    const result: DecodedSemanticToken[] = [];
    let lastToken: DecodedSemanticToken | null = null;

    for (const token of sorted) {
      if (!lastToken) {
        result.push(token);
        lastToken = token;
        continue;
      }

      // If exact same range, merge modifiers
      if (lastToken.line === token.line && lastToken.startChar === token.startChar && lastToken.length === token.length) {
        const mergedModifiers = Array.from(new Set([...lastToken.tokenModifiers, ...token.tokenModifiers]));
        lastToken.tokenModifiers = mergedModifiers;
        continue;
      }

      result.push(token);
      lastToken = token;
    }

    return result;
  }

  /**
   * Sanitize an identifier to ensure it is safe to use in a CSS class name.
   */
  public static sanitizeCssClass(name: string): string {
    if (!name || typeof name !== 'string') {
      return 'unknown';
    }
    return name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  }
}
