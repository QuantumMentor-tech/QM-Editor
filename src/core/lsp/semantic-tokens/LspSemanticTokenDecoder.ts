/**
 * QM Editor - LSP Semantic Tokens Decoder
 * 
 * High-performance delta-decoder for converting LSP 3.17 5-tuple integer streams
 * into structured semantic tokens, resolving types and modifiers via the legend.
 */

import { Logger } from '../../../utils/logger';
import {
  DecodedSemanticToken,
  LspSemanticTokensEdit,
} from './LspSemanticTokenTypes';
import { globalSemanticTokenLegend } from './LspSemanticTokenLegend';

export class LspSemanticTokenDecoder {
  /**
   * Decode an array of 5-tuple integers into structured DecodedSemanticToken instances.
   * 
   * Each token consists of 5 consecutive integers:
   * [0] deltaLine: Line number relative to previous token line
   * [1] deltaStartChar: Start char relative to previous token startChar (if deltaLine === 0),
   *                     or relative to 0 (if deltaLine > 0)
   * [2] length: Token character length
   * [3] tokenTypeIndex: Index into the session legend's tokenTypes
   * [4] tokenModifiersMask: Bitmask of modifier flags
   */
  public static decode(
    data: number[],
    sessionKey?: string,
    maxTokens: number = 20000
  ): DecodedSemanticToken[] {
    if (!Array.isArray(data) || data.length < 5) {
      return [];
    }

    const tokens: DecodedSemanticToken[] = [];
    let currentLine = 0;
    let currentStartChar = 0;

    const totalTuples = Math.floor(data.length / 5);
    const limit = Math.min(totalTuples, maxTokens);

    for (let i = 0; i < limit; i++) {
      const offset = i * 5;
      const deltaLine = data[offset];
      const deltaStartChar = data[offset + 1];
      const length = data[offset + 2];
      const tokenTypeIndex = data[offset + 3];
      const tokenModifiersMask = data[offset + 4];

      // Validate integers and non-negativity
      if (
        !Number.isInteger(deltaLine) || deltaLine < 0 ||
        !Number.isInteger(deltaStartChar) || deltaStartChar < 0 ||
        !Number.isInteger(length) || length <= 0 ||
        !Number.isInteger(tokenTypeIndex) || tokenTypeIndex < 0 ||
        !Number.isInteger(tokenModifiersMask) || tokenModifiersMask < 0
      ) {
        Logger.warn('LspSemanticTokenDecoder: Skipping invalid token tuple', {
          tupleIndex: i,
          deltaLine,
          deltaStartChar,
          length,
          tokenTypeIndex,
          tokenModifiersMask,
        });
        continue;
      }

      // Delta decoding rules
      if (deltaLine === 0) {
        currentLine += 0;
        currentStartChar += deltaStartChar;
      } else {
        currentLine += deltaLine;
        currentStartChar = deltaStartChar;
      }

      // Validate token type index against the session's legend
      if (!globalSemanticTokenLegend.isValidTokenType(tokenTypeIndex, sessionKey)) {
        Logger.warn('LspSemanticTokenDecoder: Discarding token tuple with invalid tokenTypeIndex', {
          tokenTypeIndex,
          max: globalSemanticTokenLegend.getServerLegend(sessionKey).tokenTypes.length,
        });
        continue;
      }

      const tokenType = globalSemanticTokenLegend.resolveTokenType(tokenTypeIndex, sessionKey);
      const tokenModifiers = globalSemanticTokenLegend.resolveTokenModifiers(tokenModifiersMask, sessionKey);

      tokens.push({
        line: currentLine,
        startChar: currentStartChar,
        length,
        tokenTypeIndex,
        tokenType,
        tokenModifiersMask,
        tokenModifiers,
      });
    }

    if (totalTuples > limit) {
      Logger.warn(`LspSemanticTokenDecoder: Truncated tokens from ${totalTuples} to ${limit}`);
    }

    return tokens;
  }

  /**
   * Apply delta edits from a textDocument/semanticTokens/full/delta response
   * onto a previous raw integer array to reconstruct the full current token array.
   * Returns null if any edit is malformed or exceeds bounds (forcing a full refresh).
   */
  public static applyDeltaEdits(
    previousData: number[],
    edits: LspSemanticTokensEdit[]
  ): number[] | null {
    if (!Array.isArray(previousData)) {
      return null;
    }

    if (!Array.isArray(edits) || edits.length === 0) {
      return [...previousData];
    }

    const current = [...previousData];

    for (const edit of edits) {
      if (
        typeof edit.start !== 'number' ||
        edit.start < 0 ||
        edit.start > current.length ||
        typeof edit.deleteCount !== 'number' ||
        edit.deleteCount < 0 ||
        edit.start + edit.deleteCount > current.length
      ) {
        Logger.warn('LspSemanticTokenDecoder: Malformed edit in delta payload exceeding bounds, delta rejected', edit);
        return null;
      }

      const insertData = Array.isArray(edit.data) ? edit.data : [];
      current.splice(edit.start, edit.deleteCount, ...insertData);
    }

    return current;
  }
}
