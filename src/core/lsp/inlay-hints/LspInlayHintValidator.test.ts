/**
 * QM Editor - LSP Inlay Hints Validator Tests
 * Phase 06, Step 65 — LSP Inlay Hints, Parameter Names, Type Information & Inline Semantic Annotations
 */

import { describe, it, expect } from 'vitest';
import { LspInlayHintValidator } from './LspInlayHintValidator';
import { LspInlayHint, LspInlayHintKind } from './LspInlayHintTypes';

describe('LspInlayHintValidator', () => {
  const docLines = [
    'function add(a: number, b: number): number {',
    '  const result = a + b;',
    '  return result;',
    '}',
  ];

  it('validates and returns valid inlay hints', () => {
    const rawHints: LspInlayHint[] = [
      {
        position: { line: 0, character: 12 },
        label: 'a: ',
        kind: LspInlayHintKind.Parameter,
      },
      {
        position: { line: 1, character: 14 },
        label: ': number',
        kind: LspInlayHintKind.Type,
        paddingLeft: true,
      },
    ];

    const result = LspInlayHintValidator.validateResponse(rawHints, docLines);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      line: 0,
      character: 12,
      label: 'a: ',
      kind: 'parameter',
      tooltip: undefined,
      paddingLeft: false,
      paddingRight: false,
      data: undefined,
    });
    expect(result[1]).toEqual({
      line: 1,
      character: 14,
      label: ': number',
      kind: 'type',
      tooltip: undefined,
      paddingLeft: true,
      paddingRight: false,
      data: undefined,
    });
  });

  it('extracts and concatenates structured label parts', () => {
    const rawHint: LspInlayHint = {
      position: { line: 0, character: 10 },
      label: [
        { value: 'x' },
        { value: ': ' },
        { value: 'number' },
      ],
      kind: LspInlayHintKind.Parameter,
    };

    const valid = LspInlayHintValidator.validateSingleHint(rawHint, docLines);
    expect(valid).not.toBeNull();
    expect(valid?.label).toBe('x: number');
  });

  it('rejects hints with negative or non-integer coordinates', () => {
    const invalidPositions = [
      { line: -1, character: 0 },
      { line: 0, character: -5 },
      { line: 1.5, character: 2 },
      { line: 0, character: 2.7 },
      { line: NaN, character: 0 },
    ];

    for (const pos of invalidPositions) {
      const hint = { position: pos, label: 'test' };
      const valid = LspInlayHintValidator.validateSingleHint(hint, docLines);
      expect(valid).toBeNull();
    }
  });

  it('rejects hints with out-of-bounds line numbers', () => {
    const hint: LspInlayHint = {
      position: { line: 10, character: 0 }, // doc has 4 lines
      label: 'test',
    };

    const valid = LspInlayHintValidator.validateSingleHint(hint, docLines);
    expect(valid).toBeNull();
  });

  it('rejects hints with character offset exceeding line length', () => {
    const hint: LspInlayHint = {
      position: { line: 0, character: 100 }, // line 0 length is 44
      label: 'test',
    };

    const valid = LspInlayHintValidator.validateSingleHint(hint, docLines);
    expect(valid).toBeNull();
  });

  it('rejects empty or whitespace-only labels after sanitization', () => {
    const hint1 = { position: { line: 0, character: 0 }, label: '' };
    const hint2 = { position: { line: 0, character: 0 }, label: '   \u0000  ' };
    const hint3 = { position: { line: 0, character: 0 }, label: [] };

    expect(LspInlayHintValidator.validateSingleHint(hint1, docLines)).toBeNull();
    expect(LspInlayHintValidator.validateSingleHint(hint2, docLines)).toBeNull();
    expect(LspInlayHintValidator.validateSingleHint(hint3, docLines)).toBeNull();
  });

  it('sanitizes malicious script tags and dangerous HTML in labels', () => {
    const hint: LspInlayHint = {
      position: { line: 0, character: 5 },
      label: 'param<script>alert("pwned")</script>: int',
    };

    const valid = LspInlayHintValidator.validateSingleHint(hint, docLines);
    expect(valid).not.toBeNull();
    expect(valid?.label).toBe('param: int');
    expect(valid?.label).not.toContain('<script>');
  });

  it('sanitizes tooltips from string and MarkupContent', () => {
    const hintWithStrTooltip: LspInlayHint = {
      position: { line: 0, character: 5 },
      label: 'val',
      tooltip: 'Safe tooltip info',
    };

    const hintWithMarkupTooltip: LspInlayHint = {
      position: { line: 0, character: 5 },
      label: 'val',
      tooltip: {
        kind: 'markdown',
        value: 'Type inferred as `number`<script>bad()</script>',
      },
    };

    const valid1 = LspInlayHintValidator.validateSingleHint(hintWithStrTooltip, docLines);
    expect(valid1?.tooltip).toBe('Safe tooltip info');

    const valid2 = LspInlayHintValidator.validateSingleHint(hintWithMarkupTooltip, docLines);
    expect(valid2?.tooltip).toBe('Type inferred as `number`');
  });

  it('maps kinds correctly', () => {
    expect(LspInlayHintValidator.mapKind(1)).toBe('type');
    expect(LspInlayHintValidator.mapKind(2)).toBe('parameter');
    expect(LspInlayHintValidator.mapKind(undefined)).toBe('other');
    expect(LspInlayHintValidator.mapKind(999)).toBe('other');
  });

  it('handles non-array inputs gracefully without throwing', () => {
    expect(LspInlayHintValidator.validateResponse(null, docLines)).toEqual([]);
    expect(LspInlayHintValidator.validateResponse(undefined, docLines)).toEqual([]);
    expect(LspInlayHintValidator.validateResponse('invalid' as any, docLines)).toEqual([]);
    expect(LspInlayHintValidator.validateResponse({} as any, docLines)).toEqual([]);
  });

  it('caps maximum hints per document to prevent DoS', () => {
    const manyHints: LspInlayHint[] = [];
    for (let i = 0; i < 3000; i++) {
      manyHints.push({
        position: { line: 0, character: 0 },
        label: `hint_${i}`,
      });
    }

    const validated = LspInlayHintValidator.validateResponse(manyHints, docLines);
    expect(validated.length).toBe(LspInlayHintValidator.MAX_HINTS_PER_DOCUMENT);
  });
});
