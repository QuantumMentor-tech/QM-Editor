/**
 * QM Editor — LSP Folding Validator Tests
 * Phase 06, Step 68 — LSP Folding Ranges, Smart Code Folding & Safe Document Structure Navigation
 */

import { describe, it, expect } from 'vitest';
import { LspFoldingValidator } from './LspFoldingValidator';

describe('LspFoldingValidator', () => {
  describe('validateRanges', () => {
    it('returns empty array when input is not an array', () => {
      expect(LspFoldingValidator.validateRanges(null, 100)).toEqual([]);
      expect(LspFoldingValidator.validateRanges(undefined, 100)).toEqual([]);
      expect(LspFoldingValidator.validateRanges('invalid', 100)).toEqual([]);
      expect(LspFoldingValidator.validateRanges({}, 100)).toEqual([]);
    });

    it('returns empty array for empty input array', () => {
      expect(LspFoldingValidator.validateRanges([], 100)).toEqual([]);
    });

    it('validates normal multiline folding ranges within document bounds', () => {
      const raw = [
        { startLine: 0, endLine: 10, kind: 'region' },
        { startLine: 2, endLine: 5, kind: 'comment' },
        { startLine: 6, endLine: 9, kind: 'imports' },
      ];

      const res = LspFoldingValidator.validateRanges(raw, 50);
      expect(res).toHaveLength(3);
      expect(res[0]).toEqual({
        startLine: 0,
        startCharacter: undefined,
        endLine: 10,
        endCharacter: undefined,
        kind: 'region',
        collapsedText: undefined,
      });
      expect(res[1].kind).toBe('comment');
      expect(res[2].kind).toBe('imports');
    });

    it('rejects ranges where startLine exceeds endLine', () => {
      const raw = [
        { startLine: 15, endLine: 10 },
      ];
      const res = LspFoldingValidator.validateRanges(raw, 50);
      expect(res).toHaveLength(0);
    });

    it('rejects ranges exceeding document total line bounds', () => {
      const raw = [
        { startLine: 0, endLine: 50 }, // 0-based lines must be < totalLines (50)
        { startLine: 50, endLine: 60 },
      ];
      const res = LspFoldingValidator.validateRanges(raw, 50);
      expect(res).toHaveLength(0);
    });

    it('rejects negative line numbers, NaN, or non-integer values', () => {
      const raw = [
        { startLine: -1, endLine: 5 },
        { startLine: 0, endLine: -5 },
        { startLine: NaN, endLine: 5 },
        { startLine: 2, endLine: Infinity },
        { startLine: 1.5, endLine: 5.5 },
      ];
      const res = LspFoldingValidator.validateRanges(raw, 50);
      expect(res).toHaveLength(0);
    });

    it('validates single-line fold only when startCharacter < endCharacter', () => {
      const raw = [
        { startLine: 5, endLine: 5, startCharacter: 10, endCharacter: 20 }, // Valid single-line fold
        { startLine: 6, endLine: 6 }, // Invalid: no characters on single line
        { startLine: 7, endLine: 7, startCharacter: 20, endCharacter: 10 }, // Invalid: startChar >= endChar
        { startLine: 8, endLine: 8, startCharacter: 10, endCharacter: 10 }, // Invalid: zero-length
      ];
      const res = LspFoldingValidator.validateRanges(raw, 50);
      expect(res).toHaveLength(1);
      expect(res[0].startLine).toBe(5);
      expect(res[0].startCharacter).toBe(10);
      expect(res[0].endCharacter).toBe(20);
    });

    it('clamps range count to MAX_FOLDING_RANGES', () => {
      const raw: any[] = [];
      for (let i = 0; i < 6000; i++) {
        raw.push({ startLine: 0, endLine: 1 });
      }
      const res = LspFoldingValidator.validateRanges(raw, 10);
      expect(res.length).toBe(LspFoldingValidator.MAX_FOLDING_RANGES);
    });
  });

  describe('sanitizeCollapsedText', () => {
    it('returns empty string for falsy or non-string input', () => {
      expect(LspFoldingValidator.sanitizeCollapsedText('')).toBe('');
      expect(LspFoldingValidator.sanitizeCollapsedText(null as any)).toBe('');
      expect(LspFoldingValidator.sanitizeCollapsedText(undefined as any)).toBe('');
    });

    it('strips HTML tags and script elements', () => {
      const input = '<span>Summary</span><script>alert(1)</script>';
      const sanitized = LspFoldingValidator.sanitizeCollapsedText(input);
      expect(sanitized).toBe('Summary alert(1)');
      expect(sanitized).not.toContain('<');
      expect(sanitized).not.toContain('>');
    });

    it('strips control characters and normalizes whitespace', () => {
      const input = 'Folded\x00\x08text\twith\nnewlines';
      const sanitized = LspFoldingValidator.sanitizeCollapsedText(input);
      expect(sanitized).toBe('Folded text with newlines');
    });

    it('clamps length to MAX_COLLAPSED_TEXT_LENGTH', () => {
      const longText = 'A'.repeat(100);
      const sanitized = LspFoldingValidator.sanitizeCollapsedText(longText);
      expect(sanitized.length).toBeLessThanOrEqual(LspFoldingValidator.MAX_COLLAPSED_TEXT_LENGTH);
      expect(sanitized.endsWith('…')).toBe(true);
    });
  });
});
