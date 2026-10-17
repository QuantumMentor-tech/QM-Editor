/**
 * QM Editor - LSP Semantic Tokens Decoder Test Suite
 * Phase 06, Step 64 — LSP Semantic Tokens, Semantic Highlighting & Incremental Token Synchronization
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LspSemanticTokenDecoder } from './LspSemanticTokenDecoder';
import { globalSemanticTokenLegend } from './LspSemanticTokenLegend';

describe('LspSemanticTokenDecoder', () => {
  beforeEach(() => {
    globalSemanticTokenLegend.clear();
  });

  it('decodes an empty or invalid array to an empty list of tokens', () => {
    expect(LspSemanticTokenDecoder.decode([])).toEqual([]);
    expect(LspSemanticTokenDecoder.decode([1, 2, 3])).toEqual([]);
    expect(LspSemanticTokenDecoder.decode(null as any)).toEqual([]);
    expect(LspSemanticTokenDecoder.decode(undefined as any)).toEqual([]);
  });

  it('decodes a single token with deltaLine = 0 and deltaStartChar correctly', () => {
    // [deltaLine, deltaStartChar, length, tokenTypeIndex, tokenModifiersMask]
    // line 0, col 5, len 4, type 0 ('namespace'), no modifiers
    const raw = [0, 5, 4, 0, 0];
    const decoded = LspSemanticTokenDecoder.decode(raw);

    expect(decoded).toHaveLength(1);
    expect(decoded[0]).toEqual({
      line: 0,
      startChar: 5,
      length: 4,
      tokenTypeIndex: 0,
      tokenType: 'namespace',
      tokenModifiersMask: 0,
      tokenModifiers: [],
    });
  });

  it('decodes multi-line tokens with delta encoding correctly', () => {
    // Token 1: line 0, col 4, len 6 (function)
    // Token 2: deltaLine 0, deltaStart 8 => line 0, col 12, len 5 (variable)
    // Token 3: deltaLine 2, deltaStart 2 => line 2, col 2, len 3 (number)
    const raw = [
      0, 4, 6, 12, 0, // line 0, char 4 (function)
      0, 8, 5, 8, 0,  // line 0, char 12 (variable)
      2, 2, 3, 19, 0, // line 2, char 2 (number)
    ];

    const decoded = LspSemanticTokenDecoder.decode(raw);
    expect(decoded).toHaveLength(3);

    expect(decoded[0].line).toBe(0);
    expect(decoded[0].startChar).toBe(4);
    expect(decoded[0].tokenType).toBe('function');

    expect(decoded[1].line).toBe(0);
    expect(decoded[1].startChar).toBe(12);
    expect(decoded[1].tokenType).toBe('variable');

    expect(decoded[2].line).toBe(2);
    expect(decoded[2].startChar).toBe(2);
    expect(decoded[2].tokenType).toBe('number');
  });

  it('resolves modifier bitmasks correctly', () => {
    // Modifier bit 0: declaration, bit 2: readonly
    // mask = 1 | 4 = 5
    const raw = [0, 0, 10, 8, 5];
    const decoded = LspSemanticTokenDecoder.decode(raw);

    expect(decoded).toHaveLength(1);
    expect(decoded[0].tokenModifiers).toContain('declaration');
    expect(decoded[0].tokenModifiers).toContain('readonly');
  });

  it('skips invalid tuples with negative values or non-integers', () => {
    const raw = [
      -1, 0, 5, 0, 0,   // negative line
      0, -2, 5, 0, 0,   // negative startChar
      0, 5, 0, 0, 0,    // 0 length
      0, 10, 4, 0, 0,   // VALID
      0, 5, 1.5, 0, 0,  // float length
    ];

    const decoded = LspSemanticTokenDecoder.decode(raw);
    expect(decoded).toHaveLength(1);
    expect(decoded[0].startChar).toBe(10);
    expect(decoded[0].length).toBe(4);
  });

  it('discards tokens with out-of-range tokenTypeIndex', () => {
    // Legend has 24 standard types (indices 0..23)
    // 999 is out of range
    const raw = [
      0, 0, 4, 999, 0, // Invalid
      0, 5, 4, 1, 0,   // Valid (type)
    ];

    const decoded = LspSemanticTokenDecoder.decode(raw);
    expect(decoded).toHaveLength(1);
    expect(decoded[0].tokenType).toBe('type');
  });

  it('clamps output count to maxTokens limit', () => {
    const raw: number[] = [];
    for (let i = 0; i < 50; i++) {
      raw.push(0, 1, 1, 0, 0);
    }

    const decoded = LspSemanticTokenDecoder.decode(raw, undefined, 10);
    expect(decoded).toHaveLength(10);
  });

  describe('applyDeltaEdits', () => {
    it('applies insertions, replacements, and deletions to raw data', () => {
      const base = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
      const edits = [
        { start: 0, deleteCount: 5, data: [10, 11, 12, 13, 14] }, // replace first 5
        { start: 5, deleteCount: 5, data: [] },                   // delete last 5
      ];

      const result = LspSemanticTokenDecoder.applyDeltaEdits(base, edits);
      expect(result).toEqual([10, 11, 12, 13, 14]);
    });

    it('returns a copy of previousData when edits is empty', () => {
      const base = [1, 2, 3, 4, 5];
      const result = LspSemanticTokenDecoder.applyDeltaEdits(base, []);
      expect(result).toEqual(base);
      expect(result).not.toBe(base);
    });

    it('returns null when edit ranges exceed buffer bounds (triggering full fallback)', () => {
      const base = [1, 2, 3, 4, 5];
      const edits = [
        { start: 10, deleteCount: 5, data: [99] }, // start > length
      ];

      const result = LspSemanticTokenDecoder.applyDeltaEdits(base, edits);
      expect(result).toBeNull();
    });

    it('returns null when start + deleteCount exceeds buffer length', () => {
      const base = [1, 2, 3, 4, 5];
      const edits = [
        { start: 2, deleteCount: 10, data: [] }, // 2 + 10 = 12 > 5
      ];

      const result = LspSemanticTokenDecoder.applyDeltaEdits(base, edits);
      expect(result).toBeNull();
    });
  });
});
