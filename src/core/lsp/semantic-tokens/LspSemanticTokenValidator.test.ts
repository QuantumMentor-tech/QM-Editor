/**
 * QM Editor - LSP Semantic Tokens Validator Test Suite
 * Phase 06, Step 64 — LSP Semantic Tokens, Semantic Highlighting & Incremental Token Synchronization
 */

import { describe, it, expect } from 'vitest';
import { LspSemanticTokenValidator } from './LspSemanticTokenValidator';
import { DecodedSemanticToken } from './LspSemanticTokenTypes';

describe('LspSemanticTokenValidator', () => {
  describe('validateRawData', () => {
    it('rejects non-array payloads', () => {
      expect(LspSemanticTokenValidator.validateRawData(null)).toEqual({
        isValid: false,
        sanitizedData: [],
        error: 'Semantic tokens payload data must be an array of numbers',
        quarantinedCount: 0,
      });

      expect(LspSemanticTokenValidator.validateRawData({ data: [1, 2, 3] })).toEqual({
        isValid: false,
        sanitizedData: [],
        error: 'Semantic tokens payload data must be an array of numbers',
        quarantinedCount: 0,
      });
    });

    it('accepts empty arrays as valid', () => {
      const res = LspSemanticTokenValidator.validateRawData([]);
      expect(res.isValid).toBe(true);
      expect(res.sanitizedData).toEqual([]);
      expect(res.quarantinedCount).toBe(0);
    });

    it('truncates incomplete trailing tuple elements to multiple of 5', () => {
      const raw = [0, 1, 2, 3, 4, 5, 6]; // 7 elements
      const res = LspSemanticTokenValidator.validateRawData(raw);
      expect(res.isValid).toBe(true);
      expect(res.sanitizedData).toEqual([0, 1, 2, 3, 4]); // Only first 5 kept
    });

    it('quarantines tuples containing NaN, Infinity, negative or non-number values', () => {
      const raw = [
        0, 1, 2, 3, 4,          // valid
        0, 'bad' as any, 2, 3, 4, // corrupt tuple
        1, 0, 5, 0, 0,          // valid
      ];

      const res = LspSemanticTokenValidator.validateRawData(raw);
      expect(res.isValid).toBe(true);
      expect(res.sanitizedData).toEqual([0, 1, 2, 3, 4, 1, 0, 5, 0, 0]);
      expect(res.quarantinedCount).toBe(1);
    });
  });

  describe('validateAgainstDocument', () => {
    const documentLines = ['hello world', 'function test() {', '}'];

    it('filters out tokens on lines beyond document length', () => {
      const tokens: DecodedSemanticToken[] = [
        { line: 0, startChar: 0, length: 5, tokenTypeIndex: 0, tokenType: 'variable', tokenModifiersMask: 0, tokenModifiers: [] },
        { line: 10, startChar: 0, length: 4, tokenTypeIndex: 0, tokenType: 'variable', tokenModifiersMask: 0, tokenModifiers: [] },
      ];

      const result = LspSemanticTokenValidator.validateAgainstDocument(tokens, documentLines);
      expect(result).toHaveLength(1);
      expect(result[0].line).toBe(0);
    });

    it('clamps tokens that exceed line length without wrapping or throwing', () => {
      // Line 0 is 'hello world' (length 11). Token starts at 6, length 10 => clamped to 5
      const tokens: DecodedSemanticToken[] = [
        { line: 0, startChar: 6, length: 10, tokenTypeIndex: 0, tokenType: 'string', tokenModifiersMask: 0, tokenModifiers: [] },
      ];

      const result = LspSemanticTokenValidator.validateAgainstDocument(tokens, documentLines);
      expect(result).toHaveLength(1);
      expect(result[0].startChar).toBe(6);
      expect(result[0].length).toBe(5); // 11 - 6 = 5
    });

    it('filters out tokens whose startChar exceeds line length', () => {
      const tokens: DecodedSemanticToken[] = [
        { line: 0, startChar: 50, length: 5, tokenTypeIndex: 0, tokenType: 'string', tokenModifiersMask: 0, tokenModifiers: [] },
      ];

      const result = LspSemanticTokenValidator.validateAgainstDocument(tokens, documentLines);
      expect(result).toHaveLength(0);
    });
  });

  describe('resolveOverlaps', () => {
    it('sorts tokens by line ASC, startChar ASC, length DESC', () => {
      const tokens: DecodedSemanticToken[] = [
        { line: 1, startChar: 5, length: 4, tokenTypeIndex: 0, tokenType: 'var2', tokenModifiersMask: 0, tokenModifiers: [] },
        { line: 0, startChar: 10, length: 2, tokenTypeIndex: 0, tokenType: 'var1b', tokenModifiersMask: 0, tokenModifiers: [] },
        { line: 0, startChar: 2, length: 6, tokenTypeIndex: 0, tokenType: 'var1a', tokenModifiersMask: 0, tokenModifiers: [] },
      ];

      const resolved = LspSemanticTokenValidator.resolveOverlaps(tokens);
      expect(resolved[0].tokenType).toBe('var1a');
      expect(resolved[1].tokenType).toBe('var1b');
      expect(resolved[2].tokenType).toBe('var2');
    });

    it('merges modifiers for duplicate tokens with identical ranges', () => {
      const tokens: DecodedSemanticToken[] = [
        { line: 0, startChar: 0, length: 5, tokenTypeIndex: 0, tokenType: 'var', tokenModifiersMask: 1, tokenModifiers: ['declaration'] },
        { line: 0, startChar: 0, length: 5, tokenTypeIndex: 0, tokenType: 'var', tokenModifiersMask: 4, tokenModifiers: ['readonly'] },
      ];

      const resolved = LspSemanticTokenValidator.resolveOverlaps(tokens);
      expect(resolved).toHaveLength(1);
      expect(resolved[0].tokenModifiers).toContain('declaration');
      expect(resolved[0].tokenModifiers).toContain('readonly');
    });
  });

  describe('sanitizeCssClass', () => {
    it('converts to lowercase and replaces invalid characters with hyphens', () => {
      expect(LspSemanticTokenValidator.sanitizeCssClass('TypeParameter')).toBe('typeparameter');
      expect(LspSemanticTokenValidator.sanitizeCssClass('function<T>')).toBe('function-t-');
      expect(LspSemanticTokenValidator.sanitizeCssClass('my_custom-var')).toBe('my_custom-var');
      expect(LspSemanticTokenValidator.sanitizeCssClass('')).toBe('unknown');
      expect(LspSemanticTokenValidator.sanitizeCssClass(null as any)).toBe('unknown');
    });
  });
});
